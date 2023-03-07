import os
import uuid
import json
import platform

import splunk

from . import request
from . import validators
from . import sections
from . import confs

from .asoc3.six.moves import urllib_parse
from .asoc3 import six


DEFAULT_API_URL = "https://api.alphasoc.net/"
NO_DATA_THRESHOLD = 6


class AuthError(Exception):
    def __init__(self, message, api_messages=None):
        super(AuthError, self).__init__(message)

        if isinstance(api_messages, list):
            self.api_messages = api_messages
        else:
            self.api_messages = []


class MasterNodeError(Exception):
    pass


class Auth(object):
    def __init__(self, session_key):
        self._session_key = session_key
        self._stanza = sections.NBA.stanza

    def account_status(self, config, check_master_node=False):
        api_key = self.get_api_key(config, check_master_node)
        account_status = self._fetch_account_status(api_key, config)

        if not account_status.valid:
            raise AuthError('API key is not valid', account_status.messages)

        return AccountDetails(api_key, account_status)

    def get_api_key(self, config, check_master_node=False):
        if check_master_node and not config.is_enabled('master_node', stanza=self._stanza):
            raise MasterNodeError('Not a master node')

        return self._parse_api_key(config)

    def _parse_api_key(self, config):
        storage = confs.StoragePasswords(self._session_key)
        api_key = storage.get_api_key()

        if not api_key or not isinstance(api_key, six.string_types):
            config.set_in_stanza('api_key_valid', False, stanza=self._stanza)
            config.set_in_stanza('api_key_registered', False, stanza=self._stanza)
            Messages.set([], config)

            raise AuthError('API key not found in config')

        return api_key

    def _fetch_account_status(self, api_key, config):
        api = API(self._session_key)
        account_status = api.account_status(api_key)

        config.set_in_stanza('api_key_valid', account_status.valid, stanza=self._stanza)
        config.set_in_stanza('api_key_registered', account_status.registered, stanza=self._stanza)
        Messages.set(account_status.messages, config)

        return account_status


class AccountDetails(object):
    def __init__(self, api_key, account_status):
        self.api_key = api_key
        self.licensing = account_status.licensing


class Connection(object):
    def __init__(self, url, ssl_verify, proxy_address):
        self.url = url
        self.ssl_verify = ssl_verify
        self.proxy_address = proxy_address

    @classmethod
    def default(cls, path):
        url = cls.format_url(DEFAULT_API_URL, path)
        ssl_verify = True
        proxy_address = None

        return cls(url, ssl_verify, proxy_address)

    @classmethod
    def from_config(cls, path, config, sp):
        url = cls.prepare_url(path, config)
        ssl_verify = cls.ssl_verify_enabled(config)
        proxy_address = cls.get_proxy_address(config, sp)

        return cls(url, ssl_verify, proxy_address)

    @classmethod
    def prepare_url(cls, path, config):
        url = DEFAULT_API_URL

        custom_url = cls._get_custom_url(config)
        if custom_url:
            url = custom_url

        return cls.format_url(url, path)

    @staticmethod
    def format_url(url, path):
        if not url.endswith('/'):
            url += '/'

        if path.startswith("/"):
            path = path[1:]

        return url + path

    @staticmethod
    def ssl_verify_enabled(config):
        if config.is_enabled('api_on_premise'):
            config_key = "ssl_verify_on_premise"
        else:
            config_key = "ssl_verify_cloud"

        return config.is_enabled(config_key, True)

    @classmethod
    def get_proxy_address(cls, config, sp):
        address = config.get('proxy_address')
        if not address:
            return address

        if config.is_enabled('proxy_requires_password'):
            username = config.get('proxy_username', '')
            password = sp.get('asoc_nba_proxy_password')

            address = cls.proxy_append_credentials(address, username, password)

        return address

    @staticmethod
    def proxy_append_credentials(address, username, password):
        if not isinstance(address, six.string_types):
            address = ""

        if not isinstance(username, six.string_types):
            username = ""

        if not isinstance(password, six.string_types):
            password = ""

        username = urllib_parse.quote(username, safe='')
        password = urllib_parse.quote(password, safe='')

        if not username and not password:
            return address

        proxy = list(urllib_parse.urlsplit(address))
        proxy[1] = "{0}:{1}@{2}".format(username, password, proxy[1])

        return urllib_parse.urlunsplit(proxy)

    @staticmethod
    def _get_custom_url(config):
        if not config.is_enabled('api_on_premise'):
            return None

        return config.get('api_url')


