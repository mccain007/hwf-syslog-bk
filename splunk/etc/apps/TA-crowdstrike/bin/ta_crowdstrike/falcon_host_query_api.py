import base64
import json
import requests
import os
import sys
import datetime
from splunktaucclib.common.log import logger


folder_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(os.path.dirname(folder_path)))

import crowdstrike_consts as consts

FALCON_ACCOUNT = "https://falconapi.crowdstrike.com"
FIRE_HOST_API_TIMEOUT_SECS = 30
SOURCE_TYPE = "crowdstrike:falconhost:query:json"


class FalconHostError(RuntimeError):
    pass



def consume_query(fire_api, username, password, offset=-1, start_date=None, proxies=None, name='default', index=None, version=None):
    """
    Entry point to execute query API
    :param fire_api: endpoint to consume
    :param username: username of query API
    :param password: password of query API
    :param offset: offset from where query API data to be fetched
    :param start_date: date from when query API data to be fetched
    :param proxies: proxy details
    :param name: name of stanza
    :param index: index to be consider for query API events
    :param version: version of the TA
    :return: offset
    """
    fire_host = FALCON_ACCOUNT + fire_api
    logger.info("[%s] start processing query API for '%s' from %d %s %s", name, username, offset, start_date, fire_host)
    offset, total_offset, last_updated_time = _process_query_api(name, fire_host, username, password, proxies, index, offset, start_date, version)    
    logger.info("[%s] connection established offset %s total_offset %s last_updated_time %s for api %s", name, offset, total_offset, last_updated_time, fire_api)
    return offset, total_offset, last_updated_time


def execute_endpoint(url, username, password, proxies, method="get", query_params=None, payload=None, offset=None,
                     version=None):
    """
    Execute query API endpoint
    
    :param url: endpoint of query API
    :param username: username of query API
    :param password: password of query API    
    :param proxies: proxy details
    :param method: method to use for API call execution. Bydefault get
    :param query_params: query parameters to consider
    :param payload: payload to consider in post method
    :param offset: offset from where query API data to be fetched
    :param version: version of the TA
    :return: response of endpoint
    """
    base64string = base64.b64encode('%s:%s' % (username, password))
    headers = {"Authorization": "Basic " + base64string, "Content-Type": "application/json",
               "X-INTEGRATION": "splunk_ta_" + str(version)}
    params = {"offset": offset} if offset else None
    if method=="get":
        try:
            url = url + query_params if query_params else url
            resp = _ensure_response(requests.get(
                url, timeout=FIRE_HOST_API_TIMEOUT_SECS, headers=headers,
                proxies=proxies, params=params))
        except Exception as e:
            logger.error("Error while executing get request %s", str(e))
            return None
    else:
        try:
            resp = _ensure_response(requests.post(
                url, timeout=FIRE_HOST_API_TIMEOUT_SECS, headers=headers,
                proxies=proxies, data=json.dumps(payload)))
        except Exception as e:
            logger.error("Error while executing post request %s", str(e))
            return None
    response = json.loads(resp.content)
    return response

def get_offset(feed_api, response):
    """
    Get next offset to consider from response
    :param feed_api: endpoint to consider
    :param response: response of endpoint
    :return: offset and total from response meta
    """
    
    if feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
        if (response["meta"]["pagination"]["offset"] < response["meta"]["pagination"]["total"]) \
            and (response["meta"]["pagination"]["offset"]+response["meta"]["pagination"]["limit"]<= response["meta"]["pagination"]["total"]):
            return response["meta"]["pagination"]["offset"] + response["meta"]["pagination"]["limit"], response["meta"]["pagination"]["total"]
        elif response["meta"]["pagination"]["total"] - (response["meta"]["pagination"]["offset"] + response["meta"]["pagination"]["limit"])<0:
            return response["meta"]["pagination"]["total"], response["meta"]["pagination"]["total"]
        else:
            return response["meta"]["pagination"]["offset"], response["meta"]["pagination"]["total"]
    return response["meta"]["pagination"]["offset"], response["meta"]["pagination"]["total"]


