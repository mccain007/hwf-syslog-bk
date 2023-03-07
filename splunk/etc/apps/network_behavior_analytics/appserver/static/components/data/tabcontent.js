define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/data/providerstats',
    'nba/components/data/logsindex',
    'nba/components/data/status',
], function(_, $, Backbone, ProviderStats, LogsIndex, DataStatus) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "id", "title", "dataName",
                "queryMacro", "queryTags", "enabledLabel", "successMsg", "detection"));

            this.stats = new ProviderStats({
                restService: this.restService,
                section: this.id,
                title: this.title,
                dataName: this.dataName,
                detection: this.detection,
                queryMacro: this.queryMacro,
                queryTags: this.queryTags,
            });

            this.index = new LogsIndex({
                restService: this.restService,
                section: this.id,
                title: this.title,
                dataName: this.dataName,
                enabledLabel: this.enabledLabel,
                onIndexChange: function() { this.stats.refreshSearch(); }.bind(this),
            });

            this.status = new DataStatus({
                restService: this.restService,
                section: this.id,
                title: this.title,
                dataName: this.dataName,
                successMsg: this.successMsg,
                renderDesc: true,
            });
        },

        setElements: function() {
            this.stats.setElement($('.data-logs-stats', this.$el));
            this.index.setElement($('.data-logs-index', this.$el));
            this.status.setElement($('.data-logs-status', this.$el));
        },

        hide: function() {
            this.$el.html("");
        },

        refresh: function() {
            this.stats.refresh();
            this.index.refresh();
            this.status.refresh();

            return this;
        },

        render: function() {
            this.$el.html(this.template(this));
            this.setElements();

            this.stats.render();
            this.index.render();
            this.status.render();

            return this;
        },

        template: _.template(
            '<div class="data-logs-stats"></div>' +
            '<div class="data-logs-index"></div>' +
            '<div class="data-logs-status"></div>'
        ),
    });
});