class Messages(object):
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3

    @staticmethod
    def get(config):
        raw = config.get_from_stanza('api_messages', stanza=sections.NBA.stanza)

        try:
            api_messages = json.loads(raw)
            if not isinstance(api_messages, list):
                raise ValueError()
        except:
            api_messages = [{'level': Messages.ERROR, 'body': 'Error parsing API messages.'}]

        return api_messages

    @staticmethod
    def set(value, config):
        try:
            messages = json.dumps(value).replace("\n", " ")
        except:
            messages = json.dumps([{'level': 3, 'body': u"API Error: Failed to parse the server response."}])

        config.set_in_stanza('api_messages', messages, stanza=sections.NBA.stanza)


class Settings(object):
    @staticmethod
    def get_connection_settings(path, session_key):
        try:
            config = confs.Config(session_key)
            sp = confs.StoragePasswords(session_key)

            return Connection.from_config(path, config, sp)
        except:
            return Connection.default(path)

    @staticmethod
    def prepare_headers(custom_headers=None):
        headers = custom_headers if isinstance(custom_headers, dict) else {}
        headers['User-Agent'] = Settings.get_user_agent()
        headers['Accept-Encoding'] = "gzip"

        appuuid = Settings.get_appuuid()
        if appuuid is not None:
            headers['X-AlphaSOC-App-Uuid'] = appuuid

        return headers

    @staticmethod
    def get_user_agent():
        user_agent = "{0}/{1}".format(sections.NBA.user_agent, sections.NBA.version)

        splunk_version = Settings.get_splunk_version()
        hostname = Settings.get_hostname()
        version = "Splunk"

        if splunk_version:
            version += " {0}".format(splunk_version)

        if hostname:
            version += ", {0}".format(hostname)

        user_agent += " ({0})".format(version)
        return user_agent

    @staticmethod
    def get_appuuid():
        try:
            current_dir = os.path.dirname(os.path.join(os.getcwd(), __file__))
            file_name = os.path.join(current_dir, '..', "appuuid.txt")

            if os.path.exists(file_name):
                with open(file_name, 'r') as ufile:
                    appuuid = ufile.readline().strip()
            else:
                appuuid = str(uuid.uuid4())
                with open(file_name, 'w') as ufile:
                    ufile.write(appuuid)

            return appuuid
        except:
            return None

    @staticmethod
    def get_uname():
        try:
            return " | ".join(platform.uname())
        except:
            return "unknown"

    @staticmethod
    def get_splunk_version():
        try:
            return splunk.getReleaseVersion()
        except:
            return None

    @staticmethod
    def get_hostname():
        try:
            return platform.node()
        except:
            return None


