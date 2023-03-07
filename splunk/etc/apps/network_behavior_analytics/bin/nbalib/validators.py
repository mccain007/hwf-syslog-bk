import re
import json

import splunk.rest

from . import iptools
from . import sections
from . import confs

from .asoc3 import six


class Sections(object):
    data = [
        sections.DNS.name, sections.IP.name, sections.HTTP.name,
        sections.DHCP.name, sections.TLS.name, sections.VPN.name
    ]
    pulls = [
        sections.Destinations.name,
    ]
    app = data + pulls + [sections.Alerts.name]

    @classmethod
    def check_data_section(cls, section):
        if section not in cls.data:
            raise ValueError("Plese provide valid data type. Available types: {0}.".format(", ".join(cls.data)))

    @classmethod
    def check_pull_section(cls, section):
        if section not in cls.pulls:
            raise ValueError("Plese provide valid data type. Available types: {0}.".format(", ".join(cls.pulls)))

    @classmethod
    def check_app_section(cls, section):
        if section not in cls.app:
            raise ValueError("Plese provide valid data type. Available types: {0}.".format(", ".join(cls.app)))


class Args(object):
    @staticmethod
    def check_dict(dictionary, fields):
        if not isinstance(dictionary, dict):
            raise ValueError("Not a dict")

        for field, var_type in fields:
            if field not in dictionary:
                raise ValueError("Field {0} doesn't exist.".format(field))

            if not isinstance(dictionary[field], var_type):
                raise ValueError("Field {0} has incorrect type (is {1}, should be {2}).".format(
                    field, type(dictionary[field]), var_type
                ))

        return dictionary

    @staticmethod
    def check_index(name):
        if not isinstance(name, six.string_types):
            raise ValueError("Index name has invalid data type.")

        if not re.match(r'^[a-zA-Z0-9_\-]+$', name):
            raise ValueError('Index name must contain only alphanumeric characters, "-" or "_".')

        return name


class Email(object):
    # This validation email regexp is taken from django source code bundled with Splunk.
    # Line 1: dot-atom
    # Line 2: quoted-string, see also http://tools.ietf.org/html/rfc2822#section-3.2.5
    # Line 3: domain
    # Line 4: literal form, ipv4 address (SMTP 4.1.3)

    EMAIL_REGEXP = re.compile(
        r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*"
        r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-\011\013\014\016-\177])*"'
        r')@((?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)$)'
        r'|\[(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}\]$', re.IGNORECASE)

    @classmethod
    def is_valid(cls, email):
        if not isinstance(email, six.string_types):
            return False

        if cls.EMAIL_REGEXP.search(email):
            return True

        # Trivial case failed. Try for possible IDN domain-part
        if email and '@' in email:
            parts = email.split('@')
            try:
                parts[-1] = six.ensure_text(parts[-1]).encode('idna').decode('ascii')
            except:
                return False
            return True if cls.EMAIL_REGEXP.search("@".join(parts)) else False

        return False


class FQDN(object):
    API_FQDN_REGEXP = re.compile(br'^([-_a-zA-Z0-9]{1,63}\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,32}[a-zA-Z]$')
    SCOPE_FQDN_REGEXP = re.compile(br'^[a-z0-9_]([a-z0-9-_]{0,61}[a-z0-9_])?$')

    @classmethod
    def is_valid_api(cls, fqdn):
        try:
            fqdn = six.ensure_text(fqdn)
        except:
            return False

        try:
            idn_full = fqdn.strip().strip('.').lower().encode('idna')
        except UnicodeError:
            return False

        fqdn_len = len(idn_full)
        if fqdn_len == 0 or fqdn_len > 255:
            return False

        matched = cls.API_FQDN_REGEXP.match(idn_full)
        if not matched:
            return False

        return True

    @classmethod
    def check_scopes(cls, fqdn):
        try:
            fqdn = six.ensure_text(fqdn)
        except:
            raise ValueError(u"The provided FQDN contains illegal characters.")

        try:
            idn_full = fqdn.strip().lower().encode('idna')
        except UnicodeError:
            raise ValueError(u"The provided FQDN is too long.")

        if len(idn_full) > 255:
            raise ValueError(U"The provided FQDN is longer than 255 octets.")

        idn = idn_full.split(b'.')
        if idn[0] != b'*' and not cls.SCOPE_FQDN_REGEXP.match(idn[0]):
            if b'*' in idn[0]:
                raise ValueError(u"You can use wildcards only as a first segment of the fqdn, i.e.: *.example.com.")
            else:
                raise ValueError(u"Invalid domain name.")

        for segment in idn[1:]:
            if not cls.SCOPE_FQDN_REGEXP.match(segment):
                if b'*' in segment:
                    raise ValueError(u"You can use wildcards only as a first segment of the fqdn, i.e.: *.example.com.")
                else:
                    raise ValueError(u"Invalid domain name.")

        return idn_full.decode('utf-8')


