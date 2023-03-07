import base64
import collections
import datetime
import hashlib
import hmac
import json
import time
import urllib
import urlparse
import uuid
import requests
from splunktaucclib.common.log import logger

FIRE_HOST_FEED_API = 'https://firehose.crowdstrike.com/sensors/entities/datafeed/v1'
FIRE_HOST_API_TIMEOUT_SECS = 30


class FalconHostError(RuntimeError):
    pass

Stream = collections.namedtuple('Stream', ['url', 'token', 'expire'])
Event = collections.namedtuple('Event', ['source', 'time', 'data'])


def consume(api_uuid, api_key, offset=-1, stream=None, fire_host=FIRE_HOST_FEED_API,
            app_id=None, proxies=None, name='default', version=None):
    app_id = app_id or str(uuid.uuid4())[:8]
    fire_host = fire_host or FIRE_HOST_FEED_API
    if stream is None or _parse_iso_datetime(stream.expire) <= datetime.datetime.utcnow():
        logger.info("[%s] discovering stream for '%s' (with app id '%s')", name, api_uuid, app_id)
        stream = _discover_streams(name, fire_host, api_uuid, api_key, app_id, proxies, version)
    logger.info("[%s] start consuming '%s' for '%s' from %d", name, stream.url, api_uuid, offset)
    enumerable, closer = _consume_stream(name, api_uuid, stream, app_id, offset, proxies, version)
    logger.info("[%s] connection established", name)
    return stream, enumerable, closer


def _discover_streams(_, feed_api, api_uuid, api_key, app_id, proxies, version):
    url = _prepare_url(feed_api, app_id)
    resp = _ensure_response(requests.get(
        url, timeout=FIRE_HOST_API_TIMEOUT_SECS, auth=_falcon_host_api_auth_gen(api_uuid, api_key),
        proxies=proxies, headers={"X-INTEGRATION": "splunk_ta_" + str(version)}))
    response = _ensure_discover_stream_has_only_one_page(json.loads(resp.content))
    streams = [Stream(url=stream['dataFeedURL'],
                      token=stream['sessionToken']['token'],
                      expire=stream['sessionToken']['expiration'])
               for stream in response['resources']]
    return _ensure_only_one_stream_discovered(streams)


def _consume_stream(name, api_uuid, stream, app_id, offset, proxies, version):
    feed_url = _prepare_url(stream.url, app_id, {"offset": offset} if offset >= 0 else None)
    authenticator = _falcon_stream_api_auth_gen(stream.token)
    response = _ensure_response(
        requests.get(feed_url,  timeout=FIRE_HOST_API_TIMEOUT_SECS, auth=authenticator,
                     stream=True, proxies=proxies, headers={"X-INTEGRATION": "splunk_ta_" + str(version)}))

    def closer():
        logger.info("[%s] response stream being closed", name)
        response.close()
    return _stream_to_enumerable(name, response, api_uuid), closer


def _stream_to_enumerable(name, stream, source):
    enumerable = stream.iter_lines()
    while True:
        try:
            line = next(enumerable)
            if line:
                raw_event = json.loads(line)
                event = _convert_raw_event_to_event(raw_event, line, source)
                yield (raw_event['metadata']['offset'], event)
        except Exception as ex:
            # if you're here looking for the cause of errors like "'NoneType' object has
            # no attribute 'read'" please notice it's caused by closing the stream (from out of the
            # logic here. Which, in most cases, is not a real issue and cannot be fixed.
            logger.info("[%s] stream terminated : %s (%s)", name, ex.message, str(type(ex)))
            return


def _prepare_url(url, app_id, query=None):
    query = query or {}
    query['appId'] = app_id
    url_parsed = urlparse.urlparse(url)
    if url_parsed.query:
        for key, value in urlparse.parse_qsl(url_parsed.query):
            query[key] = value
    url_parsed = getattr(url_parsed, '_replace')(query=urllib.urlencode(query))
    return urlparse.urlunparse(url_parsed)


def _falcon_host_api_auth_gen(api_uuid, api_key):
    def _auth_api(request):
        for key, value in _get_auth_headers(request.url, api_key, api_uuid):
            request.headers[key] = value
        return request
    return _auth_api


def _falcon_stream_api_auth_gen(token):
    def _set_token(request):
        request.headers['Authorization'] = 'Token %s' % token
        return request
    return _set_token


def _get_auth_headers(url, api_key, api_uuid):
    date = datetime.datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')
    content_md5 = ""
    canonical_uri, canonical_query = _canonicalize_url(url)
    request_string = "\n".join(['GET', content_md5, date, canonical_uri, canonical_query])
    digest = hmac.new(str(api_key), str(request_string), digestmod=hashlib.sha256).digest()
    signature = base64.b64encode(digest).decode()
    return [
        ('Authorization', 'cs-hmac %s:%s:customers' % (api_uuid, signature)),
        ('Date', date)
    ]


def _canonicalize_query(query):
    query_items = sorted(urlparse.parse_qsl(query), key=lambda q: q[0])
    return urllib.urlencode(query_items)


def _canonicalize_url(url):
    url_parsed = urlparse.urlparse(url)
    port = None
    if url_parsed.port:
        if url_parsed.scheme == 'https' and url_parsed.port != 443:
            port = url_parsed.port

    if port:
        canonical_uri = "%s:%d" % (url_parsed.hostname, port)
    else:
        canonical_uri = url_parsed.hostname

    canonical_uri = canonical_uri.strip('/')
    if url_parsed.path:
        path = url_parsed.path.strip('/')
        path = urllib.quote(path)
        canonical_uri = "%s/%s" % (canonical_uri, path)
    elif not canonical_uri.endswith('/'):
        canonical_uri += '/'

    return canonical_uri, _canonicalize_query(url_parsed.query)


def _ensure_response(response):
    response.raise_for_status()
    return response


def _ensure_discover_stream_has_only_one_page(response):
    pagination = response['meta']['pagination']
    if pagination['offset'] != 0 or pagination['count'] != pagination['total']:
        raise FalconHostError("Only one page of streams is expected")
    elif pagination['count'] != 1:
        raise FalconHostError("Malformed response: One and only one stream is expected, found %d"
                              % pagination['count'])
    return response


def _ensure_only_one_stream_discovered(streams):
    if not isinstance(streams, list):
        streams = list(streams)
    if len(streams) == 0:
        raise FalconHostError("At least one stream is expected to be discovered")
    elif len(streams) > 1:
        raise FalconHostError("Only one stream is expected")
    else:
        return streams[0]


def _parse_iso_datetime(time):
    return datetime.datetime.strptime(time[:26], "%Y-%m-%dT%H:%M:%S.%f")


def _convert_raw_event_to_event(raw_event, line, source):
    raw_data = line
    event = raw_event['event']
    metadata = raw_event['metadata']
    event_type = raw_event['metadata']['eventType']
    if event_type == 'AuthActivityAuditEvent' or event_type == 'UserActivityAuditEvent' or event_type == 'DetectionSummaryEvent' or event_type == 'CustomerIOCEvent' or event_type == 'HashSpreadingEvent':
        timestamp = (metadata.get('eventCreationTime')/1000) or event['UTCTimestamp']
    else:
        timestamp = time.time()
    # as SaaS, there's no suitable field to be used as 'host'
    return Event(time=timestamp, data=raw_data, source=source)
