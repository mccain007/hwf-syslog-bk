define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/detection/detection',
], function(_, Modal, Detection) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "VPN data autodetection",
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
            return 'index=* earliest=-1d latest=+1d | eval tags=if(tag == "network" AND tag == "session" AND tag == "vpn", 1, 0) ' +
                   '| top ' + this.numberOfEvents + ' tags, _indextime, _raw by index, sourcetype ' +
                   '| fields index, sourcetype, tags, _indextime, _raw';
        },

        getFormats: function() {
            return [
                {
                    id: "cisco_asa",
                    fullName: "Cisco ASA",
                    sourcetype: "cisco:asa",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1620/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/CiscoASA/Description",
                    regexs: [/%(?:ASA|FTD)-\d+-\d{6}/],
                },
            ];
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
