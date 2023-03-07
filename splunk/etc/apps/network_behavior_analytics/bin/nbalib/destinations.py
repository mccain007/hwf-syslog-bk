import json

from nbalib import dateasoc


class Destination(object):
    def __init__(self, api_dest):
        self.ts = dateasoc.iso8601_to_date(api_dest.get("ts"))
        if self.ts is None:
            raise Exception("Destination does not contain a valid timestamp")

        self.dest = api_dest.get("dest", "")
        self.src_count = api_dest.get("srcCount", 0)

    def splunk_format(self):
        dest = {
            "ts": dateasoc.date_to_string(self.ts),
            "dest": self.dest,
            "src_count": self.src_count,
        }

        return json.dumps(dest, separators=(', ', ':'))