def _process_query_api(_, feed_api, username, password, proxies, index, offset, start_date, version):
    """
    Process query API to fetch data by pagination
    :param feed_api: endpoint to execute
    :param username: username of query API
    :param password: password of query API
    :param proxies: proxy detail
    :param index: index to be consider for query API events
    :param offset: offset from where query API data to be fetched
    :param start_date: date from when query API data to be fetched
    :param version: version of the TA
    :return: response_offset
    """

    query_params = None
    if feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1:
        query_params = "?filter=last_seen:>="+"'" + start_date +"'"+"&sort=last_seen.asc"
    elif feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
        query_params = "?filter=last_behavior:>="+"'" + start_date +"'"+"&sort=last_behavior.asc"
    response = execute_endpoint(feed_api, username, password, proxies, offset=offset, query_params=query_params, version=version)
    if not response:
        if feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
            return offset, None, start_date
        return offset, None, None
    response_offset, response_total = get_offset(feed_api, response)
    if response_total == 0:
        if feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
            return offset, None, start_date
        return offset, None, None
    result = parse_response(feed_api, username, password, proxies, response, index, version)
    if not result:
        return offset, response_total, None
    elif feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
        start_date = result
    if feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
        flag = True
        while flag:
            if response_offset and not response_total:
                flag = False
            if response_offset and response_total and response_offset!=response_total:
                response_offset, response_total, start_date = do_pagination(_, feed_api, username, password, proxies, index, response_offset, start_date, version, query_params=query_params)
            else:
                if start_date:
                    start_datetime = datetime.datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%SZ')
                    start_date = start_datetime + datetime.timedelta(seconds=1)
                    start_date = start_date.strftime('%Y-%m-%dT%H:%M:%SZ')
                flag = False
    return response_offset, response_total, start_date

def do_pagination(_, feed_api, username, password, proxies, index, offset, start_date, version, query_params=None):
    response = execute_endpoint(feed_api, username, password, proxies, offset=offset, query_params=query_params, version=version)
    if not response:
        if feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
            return offset, None, start_date
        return offset, None, None
    response_offset, response_total = get_offset(feed_api, response)
    if response_total == 0:
        if feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
            return offset, None, start_date
        return offset, None, None
    result = parse_response(feed_api, username, password, proxies, response, index, version)
    if not result:
        return offset, None, start_date
    elif feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
        start_date = result
    return response_offset, response_total, start_date
    

def parse_response(feed_api, username, password, proxies, response, index, version):
    """
     Parse Response and index as event
    :param feed_api: endpoint to execute
    :param username: username of query API
    :param password: password of query API
    :param proxies: proxy detail
    :param response: response to parse
    :param index: index to be consider for query API events
    :param version: version of the TA
    :return: response_offset
    """
    if response.get("resources"):
        query = "&ids=".join(response.get("resources"))
        method= "get"
        data = {}
        
        if response.get("meta"):
            if feed_api.find(consts.INDICATOR_QUERY_ENDPOINT)!=-1:
                entity = response["meta"]["entity"] if response.get("meta").get("entity") else consts.INDICATOR_ENTITY_ENDPOINT
                entity = str(entity).split("{")[0] + "?ids="
            elif feed_api.find(consts.DEVICE_QUERY_ENDPOINT)!=-1:
                entity = consts.DEVICE_ENTITY_ENDPOINT + "?ids="
            elif feed_api.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
                entity = consts.DETECT_ENTITY_ENDPOINT
                method = "post"
                data = {"ids": response.get("resources",[])}
                
            feed_api = FALCON_ACCOUNT + entity
            endpoint_response = execute_endpoint(feed_api, username, password, proxies, method=method,
                                                 query_params=query, payload=data, version=version)
            if not endpoint_response:
                return False
            try:
                meta = endpoint_response.get("meta")
                for response in endpoint_response.get("resources"):
                    event = {}
                    event["meta"] = meta
                    event["resources"] = response
                    event["errors"]={}
                    print_xml_stream(json.dumps(event), entity, index)
                
                if feed_api.find("detect")!=-1:
                    last_updated = endpoint_response.get("resources")[-1]['last_behavior']
                    logger.debug("Last behavior date for detection : %s", last_updated)
                    return last_updated
                elif feed_api.find("device")!=-1:
                    last_updated = endpoint_response.get("resources")[-1]['last_seen']
                    logger.debug("Last seen date for device: %s", last_updated)
                    return last_updated
            except Exception as ex:
                 logger.exception("Error while parsing response : %s", str(ex))
                 return False
    return True
 

def print_xml_stream(s, source, index):
    """
    To index event in xml format
    
    :param s: event string
    :return: none
    """
    print "<stream><event unbroken=\"1\"><data>%s</data><source>%s</source><sourcetype>%s</sourcetype><index>%s</index><done/></event></stream>" % (
            encode_xml_text(s), str(source), str(SOURCE_TYPE), str(index))


def encode_xml_text(text):
    """
    To encode some special chars in xml
    
    :param text: xml text
    :return: encoded text
    """
    text = text.replace("&", "&amp;")
    text = text.replace("\"", "&quot;")
    text = text.replace("'", "&apos;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace("\n", "")
    return text


def _ensure_response(response):
    """
    Ensure response to not have any error
    
    :param response: response to check for error status
    :return: response
    """
    response.raise_for_status()
    return response
