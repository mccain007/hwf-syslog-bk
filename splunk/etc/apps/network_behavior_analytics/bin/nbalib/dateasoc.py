import datetime
import time

from . import iso8601

TIME_FORMAT = "%d-%b-%Y %H:%M:%S"


def iso8601_to_date(datestr):
    """
    Converts a datetime string sent by API (ISO8601) to python datetime object.
    Returns timezone-aware datetime object or None when the conversion fails.
    Library iso8601 is wokrking correctly only with strings so make sure
    datestr is not an unicode and convert it to string.
    """

    try:
        return iso8601.parse_date(str(datestr))
    except:
        return None


def utc_now():
    return datetime.datetime.now(iso8601.UTC)


def time_to_string():
    loctime = time.localtime()
    if loctime.tm_isdst and time.daylight:
        offset = -time.altzone
    else:
        offset = -time.timezone

    datestr = time.strftime(TIME_FORMAT, loctime)
    sign = "+" if offset >= 0 else "-"
    hour, seconds = divmod(offset, 3600)
    minutes = int(seconds / 60)

    return datestr + "%s%02i%02i" % (sign, hour, minutes)


def date_to_string(dt):
    return dt.strftime(TIME_FORMAT + "%z")
