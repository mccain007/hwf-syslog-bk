from . import validators

from .asoc3.six.moves import urllib_parse
from .asoc3 import six


class URL(object):
    def __init__(self, url):
        self._parsed = self.parse(url)

        self.scheme = self._parsed.scheme or ""
        self.hostname = self._parsed.hostname or url

        # Validation must be runned after url parsing and scheme, hostname initialization.
        self.is_valid, self.is_ip = self.validate()

    def validate(self):
        if not validators.URL.is_valid_scheme(self.scheme):
            return False, False

        is_valid_ip = self._is_valid_ip_netloc()
        if is_valid_ip:
            return True, True

        is_valid_fqdn = validators.FQDN.is_valid_api(self.hostname)
        if is_valid_fqdn:
            return True, False

        return False, False

    def _is_valid_ip_netloc(self):
        is_valid_ip = validators.IP.is_valid_api(self.hostname)
        if not is_valid_ip:
            return False

        # Mark IPv6 as valid without checking network location.
        if self.hostname.find('.') <= 0:
            return True

        # Do not allow for multiple colons in network location eg. 8.8.8.8:9001:9001.
        clean_credentials = self.remove_credentials(self._parsed)
        netloc = clean_credentials.netloc or ""

        return netloc.count(':') <= 1

    def get_cleaned_url(self):
        clean_credentials = self.remove_credentials(self._parsed)
        clean = self.remove_params(clean_credentials)

        clean_url = clean.geturl()
        if clean_url.startswith("//"):
            clean_url = clean_url[2:]

        return six.ensure_text(clean_url, errors='ignore')

    @staticmethod
    def parse(url):
        """
        Python urlparse library works correctly only with urls that
        contains a scheme. Before parsing check if scheme exists
        in the url and add an empty scheme ("//") if scheme not exists.
        """

        try:
            url = urllib_parse.unquote(url)
            if not url.startswith("//") and "://" not in url:
                url = "//" + url

            return urllib_parse.urlparse(url)
        except:
            return urllib_parse.ParseResult("", "", "", "", "", "")

    @staticmethod
    def remove_credentials(parsed_url):
        """
        Acording to RFC3986 (https://tools.ietf.org/html/rfc3986), urls can
        contain authorization informations. This function removes credentials
        from url if they are stored in following format: "user:pass@hostname".
        """

        try:
            if not parsed_url.username:
                return parsed_url

            return parsed_url._replace(netloc=parsed_url.netloc.split("@", 1)[1])
        except:
            return urllib_parse.ParseResult("", "", "", "", "", "")

    @staticmethod
    def remove_params(parsed_url):
        """
        Parameters in url can contain sensitive data so remove everything after
        question mark: params, query and fragment.
        """

        try:
            return parsed_url._replace(params="")._replace(query="")._replace(fragment="")
        except:
            return urllib_parse.ParseResult("", "", "", "", "", "")
