import json
import abc
import re
import os

from . import iptools
from . import validators

from .asoc3.six.moves import cPickle as pickle
from .asoc3 import six


class EntryAlreadyExists(Exception):
    pass


class InvalidEntryType(Exception):
    pass


class GroupNotExists(Exception):
    pass


class EntryType(object):
    IN_SCOPE = 'inclusions'
    OUT_SCOPE = 'exclusions'
    TRUSTED_DOMAINS = 'trusted_domains'
    TRUSTED_IPS = 'trusted_ips'


class Scope(object):
    IP_SPLITTER = re.compile(r'::|:|\.|/')

    def __init__(self, path=None):
        self.importing = False

        self._storage = StoragePickle(path)
        self._groups = {}

        self.load()

    def load(self):
        try:
            groups = self._storage.load()
        except:
            group_label = Group.DEFAULT_LABEL
            group_id = Group.id_from_label(group_label)
            groups = {group_id: Group(group_label, init=True)}

        self._groups = groups

    def json_dump(self):
        mscope = {
            'version': '1',
            'groups': [],
        }

        for gid in self.groups_list():
            group = {
                'label': gid,
                'inclusions': [],
                'exclusions': [],
                'trusted': {
                    'domains': {
                        'entries': [],
                        'anomaly': self.anomaly_enabled(gid, EntryType.TRUSTED_DOMAINS),
                    },
                    'cidrs': {
                        'entries': [],
                        'anomaly': self.anomaly_enabled(gid, EntryType.TRUSTED_IPS),
                    },
                },
            }

            for ge in self.entries_list(gid, EntryType.IN_SCOPE):
                group['inclusions'].append({'value': ge[0], 'desc': ge[1]})

            for ge in self.entries_list(gid, EntryType.OUT_SCOPE):
                group['exclusions'].append({'value': ge[0], 'desc': ge[1]})

            for ge in self.entries_list(gid, EntryType.TRUSTED_DOMAINS):
                group['trusted']['domains']['entries'].append({'value': ge[0], 'desc': ge[1]})

            for ge in self.entries_list(gid, EntryType.TRUSTED_IPS):
                group['trusted']['cidrs']['entries'].append({'value': ge[0], 'desc': ge[1]})

            mscope['groups'].append(group)

        return json.dumps(mscope)

    def save(self):
        self._storage.save(self._groups)

    def groups_list(self):
        groups_ids = sorted(self._groups.keys())
        return [self._groups[group_id].label for group_id in groups_ids]

    def group_exists(self, label):
        return Group.id_from_label(label) in self._groups

    def group_add(self, label):
        if self.group_exists(label):
            raise ValueError(u"The provided group name already exists.")

        group_id = Group.id_from_label(label)
        use_default = not self.importing

        self._groups[group_id] = Group(label, default=use_default)

    def group_remove(self, label):
        if not self.group_exists(label):
            return False

        group_id = Group.id_from_label(label)
        del self._groups[group_id]
        return True

    def entries_list(self, group_label, entry_type):
        group_id = Group.id_from_label(group_label)
        group = self._groups.get(group_id)

        entries = self.parse_entry_type(group, entry_type)
        if entries is None:
            return []

        return entries.get()

    def entry_add(self, group_label, entry_type, value, description=None):
        if not self.group_exists(group_label):
            self.group_add(group_label)

        group_id = Group.id_from_label(group_label)
        group = self._groups.get(group_id)
        entries = self.parse_entry_type(group, entry_type)
        if entries is None:
            raise GroupNotExists(u"The provided group doesn't exist.")

        entries.add(value, description)

    def entry_remove(self, group_label, entry_type, value):
        group_id = Group.id_from_label(group_label)
        group = self._groups.get(group_id)
        entries = self.parse_entry_type(group, entry_type)
        if entries is None:
            return False

        try:
            removed = entries.remove(value)
        except:
            removed = False

        return removed

    @staticmethod
    def parse_entry_type(group, entry_type):
        if not isinstance(group, Group):
            return None

        if entry_type == EntryType.IN_SCOPE:
            return group.inclusions
        elif entry_type == EntryType.OUT_SCOPE:
            return group.exclusions
        elif entry_type == EntryType.TRUSTED_DOMAINS:
            return group.trusted_domains
        elif entry_type == EntryType.TRUSTED_IPS:
            return group.trusted_ips

        raise InvalidEntryType("Entry type has invalid value.")

    def anomaly_enabled(self, group_label, anomaly_type):
        group_id = Group.id_from_label(group_label)
        group = self._groups.get(group_id)

        anomaly = self.parse_anomaly_type(group, anomaly_type)
        if anomaly is None:
            return False

        return anomaly.get()

    def anomaly_set(self, group_label, anomaly_type, value):
        group_id = Group.id_from_label(group_label)
        group = self._groups.get(group_id)

        anomaly = self.parse_anomaly_type(group, anomaly_type)
        if anomaly is None:
            raise GroupNotExists(u"The provided group doesn't exist.")

        anomaly.set(value)

    def anomaly_groups_enabled(self, groups_labels, anomaly_type):
        if not groups_labels:
            return False

        for group_label in groups_labels:
            if self.anomaly_enabled(group_label, anomaly_type):
                return True

        return False

    @staticmethod
    def parse_anomaly_type(group, anomaly_type):
        if not isinstance(group, Group):
            return None

        if anomaly_type == EntryType.TRUSTED_DOMAINS:
            return group.anomaly_domains
        elif anomaly_type == EntryType.TRUSTED_IPS:
            return group.anomaly_ips

        raise InvalidEntryType("Anomaly type has invalid value.")

    def in_scope(self, src_ip, fqdn=None, dest_ip=None):
        if not isinstance(src_ip, six.string_types):
            return set()

        src_ip = src_ip.lower()  # iptools need lower-case ipv6s
        if not iptools.ipv4.validate_ip(src_ip) and not iptools.ipv6.validate_ip(src_ip):
            return set()

        groups = self._inclusion_groups(src_ip)
        if not groups:
            return set()

        excluded_groups = self._exclusion_groups(src_ip, groups, EntryType.OUT_SCOPE)
        groups.difference_update(excluded_groups)

        if fqdn is not None:
            excluded_groups = self._exclusion_groups(fqdn, groups, EntryType.TRUSTED_DOMAINS)
            groups.difference_update(excluded_groups)

        if dest_ip is not None:
            excluded_groups = self._exclusion_groups(dest_ip, groups, EntryType.TRUSTED_IPS)
            groups.difference_update(excluded_groups)

        return set([group.label for group in groups])

    def _inclusion_groups(self, src_ip):
        groups = set()
        for _, group in six.iteritems(self._groups):
            if group.inclusions.is_in(src_ip):
                groups.add(group)

        return groups

    def _exclusion_groups(self, value, groups, entry_type):
        excluded_groups = set()
        for group in groups:
            try:
                entries = self.parse_entry_type(group, entry_type)
                if entries.is_in(value):
                    excluded_groups.add(group)
            except:
                continue

        return excluded_groups

    @classmethod
    def split_cidr(cls, ip):
        """
        Splits ipv4/ipv6 cidr ranges (or ips) to a tuple containing its segments.
        It doesn't verify whether the ip argument is valid. This function is
        used for ip sorting eg. '10.0.0.0/24' -> (10, 0, 0, 1, 24).
        """

        try:
            ret = tuple([int(x, 16) if x else 0 for x in cls.IP_SPLITTER.split(ip)])
        except ValueError:
            return 0,

        return ret

    @staticmethod
    def full_ipv4(ip):
        """Convert IPv4 to full notation eg. 1.2.3/8 -> 1.2.0.3/8."""

        if ':' in ip or ip.find('.') <= 0:
            return ip

        ip_mask = ip.split('/')
        full_ip = iptools.ipv4.long2ip(iptools.ipv4.ip2long(ip_mask[0]))
        if len(ip_mask) > 1:
            full_ip += "/" + ip_mask[1]

        return full_ip


