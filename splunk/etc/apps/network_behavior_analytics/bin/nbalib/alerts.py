import calendar
import json

from . import sections
from . import dateasoc
from . import scopes
from . import datatypes
from . import confs

from .asoc3 import six

SPLUNK_EVENT_APP_NAME = "alphasoc:nba"
SPLUNK_EVENT_TYPE = "alert"


class FormatError(Exception):
    pass


class InvalidSourceDisplayType(Exception):
    pass


class SourceDisplayStorage(object):
    default_type = "hostname"
    custom_type = "custom"

    _type2search = {
        default_type: "coalesce(src_host,src_ip)",
        "ip": "src_ip",
        custom_type: "",
    }

    def __init__(self, session_key):
        self.session_key = session_key

    def get_type(self):
        sdtype = self._config_get_type()
        if self._type2search.get(sdtype) is None:
            raise InvalidSourceDisplayType

        return sdtype

    def save(self, sdtype):
        search = self._type2search.get(sdtype)
        if not search:
            raise InvalidSourceDisplayType

        self._config_update(sdtype, search)

    def sync(self):
        is_invalid = False

        try:
            sdtype = self.get_type()
        except InvalidSourceDisplayType:
            sdtype = self.default_type
            is_invalid = True

        if sdtype == self.custom_type:
            return

        search = self._type2search.get(sdtype, "")
        saved_search = self._config_get_search()

        if is_invalid or search != saved_search:
            self._config_update(sdtype, search)

    def _config_prop_init(self):
        return confs.Config(self.session_key, name="props", stanza="asoc:nba:event")

    def _config_nba_init(self):
        return confs.Config(self.session_key, stanza="alerts")

    def _config_get_type(self):
        app_config = self._config_nba_init()
        return app_config.get("source_display", default="")

    def _config_get_search(self):
        prop_config = self._config_prop_init()
        return prop_config.get("EVAL-src_disp", default="")

    def _config_update(self, sdtype, search):
        prop_config = self._config_prop_init()
        app_config = self._config_nba_init()

        prop_config.set("EVAL-src_disp", search)
        app_config.set("source_display", sdtype)


class Batch(object):
    def __init__(self, scope=None, threats=None):
        self._scope = scopes.Scope() if scope is None else scope
        self._threats = {} if threats is None else threats

        self._alerts = []
        self._iter_counter = 0

    def __len__(self):
        return len(self._alerts)

    def __iter__(self):
        self._iter_counter = 0
        return self

    def _create_alert(self, api_alert):
        if api_alert is None or not isinstance(api_alert, dict):
            raise FormatError("API alert is not a dict: {0}".format(type(api_alert)))

        section = api_alert.get('eventType')
        if section == sections.DNS.name:
            alert = AlertDNS(api_alert, self._scope, self._threats)
        elif section == sections.IP.name:
            alert = AlertIP(api_alert, self._scope, self._threats)
        elif section == sections.HTTP.name:
            alert = AlertHTTP(api_alert, self._scope, self._threats)
        elif section == sections.TLS.name:
            alert = AlertTLS(api_alert, self._scope, self._threats)
        else:
            raise FormatError("Unrecognized event type")

        return alert

    def __next__(self):
        if self._iter_counter >= len(self._alerts):
            raise StopIteration

        result = self._alerts[self._iter_counter]
        self._iter_counter += 1

        return result

    next = __next__  # Python 2

    def add(self, api_alert):
        alert = self._create_alert(api_alert)
        self._alerts.append(alert)

    def sort(self):
        self._alerts.sort(key=lambda alert: alert.get_event_date())


class Date(object):
    def __init__(self, event_date, string_date):
        self.event = event_date
        self.string = string_date

    @classmethod
    def from_event(cls, event):
        ts = event.get("ts")
        if ts is None:
            raise FormatError("Event does not contain timestamp")

        local_date = dateasoc.iso8601_to_date(ts)
        if local_date is not None:
            event_date = local_date
            string_date = dateasoc.date_to_string(local_date)
        else:
            event_date = dateasoc.utc_now()
            string_date = ts

        return cls(event_date, string_date)