class API(object):
    def __init__(self, session_key):
        self._session_key = session_key

    @staticmethod
    def server_error(code):
        if isinstance(code, int) and code // 100 == 5:
            return True
        elif code in (request.InternalCodes.ERROR_HTTP, request.InternalCodes.ERROR_SSL):
            return True

        return False

    @staticmethod
    def invalid_key_error(code):
        if isinstance(code, int) and code == 403:
            return True

        return False

    def make_request(self, path, api_key=None, params=None, data=None, custom_headers=None):
        connection_settings = Settings.get_connection_settings(path, self._session_key)

        req = request.Request(connection_settings.url, params, data)
        req.enable_compression()

        if api_key is not None:
            req.enable_auth(api_key)

        if not connection_settings.ssl_verify:
            req.disable_verification()

        if connection_settings.proxy_address:
            req.set_proxy(connection_settings.proxy_address)

        headers = Settings.prepare_headers(custom_headers)
        req.append_headers(headers)

        response = req.send()
        return response.code, response.content

    def key_request(self):
        path = '/v1/key/request'
        post_data = {
            'platform': {
                'name': 'Splunk',
                'version': Settings.get_splunk_version(),
            },
            'uname': Settings.get_uname(),
        }
        data = json.dumps(post_data)

        code, content = self.make_request(path, data=data)
        return ResponseKeyRequest.from_response(code, content)

    def key_reset(self, email):
        path = '/v1/key/reset'
        post_data = {'email': email}
        data = json.dumps(post_data)

        code, content = self.make_request(path, data=data)
        return ResponseKeyReset.from_response(code, content)

    def account_status(self, api_key):
        path = "/v1/account/status"
        params = {'p': sections.NBA.product}

        code, content = self.make_request(path, api_key=api_key, params=params)
        return ResponseAccountStatus.from_response(code, content)

    def account_register(self, api_key, details):
        details_format = [
            ('name', six.string_types),
            ('organization', six.string_types),
            ('email', six.string_types),
            ('phone', six.string_types),
        ]

        try:
            validators.Args.check_dict(details, details_format)
        except ValueError:
            return ResponseAccountRegister.invalid_details()

        path = '/v1/account/register'
        post_data = {'details': details}
        data = json.dumps(post_data)

        code, content = self.make_request(path, api_key=api_key, data=data)
        return ResponseAccountRegister.from_response(code, content)

    def events(self, api_key, event_type, events_stream, details):
        path = '/v1/events/{0}'.format(event_type)
        headers = {}

        if details.backlog is not None:
            headers['X-AlphaSOC-Backlog'] = str(details.backlog)

        code, content = self.make_request(path, api_key=api_key, data=events_stream, custom_headers=headers)
        return ResponseEvents.from_response(code, content)

    def alerts(self, api_key, follow):
        path = "/v1/alerts"
        params = {'follow': follow, 'threats': 'all'}

        code, content = self.make_request(path, api_key=api_key, params=params)
        return ResponseAlerts.from_response(code, content)

    def destinations(self, api_key, follow):
        path = "/v1/dailyDestinations"
        params = {'follow': follow}

        code, content = self.make_request(path, api_key=api_key, params=params)
        return ResponseDestinations.from_response(code, content)

    def inventory_threats(self, api_key):
        path = "/v1/ae/inventory/threats"

        code, content = self.make_request(path, api_key=api_key)
        return ResponseInventoryThreats.from_response(code, content)

    def inventory_flags(self, api_key):
        path = "/v1/ae/inventory/flags"

        code, content = self.make_request(path, api_key=api_key)
        return ResponseInventoryFlags.from_response(code, content)

    def groups_raw_post(self, api_key, scope_data):
        path = '/v1/groups/raw'
        code, content = self.make_request(path, api_key=api_key, data=scope_data)

        response = Response(code)
        if code != 200:
            response.set_parsed_error(code, content)

        return response


class Response(object):
    def __init__(self, code):
        self.code = code
        self.error = None

    def has_error(self):
        return self.error is not None

    def set_default_error(self, code, content):
        try:
            self.error = "API returned HTTP code {0}: {1}.".format(code, content)
        except:
            self.error = "Unexpected API error (0x01)."

    def set_parsed_error(self, code, content):
        msg = content.get('message')
        if msg is None:
            self.set_default_error(code, content)
        else:
            self.error = msg


class ResponseKeyRequest(Response):
    def __init__(self, code):
        super(ResponseKeyRequest, self).__init__(code)
        self.key = ""

    @classmethod
    def from_response(cls, code, content):
        response = cls(code)

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        response.key = content.get('key', "")
        return response


class ResponseKeyReset(Response):
    @classmethod
    def from_response(cls, code, content):
        response = cls(code)

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        return response


