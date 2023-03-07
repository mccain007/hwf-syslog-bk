import splunktaucclib.data_collection.ta_consts as c
import splunktaucclib.data_collection.ta_helper as th
import splunktaucclib.data_collection.ta_checkpoint_manager as ta_ckpt_mgr


class FalconHostCheckPointMgr(ta_ckpt_mgr.TACheckPointMgr):
    
    def __init__(self, meta_config, task_config):
        super(FalconHostCheckPointMgr, self).__init__(meta_config, task_config)
        
    def key_formatter(self):
        stanza = self._task_config.get('task_name') if self._task_config.get('task_name') else self._task_config[c.stanza_name]
        divide_value = [stanza]
        for key in self._task_config[c.divide_key]:
            divide_value.append(self._task_config[key])
        key_str = ta_ckpt_mgr.TACheckPointMgr.SEPARATOR.join(divide_value)
        return th.format_input_name_for_file(key_str)