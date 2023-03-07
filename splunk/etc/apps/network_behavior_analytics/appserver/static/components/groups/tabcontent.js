define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/groups/contentview',
    'nba/components/groups/anomalydetection',
], function(_, $, Backbone, GroupContentView, AnomalyDetection) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "id", "title", "anomalyEnabled"));

            this.entry = new GroupContentView({
                el: $('div.groups-panel[data-entries-type="' + this.id + '"]'),
                restService: this.restService,
                entryType: this.id,
                tableHeight: this.anomalyEnabled ? 351 : 375,
            });

            this.anomaly = null;
            if (this.anomalyEnabled) {
                this.anomaly = new AnomalyDetection({
                    el: $('div.anomaly-detection[data-entries-type="' + this.id + '"]'),
                    restService: this.restService,
                    entryType: this.id,
                    label: "Alert upon any requests outside of the whitelist",
                    description: "In high-assurance environments, use this feature to generate alerts whenever systems request " +
                        "names or ip addresses outside of the defined whitelist. This feature is extremely sensitive and should only " +
                        "be used to monitor systems with predictable network traffic patterns (e.g. database servers).",
                });
            }
        },

        hide: function() {
            if (this.entry) this.entry.$el.html("");
            if (this.anomaly) this.anomaly.$el.html("");
        },

        refreshGroup: function(groupName) {
            if (this.entry) this.entry.refreshGroup(groupName);
            if (this.anomaly) this.anomaly.refreshGroup(groupName);
        },

        refresh: function() {
            if (this.entry) this.entry.refresh();
            if (this.anomaly) this.anomaly.refresh();

            return this;
        },

        render: function() {
            if (this.entry) this.entry.render();
            if (this.anomaly) this.anomaly.render();

            return this;
        },
    });
});
