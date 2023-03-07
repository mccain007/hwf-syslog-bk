from abc import ABCMeta, abstractmethod
import json

import splunk.rest

from nbalib.asoc3 import six


class Item(six.with_metaclass(ABCMeta, object)):
    def __init__(self, name, key=None):
        self.name = name
        self.key = key or None

    @abstractmethod
    def update(self, values):
        pass

    @abstractmethod
    def as_store(self):
        pass


class Store(six.with_metaclass(ABCMeta, object)):
    def __init__(self, session_key, store_name):
        self._session_key = session_key
        self.path = (
            "/servicesNS/nobody/network_behavior_analytics"
            "/storage/collections/data/{0}".format(store_name)
        )

    @abstractmethod
    def item_from_store(self, row):
        pass

    @abstractmethod
    def item_from_api(self, name, row):
        pass

    def get(self):
        items = []

        stored_items = self._splunk_get()
        for raw_item in stored_items:
            try:
                item = self.item_from_store(raw_item)
            except:
                continue

            if isinstance(item, Item):
                items.append(item)

        return items

    def get_by_name(self):
        stored_items = self.get()
        return {item.name: item for item in stored_items}

    def _splunk_get(self):
        raw_response = None

        try:
            _, raw_response = splunk.rest.simpleRequest(self.path, self._session_key)
            response = json.loads(raw_response)
        except:
            raise ValueError("Unable to parse store content: {0}".format(raw_response))

        return response

    def replace(self, items):
        if not items or not isinstance(items, dict):
            return

        items_by_name = self.get_by_name()
        to_update = []

        for name, values in six.iteritems(items):
            item = items_by_name.get(name)
            if item:
                item.update(values)
                del items_by_name[name]
            else:
                item = self.item_from_api(name, values)

            if isinstance(item, Item):
                to_update.append(item.as_store())

        self._splunk_update(to_update)
        self.delete_names([item.name for item in six.itervalues(items_by_name)])

    def _splunk_update(self, items):
        if not items or not isinstance(items, list):
            return

        splunk.rest.simpleRequest(
            "{0}/batch_save".format(self.path),
            self._session_key,
            jsonargs=json.dumps(items),
        )

    def clear(self):
        splunk.rest.simpleRequest(self.path, self._session_key, method='DELETE')

    def delete(self, name):
        stored_items = self.get()
        for item in stored_items:
            if item.name == name:
                self._splunk_delete(item.key)
                return

    def delete_names(self, names, limit=100):
        if not names or not isinstance(names, list):
            return

        query = {"$or": []}
        for name in names[:limit]:
            query["$or"].append({"name": name})

        splunk.rest.simpleRequest(
            self.path,
            self._session_key,
            method='DELETE',
            getargs={"query": json.dumps(query)},
        )

    def _splunk_delete(self, key):
        if not isinstance(key, six.string_types):
            return

        splunk.rest.simpleRequest(
            "{0}/{1}".format(self.path, key),
            self._session_key,
            method='DELETE'
        )
