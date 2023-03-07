define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/detection/detection',
], function(_, Modal, Detection) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "IP data autodetection",
                wide: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.numberOfEvents = 150;

            this.detection = new Detection({
                restService: options.restService,
                section: options.section,
                query: this.getQuery(),
                formats: this.getFormats(),
            });
        },

        getQuery: function() {
            return 'index=* earliest=-1d latest=+1d | eval tags=if(tag == "network" AND tag == "communicate", 1, 0) ' +
                   '| top ' + this.numberOfEvents + ' tags, _indextime, _raw by index, sourcetype ' +
                   '| fields index, sourcetype, tags, _indextime, _raw';
        },

        getFormats: function() {
            return [
                {
                    id: "juniper_netscreen",
                    fullName: "Juniper Netscreen",
                    sourcetype: "netscreen:firewall",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2847/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/juniper/About",
                    regexs: [/\s+([^\s]+)\:\s+NetScreen\s+device_id\=/],
                },
                {
                    id: "juniper_junos",
                    fullName: "Juniper Junos OS",
                    sourcetype: "juniper:junos:firewall",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2847/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/juniper/About",
                    regexs: [/\s+([\.\w\-]+)\s+(RT_FLOW|RT_IDS):\s+([^:]+):/],
                },
                {
                    id: "bro",
                    fullName: "BRO Connection",
                    sourcetype: "bro_conn",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1617/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/BroIDS/Description",
                    regexs: [/^[0-9\.]+\s+[A-Za-z0-9]+\s+[\w\-\.:]{1,100}\s+[0-9]+\s+[\w\-\.:]{1,100}\s+[0-9]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[^\s]+\s+[A-z]+[0-9]*\s+.*/],
                },
                {
                    id: "netflow",
                    fullName: "Cisco NetFlow",
                    sourcetype: "netflow",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1658/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/NetFlow/Overview",
                    regexs: [/[^,]*,[^,]*,[^\s,]*,[\w\-\.:]{1,100},[\w\-\.:]{1,100},[\d]+,[\d]+,[^\s,]+,([^,]+,)+/],
                },
                {
                    id: "aws_vpcflow",
                    fullName: "AWS VPC Flow",
                    sourcetype: "aws:cloudwatchlogs:vpcflow",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1876/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/AWS/Description",
                    regexs: [/^\s*(\d{4}-\d{2}-\d{2}.\d{2}:\d{2}:\d{2}[.\d\w]*)?\s*([^\s]+\s+){3}([\w\-\.:]{1,100}\s+){2}([\d]+\s+){7}([A-z]+\s*){2}/],
                },
                {
                    id: "ms_sysmon",
                    fullName: "Microsoft Sysmon",
                    sourcetype: "XmlWinEventLog:Microsoft-Windows-Sysmon/Operational",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1914/",
                    documentationLink: "https://splunkbase.splunk.com/app/1914/#/details",
                    regexs: [/<Event [^\s>]+><System>[^=]+=.{0,1}Microsoft-Windows-Sysmon.{0,1}/],
                },
                {
                    id: "pan_traffic",
                    fullName: "Palo Alto Networks Traffic",
                    sourcetype: "pan:traffic",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2757/",
                    documentationLink: "https://splunkbase.splunk.com/app/2757/#/details",
                    regexs: [/^[^,]+,[^,]+,[^,]+,TRAFFIC,/],
                },
            ]
        },

        detect: function(stats) {
            this.render();
            this.detection.refreshProviders(stats);
            this.detection.detect();
        },

        render: function() {
            this.renderModal(this.detection.template);
            this.showModal();
            return this;
        },
    });
});
