define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/settings/configindex',
    'nba/components/settings/configcheckbox',
], function(_, $, Backbone, ConfigIndex, ConfigCheckbox) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "section", "title",
                "dataName", "enabledLabel", "onIndexChange"));

            this.index = new ConfigIndex({
                restService: this.restService,
                restEndpoint: "logsindex",
                section: this.section,
                onChange: this.onIndexChange,
            });

            this.enabled = new ConfigCheckbox({
                restService: this.restService,
                stanza: this.section,
                setting: "enabled",
                label: this.enabledLabel,
                renderDesc: false,
                onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); },
            });
        },

        setElements: function() {
            this.index.setElement($('.data-logs-index-input', this.$el));
            this.enabled.setElement($('.data-logs-enabled', this.$el));
        },

        refresh: function() {
            this.index.refresh();
            this.enabled.refresh();

            return this;
        },

        render: function() {
            this.$el.html(this.template(this));
            this.setElements();

            this.index.render();
            this.enabled.render();

            return this;
        },

        template: _.template(
            '<h2 class="panel-title"><%= title %> data location</h2>' +
            '<p>By default, the application searches all available indexes for <%= dataName %> events. To ' +
            'optimize performance, you can narrow this search to a particular index. If your data exists ' +
            'across multiple indexes, specify each separated by a comma.</p>' +
            '<div class="data-logs-index-input"></div>' +

            '<h2 class="panel-title">Analytics settings</h2>' +
            '<div class="data-logs-enabled"></div>'
        ),
    });
});
