import sys
import csv
import time
import json

from abc import ABCMeta, abstractmethod
from contextlib import closing

from . import batches
from . import search
from . import period
from . import confs
from . import scopes
from . import api
from . import dateasoc
from . import logger
from . import sections
from . import validators

from .asoc3.six.moves import cStringIO
from .asoc3 import six

DEFAULT_REST_TIMEOUT_SECONDS = 600
DEFAULT_EARLIEST_MINUTES = 40320
DEFAULT_LATEST_MINUTES = 1440

DEFAULT_BATCH_TIMEOUT_SECONDS = 240
DEFAULT_BATCH_MAX_ITEMS = 50000

DEFAULT_MAX_STORAGE_BATCHES = 20
DEFAULT_MAX_STORAGE_ITEMS = 300000


class SendlogError(Exception):
    pass


class Config(object):
    def __init__(self, section, script_paths=None):
        self.section = section
        self.script_paths = script_paths

        self.rest_timeout = DEFAULT_REST_TIMEOUT_SECONDS
        self.earliest_minutes = DEFAULT_EARLIEST_MINUTES
        self.latest_minutes = DEFAULT_LATEST_MINUTES

        self.batch_timeout = DEFAULT_BATCH_TIMEOUT_SECONDS
        self.batch_max_items = DEFAULT_BATCH_MAX_ITEMS

        self.storage_max_batches = DEFAULT_MAX_STORAGE_BATCHES
        self.storage_max_items = DEFAULT_MAX_STORAGE_ITEMS


class APILog(object):
    def __init__(self):
        self.content = {}

    def set(self, key, value):
        self.content[key] = value

    def set_non_empty(self, key, value):
        if value:
            self.set(key, value)

    def set_non_empty_lower(self, key, value):
        if not isinstance(value, six.string_types):
            return

        self.set_non_empty(key, value.lower())

    def set_integer(self, key, value):
        try:
            int_value = int(float(value))
        except:
            return

        self.set(key, int_value)

    def set_float(self, key, value):
        try:
            float_value = float(value)
        except:
            return

        self.set(key, float_value)

    def set_ip(self, key, value):
        try:
            ip = validators.IP.full_valid_ip(value)
            if not ip:
                return
        except:
            return

        self.set(key, ip)


