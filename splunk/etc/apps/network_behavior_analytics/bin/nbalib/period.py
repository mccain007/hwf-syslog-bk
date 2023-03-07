import datetime
import time

DEFAULT_WINDOW_SIZE_SECONDS = 120
DEFAULT_LIVE_OFFSET_SECONDS = 60
DEFAULT_MAX_BACKLOG_SECONDS = 1800

SLOW_ENVIRONMENT_WARN_HOURS = 6


class Config(object):
    def __init__(self):
        self.window_size = DEFAULT_WINDOW_SIZE_SECONDS
        self.live_offset = DEFAULT_LIVE_OFFSET_SECONDS
        self.max_backlog = DEFAULT_MAX_BACKLOG_SECONDS


class Period(object):
    def __init__(self, init, config):
        self._config = config

        self.start = self._init_start(init, config)
        self.end = self._init_end(self.start)

        self.backlog_since = 0

    def _init_start(self, init, config):
        if not init:
            return self.max_period_end() - config.window_size

        start = max(init, self.max_backlog_time())
        return min(start, self.max_period_end() - config.window_size)

    def _init_end(self, start):
        end = start + self._config.window_size
        return min(end, self.max_period_end())

    def next_period(self):
        self.start = self.end
        self.end = self.start + self._config.window_size

    def check_ranges(self):
        """
        Check if start and end value is in correct ranges.
        If not, redefine them to the max and min values.
        """

        self.start = max(self.start, self.max_backlog_time())
        self.end = self.start + self._config.window_size
        self.end = min(self.end, self.max_period_end())

    def wait_time(self):
        """
        Return how many seconds left to the end of the current period.
        """

        return self.end - int(time.time()) + self._config.live_offset

    def backlog(self):
        """
        Return difference (in seconds) between period end and now.
        """

        wait_time = self.wait_time()
        backlog = abs(wait_time) if wait_time < 0 else 0

        if backlog > self._config.max_backlog:
            return self._config.max_backlog

        return backlog

    def next_period_backlog(self):
        wait_time = self.wait_time() + self._config.window_size
        backlog = abs(wait_time) if wait_time < 0 else 0

        if backlog > self._config.max_backlog:
            return self._config.max_backlog

        return backlog

    def max_backlog_time(self):
        relative = int(time.time()) - self._config.live_offset
        return relative - self._config.window_size - self._config.max_backlog

    def max_period_end(self):
        return int(time.time()) - self._config.live_offset

    def start_to_date(self):
        return self.timestamp_to_date(self.start)

    def end_to_date(self):
        return self.timestamp_to_date(self.end)

    @staticmethod
    def timestamp_to_date(value):
        try:
            return datetime.datetime.fromtimestamp(value)
        except:
            return ""

    def slow_environment(self, backlog):
        now = int(time.time())
        threshold = int(self._config.max_backlog / 2)

        if backlog > threshold and self.backlog_since == 0:
            self.backlog_since = now
        elif backlog <= threshold:
            self.backlog_since = 0
            return False

        return now - self.backlog_since > SLOW_ENVIRONMENT_WARN_HOURS * 60 * 60
