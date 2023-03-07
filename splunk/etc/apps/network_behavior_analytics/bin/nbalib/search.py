import splunk.rest

from .asoc3 import six


class Export(object):
    def __init__(self, session_key, timeout):
        self._session_key = session_key
        self._timeout = timeout

    def run(self, query, search_id):
        """
        Run makes Splunk REST request and queries /services/search/job/export/ endpoint.
        Execution mode is set to 'one_shot' and number of returned events is unlimited.
        Method returns Response object with httplib.HTTPResponse and string content.
        """

        args = self._prepare_args(query, search_id)
        result, content = splunk.rest.simpleRequest(
            "/services/search/jobs/export/",
            sessionKey=self._session_key,
            timeout=self._timeout,
            method='POST',
            postargs=args,
        )

        return Response.from_rest_string(result, content)

    def _prepare_args(self, query, search_id):
        return {
            'search': query,
            'id': search_id,
            'timeout': self._timeout,
            'exec_mode': 'one_shot',
            'output_mode': 'csv',
            'count': '0',
        }


class Response(object):
    def __init__(self, result, content):
        self.result = result
        self.content = content

    @classmethod
    def empty(cls):
        return cls(None, "")

    @classmethod
    def from_rest_string(cls, result, content):
        return cls(result, six.ensure_str(content))