class ResponseAccountStatus(Response):
    def __init__(self, code, valid, registered, today, endpoints, messages):
        super(ResponseAccountStatus, self).__init__(code)

        self.valid = valid
        self.registered = registered

        self.licensing = AccountStatusLicensing(today, endpoints)
        self.messages = messages

    @classmethod
    def from_response(cls, code, content):
        if code != 200:
            msg = content.get('message', 'Unexpected API error (0x01).')
            return cls.default_with_message(code, msg, Messages.ERROR)

        if 'registered' not in content:
            msg = 'Unexpected API error (0x02).'
            return cls.default_with_message(code, msg, Messages.ERROR)

        return cls.from_content(code, content)

    @classmethod
    def default_with_message(cls, code, msg, level):
        response = cls(code, False, False, None, None, [{'level': level, 'body': msg}])
        response.error = msg
        return response

    @classmethod
    def from_content(cls, code, content):
        valid = True
        registered = content.get('registered', False)
        messages = content.get('messages', [])

        today = content.get('today', None)
        endpoints = content.get('endpointsSeenToday', None)

        return cls(code, valid, registered, today, endpoints, messages)


class AccountStatusLicensing(object):
    def __init__(self, today, endpoints):
        self.today = today
        self.endpoints_seen_today = endpoints


class ResponseAccountRegister(Response):
    @classmethod
    def from_response(cls, code, content):
        response = cls(code)

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        return response

    @classmethod
    def invalid_details(cls):
        response = cls(403)
        response.error = "Invalid account details."
        return response


class ResponseEvents(Response):
    def __init__(self, code, stats):
        super(ResponseEvents, self).__init__(code)
        self.stats = stats

    @classmethod
    def from_response(cls, code, content):
        if not isinstance(content, dict):
            content = {}

        return cls(code, content)


class ResponseAlerts(Response):
    def __init__(self, code):
        super(ResponseAlerts, self).__init__(code)

        self.alerts = []
        self.threats = {}
        self.follow = ""
        self.more = False

    @classmethod
    def from_response(cls, code, content):
        response = cls(code)

        if not isinstance(content, dict):
            response.error = "Empty response from API request."
            return response

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        response.alerts = content.get("alerts", [])
        response.follow = content.get("follow", "")
        response.threats = content.get("threats", {})
        response.more = content.get("more", False)

        return response


class ResponseDestinations(Response):
    def __init__(self, code):
        super(ResponseDestinations, self).__init__(code)

        self.destinations = []
        self.follow = ""
        self.more = False

    @classmethod
    def from_response(cls, code, content):
        response = cls(code)

        if not isinstance(content, dict):
            response.error = "Empty response from API request."
            return response

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        response.destinations = content.get("destinations", [])
        if not response.destinations:
            response.destinations = []

        response.follow = content.get("follow", "")
        response.more = content.get("more", False)

        return response


class ResponseInventoryThreats(Response):
    def __init__(self, code):
        super(ResponseInventoryThreats, self).__init__(code)
        self.threats = {}

    @classmethod
    def from_response(cls, code, content):
        response = cls(code)
        if not isinstance(content, dict):
            response.error = "Empty response from API request."
            return response

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        response.threats = content.get("threats", {})
        return response


class ResponseInventoryFlags(Response):
    def __init__(self, code):
        super(ResponseInventoryFlags, self).__init__(code)
        self.flags = {}

    @classmethod
    def from_response(cls, code, content):
        response = cls(code)
        if not isinstance(content, dict):
            response.error = "Empty response from API request."
            return response

        if code != 200:
            response.set_parsed_error(code, content)
            return response

        response.flags = content.get("flags", {})
        return response


class ApiKeyStorage(object):
    @classmethod
    def save(cls, api_key, session_key):
        alphasoc_api = API(session_key)
        account_status = alphasoc_api.account_status(api_key)

        cls._set_passwords(api_key, session_key)

        config = confs.Config(session_key)
        cls._set_config_values(account_status, config)

    @staticmethod
    def _set_passwords(key, session_key):
        sp = confs.StoragePasswords(session_key)
        sp.set_api_key(key)

    @staticmethod
    def _set_config_values(account_status, config):
        config.begin_batch()

        config.set('api_key_valid', account_status.valid)
        config.set('api_key_registered', account_status.registered)

        Messages.set(account_status.messages, config)

        config.commit()