class RecordType(object):
    UMBRELLA_REGEXP = re.compile(r'\d+\s*\(([-a-zA-Z0-9]+)\)')
    VALID_REGEXP = re.compile(r'^[-a-zA-Z0-9]*$')

    @classmethod
    def is_valid(cls, record_type):
        if not isinstance(record_type, six.string_types):
            return False

        if len(record_type) > 16:
            return False
        elif "(" in record_type:
            umatch = cls.UMBRELLA_REGEXP.search(record_type)
            if not umatch:
                return False

            ugroups = umatch.groups()
            if not ugroups:
                return False
            record_type = ugroups[0]

        return cls.VALID_REGEXP.match(record_type) is not None


class IP(object):
    @staticmethod
    def check(ip):
        if not isinstance(ip, six.string_types):
            raise ValueError(u"Invalid IP address or range.")

        if ip.find('.') > 0:
            if iptools.ipv4.validate_ip(ip) or iptools.ipv4.validate_cidr(ip):
                return ip

            raise ValueError(u"Invalid IP address or range.")

        ipv6 = ip.lower()
        if iptools.ipv6.validate_ip(ipv6) or iptools.ipv6.validate_cidr(ipv6):
            return ipv6

        raise ValueError(u"Invalid IP address or range.")

    @staticmethod
    def is_valid_api(ip):
        if not isinstance(ip, six.string_types):
            return False

        if ip.find('.') > 0:
            return iptools.ipv4.validate_ip(ip)

        return iptools.ipv6.validate_ip(ip.lower())

    @staticmethod
    def full_valid_ip(ip):
        if not IP.is_valid_api(ip):
            return None

        if ip.find('.') > 0:
            ip = iptools.ipv4.long2ip(iptools.ipv4.ip2long(ip))

        return ip


class URL(object):
    VALID_HTTP_SCHEMAS = [None, "", "//", "http", "https"]

    @classmethod
    def is_valid_scheme(cls, scheme):
        return scheme in cls.VALID_HTTP_SCHEMAS


class Permissions(object):
    @staticmethod
    def is_config_writable(session_key):
        try:
            config = confs.Config(session_key)
            config.set('is_writable', True)
        except:
            return False

        return True


class Splunk(object):
    scripts = [
        "script://./bin/nba_scorer.py",
        "script://.\\bin\\nba_scorer.py",
    ]

    @staticmethod
    def is_cloud_instance(session_key):
        try:
            _, content = splunk.rest.simpleRequest(
                "/services/server/info/server-info",
                sessionKey=session_key,
                getargs={'output_mode': 'json'},
                method='GET',
            )

            instance_type = json.loads(content)['entry'][0]['content']['instance_type']
            return instance_type == "cloud"
        except:
            return False

    @staticmethod
    def are_inputs_enabled(session_key, file_name="inputs"):
        are_enabled = False

        try:
            config = confs.Config(session_key, name=file_name)
            for script in Splunk.scripts:
                try:
                    disabled = config.is_enabled('disabled', default=True, stanza=script)
                except ValueError:
                    disabled = True
                except:
                    disabled = False

                if not disabled:
                    are_enabled = True
                    break
        except:
            are_enabled = False

        return are_enabled
