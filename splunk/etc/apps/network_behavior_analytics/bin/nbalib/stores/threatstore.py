from . import base

STORE_NAME = "asocnbathreats"


class ThreatStore(base.Store):
    def __init__(self, session_key, store_name=None):
        super(ThreatStore, self).__init__(session_key, store_name or STORE_NAME)

    def item_from_store(self, row):
        return Threat.from_store(row)

    def item_from_api(self, name, row):
        return Threat.from_api(name, row)


class Threat(base.Item):
    def __init__(self, name, severity, title=None, key=None, show=True, policy=False):
        super(Threat, self).__init__(name, key)

        self.severity = severity
        self.title = title or name
        self.show = show if show is not None else True
        self.policy = policy

    def __repr__(self):
        return "<Threat: {0} ({1}, {2}, {3}, {4}, {5})>".format(
            self.name, self.severity, self.title, self.show, self.policy, self.key
        )

    @classmethod
    def from_store(cls, row):
        threat = cls(row['name'], row['severity'], row['title'], row['_key'])
        threat.show = row.get('show', True)
        threat.policy = row.get('policy', False)

        return threat

    @classmethod
    def from_api(cls, name, values):
        severity = values.get('severity')
        if not isinstance(severity, (float, int)):
            return None

        threat = cls(name, severity)
        threat.update(values)

        return threat

    def update(self, values):
        severity = values.get('severity')
        if isinstance(severity, (float, int)):
            self.severity = severity

        title = values.get('title')
        if title:
            self.title = title

        self.policy = values.get('policy', False)

    def as_store(self):
        value = {
            'name': self.name,
            'severity': self.severity,
            'title': self.title,
            'show': self.show,
            'policy': self.policy,
        }

        if self.key:
            value['_key'] = self.key

        return value
