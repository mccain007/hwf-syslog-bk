import sys

if sys.version_info.major >= 3:
    from . import yaml3 as yaml
elif sys.version_info.major == 2:
    from . import yaml2 as yaml
