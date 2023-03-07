define([
    'underscore',
    'jquery',
    'backbone',
], function(_, $, Backbone) {
    return Backbone.View.extend({
        REST_URL: '/splunkd/__raw/network_behavior_analytics/data/logsexport',

        initialize: function(options) {
            _.extend(this, _.pick(options));
        },

        events: {
            'click #nba-logs-export': 'exportClicked',
        },

        exportClicked: function(ev) {
            ev.preventDefault();
            window.location = this.REST_URL;
            return false;
        },

        render: function() {
            this.$el.html(this.template());
            return this;
        },

        template: _.template(
            '<button id="nba-logs-export" class="btn btn-primary">Download application logs</button>'
        ),
    });
});
