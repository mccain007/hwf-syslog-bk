import os
import sys
import Queue
import random
import socket
import string
import threading
import urllib
import uuid
import json
import splunk.rest as rest
import splunktaucclib.data_collection.ta_data_client as ta_data_client
import splunktaucclib.data_collection.ta_consts as ta_consts
from splunktaucclib.common.log import logger
from falcon_host_stream_api import consume
from falcon_host_query_api import consume_query

folder_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(os.path.dirname(folder_path)))

import crowdstrike_consts as consts



_SOURCE_TYPE = "crowdstrike:falconhost:json"
_QUEUE_GET_BLOCK_SECS = 5
_QUEUE_SAFE_MAX_SIZE = 500


class FalconHostDataClient(ta_data_client.TaDataClient):
    # This class is not thread safe. Every worker thread should have initialized its own instance
    def __init__(
            self,
            all_conf_contents,
            meta_config,
            task_config,
            checkpoint=None,
            checkpoint_mgr=None
    ):
        super(FalconHostDataClient, self).__init__(
            all_conf_contents, meta_config, task_config, checkpoint, checkpoint_mgr)
        self._uuid = str(uuid.uuid4())
        self._stanza = task_config[ta_consts.stanza_name]
        self._endpoint = task_config.get('endpoint')
        self._global = all_conf_contents['global_settings']
        self._input = all_conf_contents['inputs'][self._stanza]
        account_name = self._input['account']
        self._account = all_conf_contents['accounts'][account_name]
        self._queue = Queue.Queue(maxsize=_QUEUE_SAFE_MAX_SIZE)
        self._index = None
        self._closer = None
        self._stream = None
        self._consumer = None
        self._prev_offset = None
        self._conf_offset = None
        self._initialized = False
        self.api_type = None
        logger.setLevel(self._parse_log_level())
        logger.info("[%s](%s) constructor finished", self._stanza, self._uuid)
        self._log_configuration()
        self.session_key = str(meta_config.get("session_key"))

    def stop(self):
        if self._closer:
            self._closer()
        self._consumer = None
        if not self.is_stopped():
            super(FalconHostDataClient, self).stop()
            logger.info("[%s](%s) stream client stopped", self._stanza, self._uuid)

    def get(self):
        if not self._initialized:
            self._initialize()
            self._initialized = True
            logger.info("[%s](%s) initialization finished", self._stanza, self._uuid)
            
        if self.api_type != "Query":            
            while True:
                if self.is_stopped():
                    logger.info("[%s](%s) get terminated due stop signal", self._stanza, self._uuid)
                    raise StopIteration
                try:
                    offset, event = self._queue.get(timeout=_QUEUE_GET_BLOCK_SECS)
                    return self._process_event(offset, event)
                except Queue.Empty:
                    pass
        raise StopIteration
                

    def _process_event(self, offset, event):
        if self._prev_offset:
            if self._prev_offset + 1 != offset:
                logger.warn("[%s](%s) event offset gap : previous offset %d, current offset %d,"
                            " this might be caused by event data loss", self._stanza, self._uuid,
                            self._prev_offset, offset)
        else:
            import datetime
            logger.info("[%s](%s) first event received : '%d', time = %s", self._stanza, self._uuid,
                        offset, datetime.datetime.utcfromtimestamp(event.time).isoformat())
        self._prev_offset = offset
        events = [ta_data_client.build_event(
            time=event.time,
            index=self._index,
            source=event.source,
            sourcetype=_SOURCE_TYPE,
            raw_data=event.data
        )]
        return events, self._create_checkpoint(offset)
        
    def get_app_version(self):
        # Retrieve app version
        try:
            resp, content = rest.simpleRequest('/servicesNS/nobody/system/apps/local/TA-crowdstrike',
                                               sessionKey=self.session_key, getargs={"output_mode": "json"}, raiseAllErrors=True)
            # Parse response
            app_info = json.loads(content)['entry'][0]['content']

        except Exception as ex:
            logger.error("CrowdStrike Error: Error while fetching app version. Passing x.x.x as default version. %s", ex.message)
            return "x.x.x"
        ta_version = str(app_info.get("version", "x.x.x"))
        return ta_version

    def _initialize(self):
        ta_ver = self.get_app_version()
        api_uuid, api_key, api_type = self._parse_credentials()
        self.api_type = api_type
        proxies = self._parse_proxies()
        try:
            if api_type=="Query":
                #We are restricting device endpoint due to issue at product side. We will revoke below condition
                # once get resolved at product side.
                if self._endpoint.find(consts.DEVICE_QUERY_ENDPOINT)!=-1 or self._endpoint.find(consts.DETECT_QUERY_ENDPOINT)!=-1:
                    return False
                app_id, start_offset, start_date = self._parse_query_configurations(self._endpoint)

                if start_offset:
                    # if already consumed, consume next item (offset + 1)
                    start_offset = start_offset + 1 if start_offset < 0 else start_offset
                self._execute_query_api(self._endpoint, api_uuid=api_uuid, api_key=api_key,
                                start_offset=start_offset, start_date=start_date, proxies=proxies, stanza=self._stanza, index=self._index, version=ta_ver)
                self.stop()
            else:
                app_id, start_offset = self._parse_configurations(ta_ver)
                # if already consumed, consume next item (offset + 1)
                start_offset = start_offset + 1 if start_offset > 0 else start_offset
                self._stream, gen, self._closer = consume(
                    api_uuid, api_key, start_offset, None, fire_host=self._account.get('endpoint'),
                    app_id=app_id, proxies=proxies, name=self._stanza, version=ta_ver)
                self._create_consumer_thread(gen)
        except Exception as ex:
            logger.exception("[%s](%s) unable to consume : %s", self._stanza, self._uuid, ex.message)
            raise


    def _execute_query_api(self, api, api_uuid, api_key, start_offset, start_date,  
                    proxies, stanza, index, version):
        do_execution = True
        while do_execution:
            offset, total_offset, updated_date = consume_query(api, api_uuid, api_key, start_offset, start_date,
                        proxies=proxies, name=stanza, index=index, version=version)
            ckpt = self._create_query_checkpoint(api, offset, last_updated=updated_date)
            old_ckpt = self._checkpoint_mgr.get_ckpt()
            if not old_ckpt:
                old_ckpt = {}
            
            if api.find(consts.INDICATOR_QUERY_ENDPOINT)!=-1:
                if not (api in old_ckpt and old_ckpt[api]['offset']==offset):
                    ckpt = old_ckpt.update(ckpt)
                    self._checkpoint_mgr.update_ckpt(old_ckpt)
            else:
                if updated_date:
                    ckpt = old_ckpt.update(ckpt)
                    self._checkpoint_mgr.update_ckpt(old_ckpt)
            start_offset = offset
            start_date = updated_date
            if api.find(consts.INDICATOR_QUERY_ENDPOINT)!=-1:
                if (offset and not total_offset) or (offset==total_offset):
                    do_execution = False
            else:
                do_execution = False
    
    def _create_consumer_thread(self, gen):
        self._consumer = threading.Thread(target=self._consume_loop, kwargs=dict(gen=gen))
        self._consumer.setDaemon(True)
        self._consumer.start()

    def _consume_loop(self, gen):
        first_received = False
        logger.info("[%s](%s) consume loop started", self._stanza, self._uuid)
        while not self.is_stopped():
            try:
                offset, event = gen.next()
                if not first_received:
                    first_received = True
                    logger.info("[%s](%s) first event pulled out : %d", self._stanza, self._uuid,
                                offset)
                if not self.is_stopped():
                    # add a very long timeout to make sure the put exits in the end
                    self._queue.put((offset, event), timeout=_QUEUE_GET_BLOCK_SECS * 1000)
            except Exception as ex:
                if not self.is_stopped():
                    if not isinstance(ex, StopIteration):
                        logger.error("[%s](%s) exception while _gen.next : %s (%s)", self._stanza,
                                     self._uuid, ex.message or "<empty>", str(type(ex)))
                    self.stop()  # stop self for retrying
                else:
                    logger.debug("[%s](%s) consumer thread stopped...", self._stanza, self._uuid)
                break
        logger.info("[%s](%s) consume loop stopped", self._stanza, self._uuid)

    def _create_query_checkpoint(self, api, offset, last_updated=None):
        if api.find(consts.INDICATOR_QUERY_ENDPOINT)!=-1:
            return {api: dict(
                conf_offset=self._conf_offset,
                offset=offset
            )}
        else:
            return {api: dict(
                last_updated=last_updated
            )}
    
    def _create_checkpoint(self, offset):
        return dict(
            conf_offset=self._conf_offset,
            offset=offset
        )

    def _parse_proxies(self):
        proxy = self._global['crowdstrike_proxy']
        proxy_enabled = str(proxy['proxy_enabled']).lower() == 'true' or str(proxy['proxy_enabled']) == '1'
        if proxy_enabled:
            proxy_type = proxy['proxy_type']
            proxy_url = proxy['proxy_url']
            proxy_port = proxy['proxy_port']
            proxy_username = urllib.quote(proxy['proxy_username'])
            proxy_password = urllib.quote(proxy['proxy_password'])
            proxy_str = '%s://%s:%s@%s:%s' % (proxy_type, proxy_username, proxy_password,
                                              proxy_url, str(proxy_port))
            # log url only to avoid sensitive
            logger.debug("[%s] using proxy url = %s", self._stanza, proxy_url)
            return dict(https=proxy_str, http=proxy_str)
        return None

    def _parse_log_level(self):
        return self._global['crowdstrike_loglevel']['loglevel']

    def _parse_credentials(self):
        api_uuid = self._account['api_uuid']
        api_key = self._account['api_key']
        api_type = self._account['api_type']
        logger.info("[%s] api_uuid : %s api_type: %s", self._stanza, api_uuid, api_type)
        return api_uuid, api_key, api_type

    def _parse_query_configurations(self, falcon_query_api):
        self._index = self._input['index']
        app_id_prefix = self._input.get('app_id', "splunk-ta")
        app_id = _get_process_identifier(app_id_prefix)
        if falcon_query_api.find(consts.INDICATOR_QUERY_ENDPOINT)!=-1:
            ckpt_offset = int(self._ckpt.get(falcon_query_api).get('offset', -1) if self._ckpt.get(falcon_query_api) else -1)
            prev_conf_offset = int(self._ckpt.get(falcon_query_api).get('conf_offset', -1) if self._ckpt.get(falcon_query_api) else -1)
            self._conf_offset = int(self._input.get('start_offset', -1))
            if self._conf_offset and self._conf_offset > 0 and (not ckpt_offset or ckpt_offset==-1):
                start_offset = self._conf_offset
            else:
                start_offset = ckpt_offset if ckpt_offset>0 else 0
            logger.info("[%s] endpoint: %s app_id:%s, start_offset:%d, ckpt:%d, prev:%d, conf:%d",
                        falcon_query_api, self._stanza, app_id, start_offset, ckpt_offset, prev_conf_offset,
                        self._conf_offset)
            return app_id, start_offset, None
        else:
            ckpt_last_updated = self._ckpt.get(falcon_query_api).get('last_updated', -1) if self._ckpt.get(falcon_query_api) else -1
            prev_conf_last_updated = self._ckpt.get(falcon_query_api).get('conf_last_updated', -1) if self._ckpt.get(falcon_query_api) else -1
            self._conf_last_updated = self._input.get('start_date')
            if self._conf_last_updated and (not ckpt_last_updated or ckpt_last_updated==-1):
                start_date = self._conf_last_updated
            else:
                start_date = ckpt_last_updated #if ckpt_last_updated>0 else 0
            logger.info("[%s] endpoint: %s app_id:%s, start_date:%s, ckpt:%s, prev:%s, conf:%s",
                        falcon_query_api, self._stanza, app_id, start_date, ckpt_last_updated, prev_conf_last_updated,
                        self._conf_last_updated)
            if not start_date:
                start_date = "1970-01-01T00:00:00Z"
            return app_id, 0, start_date

    
    def _parse_configurations(self, ta_version):
        self._index = self._input['index']
        app_id_prefix = self._input.get('app_id', "splunk-ta-" + ta_version)
        app_id = _get_process_identifier(app_id_prefix)
        ckpt_offset = int(self._ckpt.get('offset', -1))
        prev_conf_offset = int(self._ckpt.get('conf_offset', -1))
        self._conf_offset = int(self._input.get('start_offset', -1))
        if self._conf_offset != prev_conf_offset:
            logger.debug("[%s] conf offset modified: %d -> %d", prev_conf_offset, self._conf_offset)
            start_offset = self._conf_offset
        else:
            start_offset = ckpt_offset
        logger.info("[%s] app_id:%s, start_offset:%d, ckpt:%d, prev:%d, conf:%d",
                    self._stanza, app_id, start_offset, ckpt_offset, prev_conf_offset,
                    self._conf_offset)
        return app_id, start_offset

    def _log_configuration(self):
        def mask(c):
            return _mask_sensitive_fields(['api_key', 'proxy_password', 'proxy_username'], c)

        logger.debug("[%s] global config : %s", self._stanza, mask(self._all_conf_contents))
        logger.debug("[%s] task config : %s", self._stanza, mask(self._task_config))
        logger.debug("[%s] checkpoint : %s", self._stanza, mask(self._ckpt))


def _mask_sensitive_fields(fields, config):
    if isinstance(config, dict):
        ret = dict()
        for k, v in config.iteritems():
            ret[k] = "__MASKED__" if k in fields else _mask_sensitive_fields(fields, v)
        return ret
    elif isinstance(config, list):
        ret = list()
        for item in config:
            ret.append("__MASKED__" if item in fields else _mask_sensitive_fields(fields, item))
        return ret
    else:
        return config


def _get_process_identifier(prefix):
    # 32 = max len for app id
    pid_str = str(os.getpid())
    host = urllib.quote(socket.gethostname())
    identifier = "%s-%s-%s" % (prefix, host, pid_str)
    if len(identifier) > 28:
        identifier = identifier[:28]

    # append 4 chars random string for retrying usage
    identifier += ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return identifier.lower()
