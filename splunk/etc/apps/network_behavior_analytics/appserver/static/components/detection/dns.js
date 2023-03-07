define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/detection/detection',
], function(_, Modal, Detection) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "DNS data autodetection",
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
            return 'index=* earliest=-1d latest=+1d | eval tags=if(tag == "dns" AND tag == "network" AND tag == "resolution", 1, 0) ' +
                   '| top ' + this.numberOfEvents + ' tags, _indextime, _raw by index, sourcetype ' +
                   '| fields index, sourcetype, tags, _indextime, _raw';
        },

        getFormats: function() {
            return [
                {
                    id: "infoblox",
                    fullName: "Infoblox",
                    sourcetype: "infoblox:dns",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2934/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/Infoblox/About",
                    regexs: [/named\[\d+\]\:\s+[^]*client\s([\w\-\.:]{1,100})#(\d+).*\s(query):.*([\w\-\.:]{1,100})/],
                },
                {
                    id: "bind",
                    fullName: "ISC BIND",
                    sourcetype: "isc:bind:query",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2876/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/ISCBIND/About",
                    regexs: [/(?:\s+queries:)?(?:\s+([^:]+):)?\s+client\s+([\w\-\.:]{1,100})#(\d{1,5})(?:\s+\([^\)]+\))?:(?:\s+view\s+[^:]+:)?\s+query:\s+\(?([\w\-\.:]{1,100})\)?\s+([^\s]+)\s+([^\s]+)\s+[\+\-]([^\s]*)\s+\(([\w\-\.:]{1,100})\)/],
                },
                {
                    id: "ms",
                    fullName: "Microsoft DNS",
                    sourcetype: "MSAD:NT6:DNS",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/742/",
                    documentationLink: "https://docs.splunk.com/Documentation/WindowsAddOn/latest/User/AbouttheSplunkAdd-onforWindows",
                    regexs: [/(Rcv|Snd) ([^ ]+).* R? (Q|N|U|\?) \[.*\]\s+([^\s]+).*\s((\([^ ]+\))|([^\s\.]+\.[^\s\.]+)+)\s*/],
                },
                {
                    id: "bro",
                    fullName: "BRO DNS",
                    sourcetype: "bro_dns",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1617/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/BroIDS/Description",
                    regexs: [/^[0-9\.]+\s+[A-Za-z0-9]+\s+[^\s]+\s+[\d]+\s+[^\s]+\s+[\d]+\s+[^\s]+\s+[\d]+\s+[^\s]+\s+[\d\s-]+[^\s]+\s+.+/],
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