class Group(object):
    DEFAULT_LABEL = "Default"

    DEFAULT_INCLUSIONS = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        'fc00::/7',
    ]

    DEFAULT_TRUSTED_DOMAINS = [
        (u'*.internal', u'Local networks'),
        (u'*.lan', u'Local networks'),
        (u'*.local', u'Local networks'),
    ]

    DEFAULT_TRUSTED_IPS = [
        ('::/128', u'Unspecified address'),
        ('::1/128', u'Loopback address'),
        ('10.0.0.0/8', u'Private network'),
        ('127.0.0.0/8', u'Loopback addresses'),
        ('169.254.0.0/16', u'Link-local addresses'),
        ('172.16.0.0/12', u'Private network'),
        ('192.0.0.0/24', u'Private network'),
        ('192.168.0.0/16', u'Private network'),
        ('224.0.0.0/8', u'Multicast addresses'),
        ('255.255.255.255/32', u'Broadcast address'),
        ('fc00::/7', u'Private network'),
        ('fe80::/10', u'Link-local address'),
        ('ff00::/8', u'Multicast addresses'),
    ]

    def __init__(self, label, init=False, default=True):
        self.id = self.id_from_label(label)
        self.label = label

        self.inclusions = EntriesCIDR()
        self.exclusions = EntriesCIDR()

        self.trusted_domains = EntriesDomains()
        self.trusted_ips = EntriesCIDR()

        self.anomaly_domains = Anomaly()
        self.anomaly_ips = Anomaly()

        if init:
            self._init_inclusions()

        if default:
            self._init_trusted()

    @staticmethod
    def id_from_label(label):
        return label.lower()

    def _init_inclusions(self):
        for cidr in self.DEFAULT_INCLUSIONS:
            self.inclusions.add(cidr)

    def _init_trusted(self):
        for domain, description in self.DEFAULT_TRUSTED_DOMAINS:
            self.trusted_domains.add(domain, description)

        for cidr, description in self.DEFAULT_TRUSTED_IPS:
            self.trusted_ips.add(cidr, description)


