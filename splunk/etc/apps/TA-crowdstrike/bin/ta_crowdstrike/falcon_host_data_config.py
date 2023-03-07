import os
import sys

import splunktaucclib.data_collection.ta_config as ta_config
import splunktaucclib.common.log as stulog
import splunktaucclib.data_collection.ta_consts as c
from splunktalib.common import util


folder_path = os.path.dirname(os.path.realpath(__file__))
sys.path.append(os.path.join(os.path.dirname(folder_path)))

import crowdstrike_consts as consts


class FalconHostConfig(ta_config.TaConfig):
    
    def __init__(self, meta_config, client_schema):
        super(FalconHostConfig, self).__init__(
            meta_config, client_schema)
        
    def _get_task_configs(self, all_conf_contents, division_endpoint,
                          divide_setting):
        task_configs = list()
        orig_task_configs = all_conf_contents.get(division_endpoint)
        for orig_task_config_stanza, orig_task_config_contents in \
                orig_task_configs.iteritems():
            if util.is_true(orig_task_config_contents.get(c.disabled, False)):
                stulog.logger.debug("Stanza %s is disabled",
                                    orig_task_config_contents)
                continue
            orig_task_config_contents[c.divide_endpoint] = division_endpoint
            divide_tasks = self._divide_task_config(
                orig_task_config_stanza,
                orig_task_config_contents,
                divide_setting, all_conf_contents)
            task_configs = task_configs + divide_tasks
        task_configs = self.add_endpoint_config(task_configs, all_conf_contents)

        return task_configs
        
    def add_endpoint_config(self, task_configs, all_conf_contents):
        for task_config in task_configs:
            input_account = task_config['account']
            account = all_conf_contents['accounts'][input_account]
            if account['api_type'] == "Query":
                task_config['endpoint'] = consts.DATA_QUERY_ENDPOINTS[0]
                task_config['task_name'] = task_config['stanza_name']+task_config['endpoint'].replace("/","_")
                consts.DATA_QUERY_ENDPOINTS.pop(0)
                all_query_endpoints = consts.DATA_QUERY_ENDPOINTS#["/devices/queries/devices/v1", "/detects/queries/detects/v1"]
                for endpoint in all_query_endpoints:
                    endpoint_task = task_config.copy()
                    endpoint_task.update({'endpoint': endpoint, 'task_name': endpoint_task['stanza_name']+endpoint.replace("/","_")})
                    task_configs.append(endpoint_task)
                break
        return task_configs
    