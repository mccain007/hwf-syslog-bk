/*global define,window*/
define([
    'underscore',
    'app/views/Models/TextDisplayControl',
    'views/shared/controls/TextControl',
    'app/views/Models/SingleInputControl',
    'app/views/Models/SingleInputControlEx',
    'views/shared/controls/SyntheticCheckboxControl',
    'views/shared/controls/SyntheticRadioControl',
    'app/views/Models/MultiSelectInputControl',
    'app/models/Input',
    'app/models/Account',
    'app/collections/Inputs'
], function (
    _,
    TextDisplayControl,
    TextControl,
    SingleInputControl,
    SingleInputControlEx,
    SyntheticCheckboxControl,
    SyntheticRadioControl,
    MultiSelectInputControl,
    Input,
    Account,
    Inputs
) {
    return {
        "input": {
           "title": "Input",
           "caption": {
               title: "Inputs",
               description: 'Create data inputs to collect Falcon Host data from CrowdStrike.',
               enableButton: true,
               singleInput: true,
               buttonId: "addInputBtn",
               buttonValue: "Create New Input",
               enableHr: true
           },
           "header": [
               {
                   "field": "name",
                   "label": "Name",
                   "sort": true,
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "service",
                   "label": "Service",
                   "sort": true,
                   mapping: function (model) {
                       if (model.id.indexOf('ta_crowdstrike_falcon_host_inputs') > -1) {
                           return "Falcon Host";
                       }
                        return "Unknown";
                   }
               },
                {
                   "field": "account",
                   "label": "Account",
                   "sort":true,
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "interval",
                   "label": "Interval",
                   "sort": true,
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "start_offset",
                   "label": "Start Offset",
                   "sort": true,
                   mapping: function (field) {
                       if (!field){
                           return "0";
                       }
                       else {
                           return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                       }
                   }
               },
			   {
                   "field": "start_date",
                   "label": "Start Date",
                   "sort": true,
                   mapping: function (field) {
                       if (!field){
                           return "1970-01-01T00:00:00Z";
                       }
                       else {
                           return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                       }
                   }
               },
               {
                   "field": "index",
                   "label": "Index",
                   "sort": true,
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "disabled",
                   "label": "Status",
                   "sort": true,
                   mapping: function (field) {
                       return field ? "Disabled" : "Enabled";
                   }
               }
           ],
           "moreInfo": [
               {
                   "field": "name",
                   "label": "Name",
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "account",
                   "label": "Account",
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "start_offset",
                   "label": "Start Offset",
                   mapping: function (field) {
                       if (!field){
                           return "0";
                       }
                       else {
                           return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                       }
                   }
               },
			   {
                   "field": "start_date",
                   "label": "Start Date",
                   mapping: function (field) {
                       if (!field){
                           return "1970-01-01T00:00:00Z";
                       }
                       else {
                           return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                       }
                   }
               },
               // Common fields
               {
                   "field": "interval",
                   "label": "Interval",
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "index",
                   "label": "Index",
                   mapping: function (field) {
                       return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                   }
               },
               {
                   "field": "disabled",
                   "label": "Status",
                   mapping: function (field) {
                       return field ? "Disabled" : "Enabled";
                   }
               }
           ],
           "services": {
               "input": {
                   "title": "Falcon Host",
                   "model": Input,
                   "url": "",
                   "collection": Inputs,
                   "entity": [
                       {
                           "field": "name",
                           "label": "Name",
                           "type": TextControl,
                           "required": true,
                           "help": "A unique name for the CrowdStrike Falcon Host data input."
                       },
                       {
                           "field": "account",
                           "label": "Account",
                           "type": SingleInputControl,
                           "required": true,
                           "options": {}
                       },
                       {
                           "field": "start_offset",
                           "label": "Start Offset",
                           "type": TextControl,
                           "defaultValue": "0",
                           "help": "The offset number after which to collect data.(For query API, this will be used only for indicators)"
                       },
					   {
                           "field": "start_date",
                           "label": "Start Date",
                           "type": TextControl,
                           "defaultValue": "1970-01-01T00:00:00Z",
                           "help": "The date (UTC in \"YYYY-MM-DDThh:mm:ssZ\" format) from when to start collecting the data. Default value is 1970-01-01T00:00:00Z (For query API, this will be used for devices and detections)"
                       },
                       {
                           "field": "interval",
                           "label": "Interval",
                           "type": TextControl,
                           "required": true,
                           "defaultValue": "3600",
                           "help": "Time interval of input in seconds."
                       },
                       {
                           "field": "index",
                           "label": "Index",
                           "type": SingleInputControlEx,
                           "required": true,
                           "defaultValue": "default"
                       }
                   ],
                   "actions": [
                       "edit",
                       "delete",
                       "enable",
                       "clone"
                   ]
               }
           },
           filterKey: ['name', 'service', 'account', 'url', 'start_offset', 'index', 'interval', 'status']
        },

        "account": {
            "model": Account,
            "title": "CrowdStrike Account",
            "header": [
                {
                    "field": "name",
                    "label": "Name",
                    "sort": true,
                    mapping: function (field) {
                        return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    }
                },
                {
                    "field": "api_uuid",
                    "label": "API UUID/Username",
                    "sort": true,
                    mapping: function (field) {
                        return field.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    }
                }
            ],
            "entity": [
                {
                    "field": "name",
                    "label": "Name",
                    "type": TextControl,
                    "required": true,
                    "help": "A unique name for each CrowdStrike Falcon Host account."
                },
                {
                    "field": "api_type",
                    "label": "API Type",
                    "required": true,
                    "type": SingleInputControl,
                    "options": {
                        "disableSearch": true,
                        "autoCompleteFields": [
                            {"label": "Streaming", "value": "Streaming"},
                            {"label": "Query", "value": "Query"}
                        ]
                    },
                    "defaultValue": "Streaming"
                },
                {
                    "field": "endpoint",
                    "label": "Endpoint",
                    "type": TextControl,
                    "required": true,
                    'display': false,
                    "defaultValue":"https://firehose.crowdstrike.com/sensors/entities/datafeed/v1",
                    "options": {
                        "enabled": false,
                        "placeholder": "https://firehose.crowdstrike.com/sensors/entities/datafeed/v1"
                    }
                },
                {
                    "field": "api_uuid",
                    "label": "API UUID/Username",
                    "type": TextControl,
                    "required": true
                },
                {
                    "field": "api_key",
                    "label": "API Key/Password",
                    "type": TextControl,
                    "required": true,
                    "encrypted": true
                }
            ],
            "refLogic": function (model, refModel) {
                return model.entry.attributes.name === refModel.entry.content.attributes.account;
            },
            "actions": [
                "edit",
                "delete"
            ],
            "tag": "server"
        },

        "proxy": {
            "title": "Proxy",
            "entity": [
                {"field": "proxy_enabled", "label": "Enable", "type": SyntheticCheckboxControl},
                {
                    "field": "proxy_type",
                    "label": "Proxy Type",
                    "type": SingleInputControl,
                    "options": {
                        "disableSearch": true,
                        "autoCompleteFields": [
                            {"label": "http", "value": "http"},
                            {"label": "socks4", "value": "socks4"},
                            {"label": "socks5", "value": "socks5"}
                        ]
                    },
                    "defaultValue": "http"
                },
                {"field": "proxy_url", "label": "Host", "type": TextControl},
                {"field": "proxy_port", "label": "Port", "type": TextControl},
                {"field": "proxy_username", "label": "Username", "type": TextControl},
                {
                    "field": "proxy_password",
                    "label": "Password",
                    "type": TextControl,
                    "encrypted": true,
                    "associated": "username"
                }
            ]
        },
        "logging": {
            "title": "Logging",
            "entity": [
                {
                    "field": "loglevel",
                    "label": "Log Level",
                    "type": SingleInputControl,
                    "options": {
                        "disableSearch": true,
                        "autoCompleteFields": [
                            {"label": "INFO", "value": "INFO"},
                            {"label": "DEBUG", "value": "DEBUG"},
                            {"label": "ERROR", "value": "ERROR"}
                        ]
                    },
                    "defaultValue": "INFO"
                }
            ]
        }
    };
});