class Entries(six.with_metaclass(abc.ABCMeta, object)):
    @abc.abstractmethod
    def get(self):
        pass

    @abc.abstractmethod
    def add(self, value, description=None):
        pass

    @abc.abstractmethod
    def is_in(self, value):
        pass

    @abc.abstractmethod
    def remove(self, value):
        pass

    @abc.abstractmethod
    def dumps(self):
        pass


class EntriesCIDR(Entries):
    IPV6_WHOLE_RANGE = iptools.IpRange("::/0")

    def __init__(self):
        super(EntriesCIDR, self).__init__()

        self._raw = {}
        self._cidrs = set()

    def get(self):
        return sorted(list(self._raw.items()), key=lambda item: Scope.split_cidr(item[0]))

    def add(self, value, description=None):
        try:
            value = Scope.full_ipv4(value)
        except:
            pass

        cidr = validators.IP.check(value)
        iprange = iptools.IpRange(cidr)

        if iprange in self._cidrs:
            raise EntryAlreadyExists('Provided IP or CIDR range already exists in this group.')

        self._raw[cidr] = description or ''
        self._cidrs.add(iprange)

    def is_in(self, value):
        if isinstance(value, six.string_types):
            value = value.lower()

        for cidr in self._cidrs:
            if cidr == self.IPV6_WHOLE_RANGE and '.' in value:
                continue
            elif value in cidr:
                return True

        return False

    def remove(self, value):
        cidr = validators.IP.check(value)
        if cidr in self._raw:
            iprange = iptools.IpRange(cidr)
            self._cidrs.discard(iprange)

            del self._raw[cidr]
            return True

        return False

    def dumps(self):
        return self._raw


