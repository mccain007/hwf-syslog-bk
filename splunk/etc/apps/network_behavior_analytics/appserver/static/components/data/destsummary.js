define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/settings/configcheckbox',
    'nba/components/settings/configindex',
    'nba/components/data/status',
], function(_, $, Backbone, ConfigCheckbox, ConfigIndex, DataStatus) {
    return Backbone.View.extend({
        initialize: function(options) {
            this.enabled = new ConfigCheckbox({
                el: $('#data-destinations-enabled'),
                restService: options.restService,
                stanza: "destinations",
                setting: "enabled",
                label: "Enable summary indexing of destinations",
                renderDesc: false,
                onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); },
            });

            this.index = new ConfigIndex({
                el: $('#data-destinations-index'),
                restService: options.restService,
                restEndpoint: "pullindex",
            });

            this.status = new DataStatus({
                el: $('#data-destinations-status'),
                restService: options.restService,
                section: "destinations",
                successMsg: "The application is storing summary data correctly.",
            });
        },

        refresh: function() {
            this.enabled.refresh();
            this.index.refresh();
            this.status.refresh();
            return this;
        },

        render: function() {
            this.enabled.render();
            this.index.render();
            this.status.render();
            return this;
        },
    });
});
