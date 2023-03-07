from . import sections
from . import alerts
from . import scopes

from .stores import flagstore


class Anomaly(object):
    def __init__(self, section):
        self._section = section
        self._alerts = []

    def detect(self, log, groups, scope, dest_is_ip=False):
        if self._section == sections.DNS.name:
            alert = self._detect_dns(log, groups, scope)
        elif self._section == sections.IP.name:
            alert = self._detect_ip(log, groups, scope)
        elif self._section == sections.HTTP.name:
            alert = self._detect_http(log, groups, scope, dest_is_ip)
        elif self._section == sections.TLS.name:
            alert = self._detect_tls(log, groups, scope)
        else:
            alert = None

        if isinstance(alert, alerts.Alert):
            self._alerts.append(alert)

    def _detect_dns(self, log, groups, scope):
        if not scope.anomaly_groups_enabled(groups, scopes.EntryType.TRUSTED_DOMAINS):
            return None

        api_alert = self._create_api_alert(log)
        return alerts.AlertDNS(api_alert, scope, AnomalyThreat.repr())

    def _detect_ip(self, log, groups, scope):
        if not scope.anomaly_groups_enabled(groups, scopes.EntryType.TRUSTED_IPS):
            return None

        api_alert = self._create_api_alert(log)
        return alerts.AlertIP(api_alert, scope, AnomalyThreat.repr())

    def _detect_http(self, log, groups, scope, dest_is_ip):
        entry_type = scopes.EntryType.TRUSTED_IPS if dest_is_ip else scopes.EntryType.TRUSTED_DOMAINS
        if not scope.anomaly_groups_enabled(groups, entry_type):
            return None

        api_alert = self._create_api_alert(log)
        return alerts.AlertHTTP(api_alert, scope, AnomalyThreat.repr())

    def _detect_tls(self, log, groups, scope):
        if not scope.anomaly_groups_enabled(groups, scopes.EntryType.TRUSTED_IPS):
            return None

        api_alert = self._create_api_alert(log)
        return alerts.AlertTLS(api_alert, scope, AnomalyThreat.repr())

    def _create_api_alert(self, log):
        return {
            "eventType": self._section,
            "event": log,
            "threats": [AnomalyThreat.id],
            "wisdom": {
                "flags": AnomalyThreat.flags,
            }
        }

    def emit(self):
        if not self._alerts:
            return 0

        emmited_alerts = 0
        self.sort()

        for alert in self._alerts:
            printed = self._print_alert(alert)
            if printed:
                emmited_alerts += 1

        self.clear()

        return emmited_alerts

    def sort(self):
        self._alerts.sort(key=lambda alert: alert.get_event_date())

    @staticmethod
    def _print_alert(alert):
        printed = True
        try:
            print(alert.dumps())
        except:
            printed = False

        return printed

    def clear(self):
        self._alerts = []


class AnomalyThreat(object):
    id = "non_whitelisted"
    title = "Accessing a non-whitelisted destination (anomaly detection)"

    severity = 4
    policy = False

    flags = ["non_whitelisted"]

    @classmethod
    def repr(cls):
        return {
            cls.id: {
                'severity': cls.severity,
                'title': cls.title,
                "policy": cls.policy
            }
        }

    @classmethod
    def append_to_threats(cls, threats):
        if not isinstance(threats, dict):
            threats = {}

        threats[cls.id] = {
            'severity': cls.severity,
            'title': cls.title,
            "policy": cls.policy
        }

        return threats


class AnomalyFlag(object):
    id = "non_whitelisted"
    title = "Destination is not whitelisted"
    ftype = flagstore.FLAG_TYPE_FEATURE

    @classmethod
    def repr(cls):
        return {
            cls.id: {
                'title': cls.title,
                'type': cls.ftype,
            }
        }

    @classmethod
    def append_to_flags(cls, flags):
        if not isinstance(flags, dict):
            flags = {}

        flags[cls.id] = {
            'title': cls.title,
            'type': cls.ftype,
        }

        return flags
