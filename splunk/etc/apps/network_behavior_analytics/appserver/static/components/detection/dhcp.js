define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/detection/detection',
], function(_, Modal, Detection) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "DHCP data autodetection",
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
            return 'index=* earliest=-1d latest=+1d | eval tags=if(tag == "network" AND tag == "session" AND tag == "dhcp", 1, 0) ' +
                   '| top ' + this.numberOfEvents + ' tags, _indextime, _raw by index, sourcetype ' +
                   '| fields index, sourcetype, tags, _indextime, _raw';
        },

        getFormats: function() {
            return [
                {
                    id: "isc",
                    fullName: "ISC DHCP",
                    sourcetype: "isc:dhcp",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3010/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/ISCDHCP/About",
                    regexs: [/\[\d+\]\:\s+[^\s]+\s+on\s+[\w\-\.:]{1,100}\s+to\s+[\w\-\.:]{1,100}\s+[\(]?[^\)]*[\)]?\s*via/],
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
