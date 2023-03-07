import sys
import traceback

import splunk.auth

from nbalib import sections
from nbalib import sendlog
from nbalib import logger
from nbalib import period
from nbalib import confs
from nbalib import api

from nbalib.asoc3 import six

VPN_SENDLOG_SCRIPT_FILES = (
    "script://./bin/nba_sendlog_vpn.py",
    "script://.\\bin\\nba_sendlog_vpn.py",
)


class SendlogVPN(sendlog.Sendlog):
    def __init__(self, config, period_config, session_key, log):
        super(SendlogVPN, self).__init__(config, period_config, session_key, log)

        self.in_scope = 0
        self.out_scope = 0
        self.invalid_events = 0
        self.no_leases = 0

    def get_query(self):
        tags = 'tag="network" tag="session" tag="vpn"'
        logs_index = self.get_logs_index('nbalogsindexvpn')
        timeranges = self.format_timeranges()

        return (
            'search {0} {1} {2} _indextime > {3} _indextime <= {4} '
            '| eval dest_ip = if(isnull(dest_ip), dest, dest_ip) '
            '| eval time = strftime(_time, "%Y-%m-%dT%H:%M:%S%z") '
            '| eval tags = mvjoin(\'tag\', ",") '
            '| table _indextime, time, dest_ip, dest_nt_host, dest_mac, user, tags'
        ).format(logs_index, tags, timeranges, self.period.start, self.period.end)

    def parse_indextime(self, result):
        return self.get_indextime(result.get('_indextime'))

    def parse_result(self, result):
        src_ip = result.get('dest_ip', '')
        if not src_ip:
            self.invalid_events += 1
            return None

        scope_groups = self.scope.in_scope(src_ip)
        if not scope_groups:
            self.out_scope += 1
            return None
        self.in_scope += 1

        if not self.is_lease(result):
            self.no_leases += 1
            return None

        api_log = self._create_api_log(src_ip, result)
        return api_log.content

    @staticmethod
    def is_lease(result):
        tags = result.get('tags')
        if isinstance(tags, six.string_types):
            for tag in tags[:100].split(","):
                if tag.lower() == "start":
                    return True
                elif tag.lower() == "end":
                    result['termination'] = True
                    return True

        return False

    @staticmethod
    def _create_api_log(src_ip, result):
        api_log = sendlog.APILog()

        api_log.set('type', sections.VPN.name)
        api_log.set('ts', result.get('time', ''))

        api_log.set('srcIP', src_ip)
        api_log.set_non_empty('srcHost', result.get('dest_nt_host'))
        api_log.set_non_empty('srcMac', result.get('dest_mac'))
        api_log.set_non_empty('srcUser', result.get('user'))

        api_log.set('termination', result.get('termination', False))

        return api_log

    def after_send(self):
        self._log_metrics()

    def _log_metrics(self):
        self._log.info((
            "events passed through the monitoring scopes: {0}, "
            "events filtered out: {1}, invalid events: {2}, no leases {3}"
        ).format(self.in_scope, self.out_scope, self.invalid_events, self.no_leases))

        if self.out_scope > 0 and self.in_scope == 0:
            self._log.ui_append(logger.MessageOutOfScope())

        if self.invalid_events > 0 and self.in_scope == 0:
            self._log.ui_append(logger.MessageInvalidLogs())

        self.in_scope = 0
        self.out_scope = 0
        self.invalid_events = 0
        self.no_leases = 0


def save_data_messages(log, session_key):
    config = confs.Config(session_key, stanza=sections.VPN.name)
    log.ui_save(config)


def main(log):
    log.info("--- sendlog start")

    # If the script is called by splunk, session key is passed in stdin
    if len(sys.argv) > 1:
        session_key = splunk.auth.getSessionKey(sys.argv[1], sys.argv[2])
    else:
        session_key = sys.stdin.readline()
    log.info("got session key")

    try:
        sendlog_config = sendlog.Config(sections.VPN.name, script_paths=VPN_SENDLOG_SCRIPT_FILES)
        period_config = period.Config()

        sendlog_vpn = SendlogVPN(sendlog_config, period_config, session_key, log)
        log.info("sendlog created")

        sendlog_vpn.run()
    except (sendlog.SendlogError, api.MasterNodeError) as exc:
        log.warn(repr(exc))
        save_data_messages(log, session_key)
    except api.AuthError as exc:
        log.warn(repr(exc))
        log.ui_append(logger.MessageUnauthorizedAPI(exc.api_messages))
        save_data_messages(log, session_key)
    except confs.PerrmisionException as exc:
        log.error(repr(exc))
        log.ui_append(logger.MessageUnauthorizedSplunk())
        save_data_messages(log, session_key)
    except Exception as exc:
        log.error(repr(exc))
        log.error(traceback.format_exc())
        log.ui_append(logger.MessageUnexpectedError(repr(exc)))
        save_data_messages(log, session_key)

    log.info("sendlog exit")


if __name__ == "__main__":
    LOGGER = logger.LoggerUI.setup_logger(sections.NBA.name, "sendlog_vpn")

    try:
        main(LOGGER)
    except Exception as exc:
        LOGGER.error(repr(exc))
        LOGGER.error(traceback.format_exc())