class Sendlog(six.with_metaclass(ABCMeta, object)):
    """
    Sendlog allows to collect logs indexed in splunk. It runs small searches and
    collect data from defined period of time. This class can be extended to collect specific
    logs e.g. dns logs or network traffic logs.
    """

    def __init__(self, config, period_config, session_key, log):
        self._session_key = session_key
        self._config = config
        self._log = log

        self.app_config = confs.Config(session_key, stanza=config.section)
        self.period = period.Period(self.get_last_indextime(), period_config)
        self.scope = scopes.Scope()

        self.batch = batches.Batch(config.batch_max_items, config.batch_timeout)
        self.storage = batches.Pickle(config.section, config.storage_max_batches, config.storage_max_items)

        self.empty_search_result = False
        self.events_index = None
        self.last_indextime = 0

    @abstractmethod
    def get_query(self):
        pass

    @abstractmethod
    def parse_indextime(self, result):
        pass

    @abstractmethod
    def parse_result(self, result):
        pass

    @abstractmethod
    def after_send(self):
        pass

    def run(self):
        """
        Sendlog runs an infinity loop and gets data once in a specified period of time. In each iteration
        splunk search query is runned and logs are collected. Results are send in csv format. After
        processing this data, time period must be changed to the next time segment and script will
        wait to the begining of the next period. If events index is changed, sendlog must be restarted
        to update this configuration and print events to the right index.
        """

        self.runtime_health_check()
        self.authorize(refresh_account_status=True)
        self.events_index_changed()
        self.sync_events_index()

        while True:
            response = self.run_search()
            count = 0

            with closing(cStringIO(response.content)) as content:
                results = csv.DictReader(content, delimiter=',')

                for result in results:
                    event = self.process_result(result)
                    if event is not None:
                        self.batch.add(event)

                    count += 1
                    self.authorize_send()

            self._log.info("got {0} events from the last search".format(count))
            self.empty_search_result = count <= 0

            # Try to send outstanding logs and update runtime health check.
            self.authorize_send()
            self.runtime_health_check()

            # Choose next period for splunk query.
            self.period.next_period()
            self.wait_to_end()
            self.app_config.refresh()

    def runtime_health_check(self):
        self.app_config.set('last_runtime', int(time.time()))

    def get_logs_index(self, stanza):
        try:
            config = confs.Config(self._session_key, name='macros', stanza=stanza)
            index = config.get('definition', default="*")
            self._log.info("got {0} definition from macros: '{1}'".format(stanza, index))
        except:
            config_index = self.app_config.get('logs_index', default="*")
            index_names = [x.strip() for x in config_index.split(',')]
            index = " OR ".join(["index=%s" % i for i in index_names])

            self._log.warn("got {0} definition from config: '{1}'".format(stanza, index))

        return index

    def get_indextime(self, indextime):
        try:
            return int(indextime)
        except:
            self._log.warn('could not get indextime: {0}, got: {1}'.format(indextime, self.last_indextime))
            return self.last_indextime

    def get_last_indextime(self):
        init = None
        try:
            init = int(self.app_config.get('last_indextime'))
            self._log.info('got last indextime from config: {0}'.format(init))
        except:
            self._log.warn('could not parse last indextime from config')

        return init

    def format_timeranges(self):
        timeranges = []

        try:
            earliest_minutes = self.get_earliest()
            if earliest_minutes > 0:
                timeranges.append("earliest=-{0}m".format(earliest_minutes))
        except:
            self._log.warn('could not parse sendlog_earliest_minutes from config')

        try:
            latest_minutes = self.get_latest()
            if latest_minutes > 0:
                timeranges.append("latest=+{0}m".format(latest_minutes))
        except:
            self._log.warn('could not parse sendlog_latest_minutes from config')

        return " ".join(timeranges)

    def get_earliest(self):
        earliest_minutes = self._config.earliest_minutes

        try:
            earliest = int(self.app_config.get_from_stanza('sendlog_earliest_minutes', stanza=sections.NBA.stanza))
            if earliest >= 0:
                earliest_minutes = earliest
        except:
            earliest_minutes = self._config.earliest_minutes

        return earliest_minutes

    def get_latest(self):
        latest_minutes = self._config.latest_minutes

        try:
            latest = int(self.app_config.get_from_stanza('sendlog_latest_minutes', stanza=sections.NBA.stanza))
            if latest >= 0:
                latest_minutes = latest
        except:
            latest_minutes = self._config.latest_minutes

        return latest_minutes

    def authorize(self, refresh_account_status=False):
        if not self.app_config.is_enabled('enabled', default=True):
            raise SendlogError("sendlog was disabled by user")

        auth = api.Auth(self._session_key)
        if refresh_account_status:
            account_details = auth.account_status(self.app_config, check_master_node=True)
            return account_details.api_key

        return auth.get_api_key(self.app_config, check_master_node=True)

    def events_index_changed(self):
        events_index = self.app_config.get_from_stanza('events_index', stanza=sections.Alerts.name)

        if events_index is None:
            self._log.warn('could not get events index from config')
        elif self.events_index is None:
            self.events_index = events_index
            self._log.info('got events index: "{0}"'.format(events_index))
        elif events_index != self.events_index:
            self.events_index = events_index
            raise SendlogError('events index changed to: "{0}", restarting sendlog'.format(events_index))

    def sync_events_index(self):
        if not isinstance(self._config.script_paths, tuple):
            return

        not_synced = False
        try:
            events_index = self.app_config.get_from_stanza('events_index', stanza=sections.Alerts.name)
            if events_index is None:
                self._log.warn('could not get inputs events index from config')
                return

            inputs_config = confs.Config(self._session_key, name='inputs')
            for script_path in self._config.script_paths:
                inputs_index = inputs_config.get_from_stanza('index', stanza=script_path)
                if events_index != inputs_index:
                    inputs_config.set_in_stanza('index', events_index, stanza=script_path)
                    not_synced = True
        except:
            self._log.warn('unable to synchronize events config with sendlog output')

        if not_synced:
            raise SendlogError('new inputs events index: "{0}", restarting sendlog'.format(events_index))

    def run_search(self):
        self.refresh_scope()
        self.period.check_ranges()

        query = self.get_query()
        search_id = self.search_id()

        self._log.info("running search ({0}) from: {1} ({2}), to: {3} ({4})".format(
            search_id, self.period.start_to_date(), self.period.start,
            self.period.end_to_date(), self.period.end))

        export = search.Export(self._session_key, self._config.rest_timeout)
        try:
            response = export.run(query, search_id)
        except Exception as exc:
            response = search.Response.empty()
            self._log.error(repr(exc))

        return response

    def refresh_scope(self):
        self.scope = scopes.Scope()

    def search_id(self):
        return "nba_sendlog_{0}_search".format(self._config.section)

    def process_result(self, result):
        indextime = self.parse_indextime(result)
        if indextime > self.last_indextime:
            self.last_indextime = indextime

        return self.parse_result(result)

    def wait_to_end(self):
        wait_time = self.period.wait_time()
        backlog = self.period.backlog()

        if self.period.slow_environment(backlog):
            self._log.ui_append(logger.MessageSlowEnvironment())

        if wait_time > 0:
            self._log.info("wait for {0} seconds".format(wait_time))
            time.sleep(wait_time)
        else:
            self._log.info("backlog: {0} seconds".format(backlog))

    def authorize_send(self):
        if not self.is_ready():
            return ""

        api_key = self.authorize()
        self.api_send_stored(api_key)

        if self.batch.is_empty():
            self.update_no_data_counter()
            self._log.warn('empty data batch')
        else:
            self.save_last_indextime()
            self.reset_no_data_counter()

            batch_sent = self.api_send(api_key, self.batch)
            if not batch_sent:
                self.storage.save(self.batch)

        self.after_send()
        sys.stdout.flush()
        self.batch.clear()

        self.log_empty_searches()
        self.events_index_changed()
        self.sync_events_index()
        self.save_ui_messages()

        return api_key

    def is_ready(self):
        ready, timeout = self.batch.ready()
        if not ready:
            return False

        if timeout:
            self._log.info("sending batch due to a batch timeout, runtime: {0}".format(self.batch.get_runtime()))
        else:
            self._log.info("sending batch due to a batch size limit, items: {0}".format(self.batch.len()))

        return True

    def update_no_data_counter(self):
        counter = self.get_no_data_counter()
        self.app_config.set('no_data_counter', counter + 1)

    def get_no_data_counter(self):
        try:
            counter = int(self.app_config.get('no_data_counter'))
        except:
            self._log.warn("could not get no_data_counter from config")
            counter = 0

        return counter

    def reset_no_data_counter(self):
        self.app_config.set('no_data_counter', 0)
        self.app_config.set_in_stanza('data_send', True, stanza=sections.NBA.stanza)

    def save_last_indextime(self):
        if self.last_indextime > 0:
            self.app_config.set('last_indextime', self.last_indextime)

    def get_events_pipeline(self):
        if self._config.section in [sections.DHCP.name, sections.VPN.name]:
            return "lease"

        return self._config.section

    def api_send(self, api_key, batch, unsent=False):
        details = batches.Details(batch.id)
        if not unsent:
            details.backlog = self.period.next_period_backlog()

        json_stream = batch.format_json_stream()
        alphasoc_api = api.API(self._session_key)
        response = alphasoc_api.events(api_key, self.get_events_pipeline(), json_stream, details)

        if api.API.server_error(response.code):
            self._log.warn("data batch({0}) unsent, code: {1}, backlog: {2}".format(
                batch.id, response.code, details.backlog))
            self._log.ui_append(logger.MessageAPIConnection(response.code))
            return False
        elif api.API.invalid_key_error(response.code):
            raise api.AuthError('API key is not valid')
        elif response.code == 200:
            self.print_batch_stats(response.stats, details)
            return True

        self._log.warn("data batch unsent and ignored, code {0}".format(response.code))
        self._log.ui_append(logger.MessageAPIConnection(response.code))

        return True

    def api_send_stored(self, api_key):
        stored_batches = self.storage.read()

        for batch in stored_batches:
            batch_sent = self.api_send(api_key, batch, unsent=True)
            if not batch_sent:
                self.storage.prepare_to_save(batch)

        self.storage.clear_commit_prepared()

    def print_batch_stats(self, response, details):
        if not response or not isinstance(response, dict):
            return

        try:
            response['ts'] = dateasoc.time_to_string()
            response['section'] = self._config.section
            response['type'] = 'stats_queries'

            event = json.dumps(response, separators=(', ', ':'))
            self._log.info('batch sent: {0}, backlog = {1}'.format(event, details.backlog))
            print(event)
        except:
            self._log.warn('could not format stats_queries event: {0}'.format(response))

    def log_empty_searches(self):
        if self.few_empty_searches():
            self._log.ui_append(logger.MessageEmptySearch())

    def few_empty_searches(self):
        last_data_time = self.get_last_indextime()
        if last_data_time is None or last_data_time == 0:
            return True

        no_data_counter = self.get_no_data_counter()
        return no_data_counter >= api.NO_DATA_THRESHOLD and self.empty_search_result

    def save_ui_messages(self):
        try:
            self._log.ui_save(self.app_config)
        except:
            self._log.warn("could not save ui data messages in app config")
