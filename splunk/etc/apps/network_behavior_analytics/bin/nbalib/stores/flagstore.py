from . import base

STORE_NAME = "asocnbaflags"

FLAG_TYPE_CATEGORY = "category"
FLAG_TYPE_FEATURE = "feature"


class FlagStore(base.Store):
    def __init__(self, session_key, store_name=None):
        super(FlagStore, self).__init__(session_key, store_name or STORE_NAME)

    def item_from_store(self, row):
        return Flag.from_store(row)

    def item_from_api(self, name, row):
        return Flag.from_api(name, row)


class Flag(base.Item):
    def __init__(self, name, title, ftype, key=None):
        super(Flag, self).__init__(name, key)

        self.title = title or ''
        self.type = ftype or ''

    def __repr__(self):
        return "<Flag: {0} ({1}, {2}, {3})>".format(self.name, self.title, self.type, self.key)

    @classmethod
    def from_store(cls, row):
        return cls(row['name'], row.get('title', ''), row.get('type', ''), row['_key'])

    @classmethod
    def from_api(cls, name, values):
        threat = cls(name, values.get('title', ''), values.get('type', ''))
        threat.update(values)

        return threat

    def update(self, values):
        title = values.get('title')
        if title:
            self.title = title

        ftype = values.get('type')
        if ftype:
            self.type = ftype

    def as_store(self):
        value = {
            'name': self.name,
            'title': self.title,
            'type': self.type,
        }

        if self.key:
            value['_key'] = self.key

        return value
