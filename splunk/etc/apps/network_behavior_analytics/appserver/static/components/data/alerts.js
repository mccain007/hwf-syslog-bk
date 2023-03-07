define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/settings/configindex',
    'nba/components/data/status',
], function(_, $, Backbone, ConfigIndex, DataStatus) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService"));

            this.index = new ConfigIndex({
                el: $('#data-alerts-index'),
                restService: this.restService,
                restEndpoint: "eventsindex",
            });

            this.status = new DataStatus({
                el: $('#data-alerts-status'),
                restService: this.restService,
                section: "alerts",
                successMsg: "The application is generating and storing events correctly.",
            });
        },

        refresh: function() {
            this.index.refresh();
            this.status.refresh();

            return this;
        },

        render: function() {
            this.index.render();
            this.status.render();

            return this;
        },
    });
});
