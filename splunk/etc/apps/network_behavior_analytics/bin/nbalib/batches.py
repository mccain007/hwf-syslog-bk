import os
import time
import json

from .asoc3.six.moves import cPickle as pickle


class Details(object):
    def __init__(self, batch_id):
        self.id = batch_id
        self.backlog = None


class Batch(object):
    def __init__(self, max_items, timeout):
        self.id = int(time.time() * 1000)

        self._max_items = max_items
        self._timeout = timeout

        self._init_time = time.time()
        self._items = []

    @classmethod
    def from_storage(cls, batch_id, items):
        batch = cls(0, 0)
        batch.id = batch_id
        batch.load_items(items)

        return batch

    def len(self):
        return len(self._items)

    def add(self, item):
        self._items.append(item)

    def ready(self):
        timeout = self.get_runtime() >= self._timeout
        return self.len() >= self._max_items or timeout, timeout

    def is_empty(self):
        return self.len() == 0

    def get_runtime(self):
        return time.time() - self._init_time

    def get_items(self):
        return self._items

    def load_items(self, items):
        self._items = items

    def format_json_stream(self, items=None):
        if items is None:
            items = self._items

        return "".join([json.dumps(item) for item in items])

    def clear(self):
        self._init_time = time.time()
        self._items = []

        self.id = int(self._init_time * 1000)


class Pickle(object):
    def __init__(self, section, max_batches, max_items):
        self.max_batches = max_batches
        self.max_items = max_items

        self._path = self.pickle_path(section)
        self._temp = []

    @staticmethod
    def pickle_path(section):
        current_dir = os.path.dirname(os.path.join(os.getcwd(), __file__))
        return os.path.join(current_dir, '..', "unsentbatches_" + section + ".pickle")

    def save(self, batch):
        batches = self._load()
        batches.insert(0, self._format(batch))
        batches = self._trim(batches)

        self._commit(batches)

    def read(self):
        saved_batches = self._load()
        saved_batches.reverse()
        batches = []

        for saved_batch in saved_batches:
            batch = Batch.from_storage(saved_batch['id'], saved_batch['data'])
            batches.append(batch)

        return batches

    def prepare_to_save(self, batch):
        self._temp.insert(0, self._format(batch))

    def clear_commit_prepared(self):
        batches = self._trim(self._temp)
        self._commit(batches)
        self._temp = []

    @staticmethod
    def _format(batch):
        return {'id': batch.id, 'data': batch.get_items()}

    def _commit(self, batches):
        with open(self._path, "wb") as file_pickle:
            pickle.dump(batches, file_pickle, -1)

    def _load(self):
        try:
            with open(self._path, "rb") as file_pickle:
                return pickle.load(file_pickle)
        except:
            return []

    def _trim(self, unsent):
        batch_number = 0
        batch_items = 0

        for batch_number, batch in enumerate(unsent):
            batch_items += len(batch['data'])
            if batch_number >= (self.max_batches - 1) or batch_items >= self.max_items:
                break

        return unsent[:batch_number + 1]