class Alert(object):
    SEVERITIES = {1: 'informational', 2: 'low', 3: 'medium', 4: 'high', 5: 'critical'}

    def __init__(self, api_alert, threats):
        self._event = self._parse_event(api_alert)
        self._date = Date.from_event(self._event)

        threats_ids = self._parse_threats(api_alert)

        self._alert = {
            'app': SPLUNK_EVENT_APP_NAME,
            'details': {},
            'original_event': self._date.string,
            'src_groups': [],
            'threats': threats_ids,
            'ts': dateasoc.time_to_string(),
            'type': SPLUNK_EVENT_TYPE,
            'wisdom': self._parse_wisdom(api_alert),
        }

        labels = self._event.get('labels', None)
        if labels:
            self._alert['labels'] = labels

        self._append_top_threat(threats_ids, threats)

    @staticmethod
    def _parse_event(api_alert):
        event = api_alert.get("event")
        if event is None or not isinstance(event, dict):
            raise FormatError("Event not found in API alert")

        return event

    @staticmethod
    def _parse_threats(api_alert):
        return api_alert.get("threats", [])

    @staticmethod
    def _parse_wisdom(api_alert):
        return api_alert.get('wisdom', {})

    @staticmethod
    def lower_fields(source, fields):
        for field in fields:
            field_value = source.get(field)
            if isinstance(field_value, six.string_types):
                source[field] = field_value.lower()

        return source

    def get_event_date(self):
        return self._date.event

    def dumps(self):
        try:
            json_alert = json.dumps(self._alert, separators=(', ', ':'))
        except:
            raise FormatError("JSON dumps error: {0}".format(self._alert))

        return json_alert

    def _append_groups(self, src_ip, scope, query=None, dest_ip=None):
        if src_ip is None:
            return

        groups = list(scope.in_scope(src_ip, fqdn=query, dest_ip=dest_ip))
        if groups:
            self._alert["src_groups"] = groups

    def _append_field_alert(self, source, source_key, dest_key=None):
        self._append_field(source, source_key, self._alert, dest_key)

    def _append_field_details(self, source, source_key, dest_key=None):
        self._append_field(source, source_key, self._alert['details'], dest_key)

    @staticmethod
    def _append_field(source, source_key, dest, dest_key=None):
        if dest_key is None:
            dest_key = source_key

        field = source.get(source_key)
        if isinstance(field, six.string_types):
            if field:
                dest[dest_key] = field
        elif field is not None:
            dest[dest_key] = field

    @staticmethod
    def append_unix_from_date(source, source_key, dest, dest_key=None):
        if dest_key is None:
            dest_key = source_key

        field = source.get(source_key)
        try:
            date = dateasoc.iso8601_to_date(field)
            unixdate = calendar.timegm(date.utctimetuple())
        except:
            unixdate = 0

        if unixdate > 0:
            dest[dest_key] = unixdate

    def _append_top_threat(self, threats_ids, threats):
        try:
            top_threat = self.top_threat(threats_ids, threats)
        except:
            return

        if not isinstance(top_threat, dict):
            return

        severity_id = top_threat.get('severity', 0)
        self._alert['severity_id'] = severity_id

        severity = self.SEVERITIES.get(severity_id)
        if severity:
            self._alert['severity'] = severity

        title = top_threat.get('title')
        if title:
            self._alert['subject'] = title

    @staticmethod
    def top_threat(threats_ids, threats):
        top_threat = {}

        for threat_id in threats_ids:
            threat = threats.get(threat_id)
            if not isinstance(threat, dict):
                continue

            try:
                if int(top_threat.get('severity', 0)) < int(threat.get('severity', 0)):
                    top_threat = threat
            except ValueError:
                continue

        return top_threat if top_threat else None


class AlertDNS(Alert):
    def __init__(self, api_alert, scope, threats):
        super(AlertDNS, self).__init__(api_alert, threats)

        self._map_fields(scope)
        self._normalize_fields()

    def _map_fields(self, scope):
        self._alert['section'] = sections.DNS.name

        self._append_field_alert(self._event, "srcIP", "src_ip")
        self._append_field_alert(self._event, "srcID", "src_id")
        self._append_field_alert(self._event, "srcHost", "src_host")
        self._append_field_alert(self._event, "srcMac", "src_mac")
        self._append_field_alert(self._event, "srcUser", "src_user")
        self._append_field_alert(self._event, "connID", "connection_id")
        self._append_field_alert(self._event, "query", "dest_host")

        self._map_fields_details()
        self._append_scope(scope)

    def _map_fields_details(self):
        self._append_field_details(self._event, "qtype", "record_type")
        self._append_field_details(self._event, "rcode", "reply_code")

    def _append_scope(self, scope):
        src_ip = self._alert.get("src_ip")
        query = self._alert.get("dest_host")

        self._append_groups(src_ip, scope, query=query)

    def _normalize_fields(self):
        self.lower_fields(self._alert, ['src_ip', 'dest_host'])


class AlertIP(Alert):
    def __init__(self, api_alert, scope, threats):
        super(AlertIP, self).__init__(api_alert, threats)

        self._map_fields(scope)
        self._normalize_fields()

    def _map_fields(self, scope):
        self._alert['section'] = sections.IP.name

        self._append_field_alert(self._event, "srcIP", "src_ip")
        self._append_field_alert(self._event, "srcPort", "src_port")
        self._append_field_alert(self._event, "srcID", "src_id")
        self._append_field_alert(self._event, "srcHost", "src_host")
        self._append_field_alert(self._event, "srcMac", "src_mac")
        self._append_field_alert(self._event, "srcUser", "src_user")
        self._append_field_alert(self._event, "connID", "connection_id")
        self._append_field_alert(self._event, "destIP", "dest_ip")
        self._append_field_alert(self._event, "destPort", "dest_port")

        self._map_fields_details()
        self._append_scope(scope)

    def _map_fields_details(self):
        self._append_field_details(self._event, "bytesIn", "bytes_in")
        self._append_field_details(self._event, "bytesOut", "bytes_out")
        self._append_field_details(self._event, "proto", "transport")
        self._append_field_details(self._event, "app")
        self._append_field_details(self._event, "action")
        self._append_field_details(self._event, "duration")

    def _append_scope(self, scope):
        src_ip = self._alert.get("src_ip")
        dest_ip = self._alert.get("dest_ip")

        self._append_groups(src_ip, scope, dest_ip=dest_ip)

    def _normalize_fields(self):
        self.lower_fields(self._alert, ['src_ip', 'dest_ip'])


