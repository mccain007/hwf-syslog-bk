import json

import splunk.bundle
import splunk.rest

from . import sections

from .asoc3 import six


class PerrmisionException(Exception):
    pass


class ParsingException(Exception):
    pass


class Config(object):
    def __init__(self, session_key, name=None, stanza=None):
        self.name = name if name is not None else sections.NBA.config

        self._app = sections.NBA.name
        self._session_key = session_key
        self._default_stanza = stanza if stanza is not None else sections.NBA.stanza

        self._config = self._get_config()

    def _get_config(self):
        return splunk.bundle.getConf(self.name, self._session_key, self._app, owner='nobody')

    def refresh(self):
        self._config = self._get_config()

    def get(self, key, default=None):
        return self.get_from_stanza(key, default)

    def set(self, key, value):
        self.set_in_stanza(key, value)

    def get_from_stanza(self, key, default=None, stanza=None):
        if stanza is None:
            stanza = self._default_stanza

        if stanza not in self._config:
            raise ValueError("stanza '{0}' not found in config".format(stanza))

        return self._config[stanza].get(key, default)

    def set_in_stanza(self, key, value, stanza=None):
        if stanza is None:
            stanza = self._default_stanza

        if stanza not in self._config:
            raise ValueError("stanza '{0}' not found in config".format(stanza))

        if isinstance(value, bool):
            value = int(value)

        self._config[stanza][key] = str(value)

    def is_enabled(self, key, default=False, stanza=None):
        value = self.get_from_stanza(key, stanza=stanza)
        if value is None:
            return default

        if isinstance(value, six.string_types):
            return value.lower() in ("1", "true")

        return value == 1

    def begin_batch(self):
        self._config.beginBatch()

    def commit(self):
        self._config.commitBatch()


class StoragePasswords(object):
    def __init__(self, session_key):
        self._app = sections.NBA.name
        self._session_key = session_key

        self._rest_path = self._init_rest_path()

    def _init_rest_path(self):
        return '/servicesNS/nobody/{0}/storage/passwords/'.format(self._app)

    def set(self, key, value):
        try:
            splunk.rest.simpleRequest(
                self._rest_path + key,
                sessionKey=self._session_key,
                postargs={'password': value},
                method='POST'
            )
        except splunk.AuthorizationFailed:
            raise PerrmisionException("Unable to save value in storage/passwords REST endpoint.")
        except Exception as exc:
            raise exc

    def get(self, key):
        try:
            _, content = splunk.rest.simpleRequest(
                self._rest_path + key,
                sessionKey=self._session_key,
                getargs={'output_mode': 'json'},
                method='GET'
            )
        except splunk.AuthorizationFailed:
            raise PerrmisionException("Unable to get value from storage/passwords REST endpoint.")
        except Exception as exc:
            raise exc

        try:
            return json.loads(content)['entry'][0]['content'].get('clear_password', '')
        except:
            raise ParsingException('Unable to parse JSON response from storage/passwords REST endpoint.')

    def set_api_key(self, value):
        self.set('asoc_nba_api_key', value)

    def get_api_key(self):
        return self.get('asoc_nba_api_key')
