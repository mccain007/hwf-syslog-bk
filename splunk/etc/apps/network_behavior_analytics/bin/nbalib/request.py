import time
import gzip

from contextlib import closing

import requests
import requests.exceptions

from .asoc3.six.moves import urllib_parse
from .asoc3 import six


API_TIMEOUT = 90
API_MAX_RETRIES = 2


class InternalCodes(object):
    ERROR_HTTP = 1001
    ERROR_SSL = 1002


class Request(object):
    def __init__(self, url, params=None, data=None):
        self._payload = Payload(params, data)

        self._url = url
        self._headers = {}
        self._auth = None

        self._settings = {
            'timeout': API_TIMEOUT,
            'https_enforcement': True,
            'compression': False,
            'verify': True,
            'proxy': None
        }

    def enable_auth(self, api_key, password=''):
        self._auth = None if not api_key else (api_key, password)

    def disable_https_enforcement(self):
        self._settings['https_enforcement'] = False

    def disable_verification(self):
        self._settings['verify'] = False

    def enable_compression(self):
        self._settings['compression'] = True

    def set_timeout(self, timeout):
        self._settings['timeout'] = timeout

    def set_proxy(self, proxy):
        self._settings['proxy'] = {'https': proxy, 'http': proxy} if proxy else None

    def append_headers(self, headers):
        self._headers.update(headers)

    def send(self):
        if self._payload.is_post():
            self._headers['Content-Type'] = 'application/json'

            if self._settings['compression']:
                self._compress()

        self._make_str_headers()

        prepared_request = requests.Request(
            method=self._payload.method(),
            url=self._enforce_https_url(),
            headers=self._headers,
            data=self._payload.data,
            params=self._payload.params,
            auth=self._auth
        ).prepare()

        response = self._make(prepared_request)
        return response

    def _compress(self):
        self._headers['Content-Encoding'] = 'gzip'
        self._payload.compress()

    def _make_str_headers(self):
        for key, value in self._headers.items():
            if not isinstance(value, six.string_types):
                self._headers[key] = str(value)

    def _enforce_https_url(self):
        if not self._settings.get('https_enforcement', True):
            return self._url

        try:
            parsed_url = urllib_parse.urlsplit(self._url)
            if not parsed_url.scheme:
                return "https://" + self._url
            elif parsed_url.scheme != "https":
                parsed_url = parsed_url._replace(scheme='https')

            return parsed_url.geturl()
        except:
            raise Exception("Invalid URL format")

    def _make(self, request):
        response = None
        tries = 0

        while tries <= API_MAX_RETRIES:
            session = requests.Session()
            try:
                response = session.send(
                    request,
                    verify=self._settings['verify'],
                    proxies=self._settings['proxy'],
                    timeout=self._settings['timeout']
                )
            except requests.exceptions.SSLError:
                return Response.ssl_error(self._url)
            except requests.exceptions.RequestException:
                time.sleep(0.1)
                tries += 1
            else:
                break

        return Response.parse_response(response, self._url)


class Payload(object):
    def __init__(self, params, data):
        if params is not None and data is not None:
            raise requests.exceptions.ConnectionError("Tried to do both GET and POST at once?")

        self.params = params
        self.data = data

    def is_post(self):
        return self.data is not None

    def method(self):
        return 'POST' if self.is_post() else 'GET'

    def compress(self):
        if self.data is None:
            return

        with closing(six.BytesIO()) as strc:
            with closing(gzip.GzipFile(fileobj=strc, mode='w')) as gzipc:
                gzipc.write(six.ensure_binary(self.data))
            self.data = strc.getvalue()


class Response(object):
    def __init__(self, code, content):
        self.code = code
        self.content = content

    @classmethod
    def ssl_error(cls, url):
        code = InternalCodes.ERROR_SSL
        content = {
            'message': u"Certificate validation for {0} failed. If you have security "
                       u"apparatus intercepting TLS sessions, please click into Settings to "
                       u"disable X.509 certificate validation.".format(url)
        }

        return cls(code, content)

    @classmethod
    def parse_response(cls, response, url):
        if response is None:
            code = InternalCodes.ERROR_HTTP
            content = {
                'message': u"Connection error: Unable to reach {0}. Please ensure your "
                           u"Search Head can reach the API.".format(url)
            }

            return cls(code, content)

        try:
            content = response.json()
        except ValueError:
            content = response.text

        code, content = cls._parse_content(response.status_code, content)
        return cls(code, content)

    @staticmethod
    def _parse_content(code, content):
        if code != 200:
            if isinstance(code, int) and code // 100 == 5:
                content = {
                    'message': (u"The AlphaSOC Analytics Engine is temporarily unavailable. "
                                u"If this message persists please contact support@alphasoc.com.")
                }
            elif isinstance(content, dict):
                if not content.get('message'):
                    content['message'] = u"API Error: Server returned HTTP code {0}.".format(code)
            else:
                content = {'message': u"API Error: Server returned HTTP code {0}.".format(code)}
        else:
            if not isinstance(content, dict):
                code = InternalCodes.ERROR_HTTP
                content = {'message': u"API Error: Server didn't return valid JSON data."}

        return code, content