class AlertHTTP(Alert):
    def __init__(self, api_alert, scope, threats):
        super(AlertHTTP, self).__init__(api_alert, threats)

        self.parsed_dest_url = datatypes.URL(self._event.get("url"))

        self._map_fields(scope)
        self._normalize_fields()

    def _map_fields(self, scope):
        self._alert['section'] = sections.HTTP.name

        self._append_field_alert(self._event, "srcIP", "src_ip")
        self._append_field_alert(self._event, "srcID", "src_id")
        self._append_field_alert(self._event, "srcHost", "src_host")
        self._append_field_alert(self._event, "srcMac", "src_mac")
        self._append_field_alert(self._event, "srcUser", "src_user")
        self._append_field_alert(self._event, "connID", "connection_id")
        self._append_field_alert(self._event, "url", "dest_url")

        self._append_dest_hostname()

        self._map_fields_details()
        self._append_scope(scope)

    def _append_dest_hostname(self):
        if not self.parsed_dest_url.is_valid:
            return

        if self.parsed_dest_url.is_ip:
            self._alert['dest_ip'] = self.parsed_dest_url.hostname
        else:
            self._alert['dest_host'] = self.parsed_dest_url.hostname

    def _map_fields_details(self):
        self._append_field_details(self._event, "app")
        self._append_field_details(self._event, "action")
        self._append_field_details(self._event, "status")

        self._append_field_details(self._event, "bytesIn", "bytes_in")
        self._append_field_details(self._event, "bytesOut", "bytes_out")

        self._append_field_details(self._event, "contentType", "http_content_type")
        self._append_field_details(self._event, "method", "http_method")
        self._append_field_details(self._event, "referrer", "http_referrer")
        self._append_field_details(self._event, "userAgent", "http_user_agent")

    def _append_scope(self, scope):
        src_ip = self._alert.get("src_ip")

        if self.parsed_dest_url.is_ip:
            self._append_groups(src_ip, scope, dest_ip=self.parsed_dest_url.hostname)
        else:
            self._append_groups(src_ip, scope, query=self.parsed_dest_url.hostname)

    def _normalize_fields(self):
        self.lower_fields(self._alert, ['src_ip'])
        self._clear_urls()

    def _clear_urls(self):
        try:
            clean_dest_url = self.parsed_dest_url.get_cleaned_url()
            if clean_dest_url:
                self._alert['dest_url'] = clean_dest_url

            if 'http_referrer' in self._alert['details']:
                parsed_referrer_url = datatypes.URL(self._alert['details']['http_referrer'])
                self._alert['details']['http_referrer'] = parsed_referrer_url.get_cleaned_url()
        except:
            pass


class AlertTLS(Alert):
    def __init__(self, api_alert, scope, threats):
        super(AlertTLS, self).__init__(api_alert, threats)

        self._map_fields(scope)
        self._normalize_fields()

    def _map_fields(self, scope):
        self._alert['section'] = sections.TLS.name

        self._append_field_alert(self._event, "srcIP", "src_ip")
        self._append_field_alert(self._event, "srcPort", "src_port")
        self._append_field_alert(self._event, "srcID", "src_id")
        self._append_field_alert(self._event, "srcHost", "src_host")
        self._append_field_alert(self._event, "srcMac", "src_mac")
        self._append_field_alert(self._event, "srcUser", "src_user")
        self._append_field_alert(self._event, "connID", "connection_id")

        self._append_field_alert(self._event, "destIP", "dest_ip")
        self._append_field_alert(self._event, "destPort", "dest_port")

        self._map_fields_details()
        self._append_scope(scope)

    def _map_fields_details(self):
        self._append_field_details(self._event, "certHash", "ssl_hash")
        self._append_field_details(self._event, "ja3", "ja3")
        self._append_field_details(self._event, "ja3s", "ja3s")

        self._append_field_details(self._event, "issuer", "ssl_issuer")
        self._append_field_details(self._event, "subject", "ssl_subject")

        self.append_unix_from_date(self._event, "validFrom", self._alert['details'], "ssl_start_time")
        self.append_unix_from_date(self._event, "validTo", self._alert['details'], "ssl_end_time")

    def _append_scope(self, scope):
        src_ip = self._alert.get("src_ip")
        dest_ip = self._alert.get("dest_ip")

        self._append_groups(src_ip, scope, dest_ip=dest_ip)

    def _normalize_fields(self):
        self.lower_fields(self._alert, ['src_ip', 'dest_ip'])
