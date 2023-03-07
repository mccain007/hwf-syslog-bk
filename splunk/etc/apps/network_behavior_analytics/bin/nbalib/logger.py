import logging
import json
import abc

from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path

from .asoc3 import six


class Logger(logging.Logger):
    def __init__(self, name):
        super(Logger, self).__init__(name)

    @classmethod
    def setup_logger(cls, app, module_name):
        """
        Configure Logger to save log file in main Splunk logs dir.
        """

        logger = cls(cls.get_id(app, module_name))
        logger.propagate = False
        logger.setLevel(logging.INFO)

        path = logger.get_path(logger.name)
        handler = logging.handlers.RotatingFileHandler(path, maxBytes=5000000, backupCount=5)

        formatter = logging.Formatter('[%s] ' % module_name + '%(asctime)s %(levelname)s %(message)s')
        handler.setFormatter(formatter)

        logger.addHandler(handler)
        return logger

    @staticmethod
    def get_path(name):
        return make_splunkhome_path(['var', 'log', 'splunk', name + ".log"])

    @staticmethod
    def get_id(app, module_name):
        return "{0}_{1}".format(app, module_name)

    def close(self):
        for handler in self.handlers:
            handler.close()


class LoggerUI(Logger):
    """
    LoggerUI extends normal Logger and allows to save DataMessages directly
    in the app config. In next step this messages can be render in the UI.
    """

    def __init__(self, name):
        super(LoggerUI, self).__init__(name)

        self._ui_treshold = DataMessages.WARN
        self._ui_messages_ids = set()
        self._ui_messages = []

    def set_ui_level_treshold(self, level):
        self._ui_treshold = level

    def ui_append(self, msg):
        if msg.level >= self._ui_treshold and msg.id not in self._ui_messages_ids:
            self._ui_messages_ids.add(msg.id)
            self._ui_messages.append(msg.dumps())

    def ui_save(self, config):
        messages = json.dumps(self._ui_messages).replace("\n", " ")
        config.set('data_messages', messages)

        self.ui_clear()

    def ui_clear(self):
        self._ui_messages_ids = set()
        self._ui_messages = []


class DataMessages(six.with_metaclass(abc.ABCMeta, object)):
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3

    def __init__(self):
        self.id = 0
        self.level = DataMessages.DEBUG
        self.ui_message = ""

    def dumps(self):
        return {
            "id": self.id,
            "level": self.level,
            "message": self.ui_message,
        }


class MessageUnexpectedError(DataMessages):
    def __init__(self, message):
        super(MessageUnexpectedError, self).__init__()

        self.id = 1
        self.level = DataMessages.ERROR
        self.ui_message = ("Unexpected error occurred: {0}.".format(message))


class MessageUnauthorizedSplunk(DataMessages):
    def __init__(self):
        super(MessageUnauthorizedSplunk, self).__init__()

        self.id = 2
        self.level = DataMessages.ERROR
        self.ui_message = ('Application could not get or save your AlphaSOC API key. '
                           'Please go to the access controls settings and assign '
                           '"admin_all_objects" capability to admin user.')


class MessageUnauthorizedAPI(DataMessages):
    def __init__(self, api_messages=None):
        super(MessageUnauthorizedAPI, self).__init__()

        self.id = 3
        self.level = DataMessages.ERROR
        self.ui_message = ("Your AlphaSOC API key could not be authorized. Please check "
                           "if your API key is valid and license is not expired.")

        if isinstance(api_messages, list) and api_messages:
            try:
                self.ui_message = self._parse_api_messages(api_messages)
            except:
                pass

    @staticmethod
    def _parse_api_messages(api_messages):
        messages_body = []
        for message in api_messages:
            body = message.get('body')
            if isinstance(body, six.string_types):
                messages_body.append(body)

        return ", ".join(messages_body)


class MessageAPIConnection(DataMessages):
    def __init__(self, code):
        super(MessageAPIConnection, self).__init__()

        self.id = 4
        self.level = DataMessages.WARN
        self.ui_message = ("Application could not connect to the AlphaSOC API. Please check "
                           "your network configuration and firewall rules. HTTP code: {0}.".format(code))