class EntriesDomains(Entries):
    def __init__(self):
        super(EntriesDomains, self).__init__()

        self._exact = {}
        self._wildcarded = {}

        self._wildcarded_segments = set()
        self._wildcarded_max_segments = 0

    def get(self):
        return sorted(list(self._exact.items()) + list(self._wildcarded.items()))

    def add(self, value, description=None):
        domain = validators.FQDN.check_scopes(value)
        description = description or ''

        if domain.startswith('*.'):
            domain_sans_wildcard = domain[2:]
            segments = domain.count('.')

            self._wildcarded[domain] = description
            self._wildcarded_segments.add(tuple(domain_sans_wildcard.split('.')))
            self._wildcarded_max_segments = max(self._wildcarded_max_segments, segments)
        else:
            self._exact[domain] = description

    def is_in(self, value):
        if not isinstance(value, six.string_types):
            return False

        domain = value.lower().strip('.')
        if domain in self._exact:
            return True

        if not self._wildcarded_segments:
            return False

        splitted = domain.split('.')
        for segments in range(1, min(len(splitted), self._wildcarded_max_segments) + 1):
            segmented = tuple(splitted[-segments:])
            if segmented in self._wildcarded_segments:
                return True

        return False

    def remove(self, value):
        domain = validators.FQDN.check_scopes(value)

        if domain.startswith('*.'):
            domain_sans_wildcard = domain[2:]
            if domain in self._wildcarded:
                del self._wildcarded[domain]
                self._wildcarded_segments.discard(tuple(domain_sans_wildcard.split('.')))

                max_segments = max([d.count('.') for d in self._wildcarded]) if self._wildcarded else 0
                self._wildcarded_max_segments = max_segments
                return True
        elif domain in self._exact:
            del self._exact[domain]
            return True

        return False

    def dumps(self):
        raw = self._exact.copy()
        raw.update(self._wildcarded)
        return raw


class Anomaly(object):
    def __init__(self):
        self._enabled = False

    def get(self):
        return self._enabled

    def set(self, enabled):
        if isinstance(enabled, six.string_types):
            enabled = enabled.lower()

        enabled_values = [True, "true", "1", 1, "on", "enabled"]
        self._enabled = enabled in enabled_values


class StoragePickle(object):
    def __init__(self, path=None):
        self._path = os.path.join(path, "scopes.pickle") if path else self.default_path()

    @staticmethod
    def default_path():
        current_dir = os.path.dirname(os.path.join(os.getcwd(), __file__))
        return os.path.join(current_dir, '..', "scopes.pickle")

    def load(self):
        with open(self._path, 'rb') as scope_file:
            content = pickle.load(scope_file)

        groups = {}
        for _, details in six.iteritems(content['groups']):
            group = Group(details['label'], default=False)

            self._load_entries(details, 'in_scope', group.inclusions)
            self._load_entries(details, 'out_scope', group.exclusions)
            self._load_entries(details, 'trusted_domains', group.trusted_domains)
            self._load_entries(details, 'trusted_ips', group.trusted_ips)

            group.anomaly_domains.set(details.get('anomaly_domains', False))
            group.anomaly_ips.set(details.get('anomaly_ips', False))

            groups[group.id] = group

        return groups

    @staticmethod
    def _load_entries(src, src_key, entry_type):
        source = src.get(src_key)
        if source is None:
            return

        for value, desc in six.iteritems(source):
            entry_type.add(value, desc)

    def save(self, groups):
        db = {'version': 4, 'groups': {}}

        for _, group in six.iteritems(groups):
            db['groups'][group.id] = {
                'label': group.label,
                'in_scope': group.inclusions.dumps(),
                'out_scope': group.exclusions.dumps(),
                'trusted_domains': group.trusted_domains.dumps(),
                'trusted_ips': group.trusted_ips.dumps(),
                'anomaly_domains': group.anomaly_domains.get(),
                'anomaly_ips': group.anomaly_ips.get(),
            }

        with open(self._path, 'wb') as scope_file:
            pickle.dump(db, scope_file, -1)