class MessageEmptySearch(DataMessages):
    def __init__(self):
        super(MessageEmptySearch, self).__init__()

        self.id = 5
        self.level = DataMessages.ERROR
        self.ui_message = ("The search has not returned any events. Please ensure "
                           "your logs are indexed and CIM tags are assigned.")


class MessageOutOfScope(DataMessages):
    def __init__(self):
        super(MessageOutOfScope, self).__init__()

        self.id = 6
        self.level = DataMessages.ERROR
        self.ui_message = ("The search found CIM compliant events but none are within monitoring scope. "
                           "Please check your configuration under Groups.")


class MessageInvalidLogs(DataMessages):
    def __init__(self):
        super(MessageInvalidLogs, self).__init__()

        self.id = 7
        self.level = DataMessages.ERROR
        self.ui_message = ("The search returned events but they have an invalid format. "
                           "Please ensure the fields are CIM compliant.")


class MessageSlowEnvironment(DataMessages):
    def __init__(self):
        super(MessageSlowEnvironment, self).__init__()

        self.id = 8
        self.level = DataMessages.WARN
        self.ui_message = ("The application could not score events in real-time because there is too "
                           "much data for Splunk to process. Please narrow searches to particular "
                           "indexes and reduce latency in your environment.")


class MessageInvalidAlerts(DataMessages):
    def __init__(self):
        super(MessageInvalidAlerts, self).__init__()

        self.id = 9
        self.level = DataMessages.ERROR
        self.ui_message = ("Application received alerts from the AlphaSOC API but could not create "
                           "at least one of them. Please contact support@alphasoc.com.")


class MessageNotWorking(DataMessages):
    def __init__(self):
        super(MessageNotWorking, self).__init__()

        self.id = 10
        self.level = DataMessages.ERROR
        self.ui_message = ("This module is not working. Please check if your Splunk admin user "
                           "has sufficient permissions and contact support@alphasoc.com.")


class MessageDisabled(DataMessages):
    def __init__(self):
        super(MessageDisabled, self).__init__()

        self.id = 11
        self.level = DataMessages.WARN
        self.ui_message = ("This module has been disabled. Events won't be sent to the Analytics Engine from Splunk.")


class MessageConfigNotWritable(DataMessages):
    def __init__(self):
        super(MessageConfigNotWritable, self).__init__()

        self.id = 12
        self.level = DataMessages.ERROR
        self.ui_message = ("The application cannot write to the $SPLUNK_HOME/etc/apps/network_behavior_analytics "
                           "directory. Please check your permissions.")


class MessageCloudBrokenInputs(DataMessages):
    def __init__(self):
        super(MessageCloudBrokenInputs, self).__init__()

        self.id = 13
        self.level = DataMessages.ERROR
        self.ui_message = ("The app seems to have been self-installed to a Splunk Cloud instance. Please open "
                           "a ticket with Splunk to reinstall and set the required inputs.conf.")


class MessageStoreNotUpdated(DataMessages):
    def __init__(self):
        super(MessageStoreNotUpdated, self).__init__()

        self.id = 14
        self.level = DataMessages.WARN
        self.ui_message = ("Unable to save AlphaSOC threat definitions. This can result from a temporary connection "
                           "error. Please contact support@alphasoc.com if this warning persists.")


class MessageInvalidRecordType(DataMessages):
    def __init__(self):
        super(MessageInvalidRecordType, self).__init__()

        self.id = 15
        self.level = DataMessages.WARN
        self.ui_message = ("Your DNS record_type field values are formatted incorrectly, "
                           "which affects alerting accuracy.")


class MessageDisabledPull(DataMessages):
    def __init__(self):
        super(MessageDisabledPull, self).__init__()

        self.id = 16
        self.level = DataMessages.WARN
        self.ui_message = ("This module has been disabled. Data won't be retrieved from the Analytics Engine.")
