define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        DEFAULT_CONFIG_URL: '/servicesNS/nobody/network_behavior_analytics/properties/nba/',
        REST_API_URL: '/network_behavior_analytics/api/url',

        initialize: function(options) {
            _.extend(this, _.pick(options, "stanza", "setting", "label", "restService",
                "onError", "onChange", "onRefreshed", "renderDesc"));

            if (!this.stanza) {
                this.stanza = "main"
            }
            this.configUrl = options.configUrl || this.DEFAULT_CONFIG_URL + this.stanza + "/";

            this.description = options.description || "";
            if (this.renderDesc) {
                this.descApiUrl();
            }
        },

        events: {
            'click input': 'checkboxClicked'
        },

        handleRestError: function(err) {
            if (this.onError) {
                var message = handleRestError(err);
                this.onError(message);
            }
        },

        descApiUrl: function() {
            var url = undefined;
            this.restService.get(this.REST_API_URL, {}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    url = response.data.url;
                    if (url === "" || url === undefined) {
                        url = "your url"
                    }
                    $('.on-premise-desc-url').html(url);
                }
            }.bind(this));
        },

        checkboxClicked: function() {
            var input = this.$('input');
            input.attr("disabled", true);

            this.restService.post(this.configUrl + this.setting, {
                value: input.prop('checked') ? "1" : "0"
            }, function(err, response) {
                if (this.onChange) this.onChange(input.prop('checked'));
                if (err) {
                    this.handleRestError(err);
                    this.refresh();
                }
                input.removeAttr("disabled");
            }.bind(this));
        },

        refresh: function() {
            var input = this.$('input');
            input.attr('disabled', true);

            this.restService.get(this.configUrl + this.setting, {}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    var value = response.data.toLowerCase();
                    input.prop('checked', value === "1" || value === "t" || value === "true");
                    input.removeAttr('disabled');
                    if (this.onRefreshed) this.onRefreshed(input.prop('checked'));
                }
            }.bind(this));
        },

        render: function() {
            this.$el.html(this.template(this));
            return this;
        },

        template: _.template(
            '<div style="margin-bottom: 5px">' +
                '<input type="checkbox" disabled="disabled"/> ' +
                '<span>' +
                    '<%= label %>' +
                    '<% if (description) { %> ' +
                        '<a data-toggle="collapse" href="#checkbox-<%= setting %>" aria-expanded="false" aria-controls="checkbox-<%= setting %>">' +
                            'Learn more <span class="caret"></span>' +
                        '</a>' +
                    '<% } %>' +
                '</span>' +
            '</div>' +
            '<% if (description) { %>' +
                '<div class="collapse" id="checkbox-<%= setting %>">' +
                    '<p><%= description %></p>' +
                '</div>' +
            '<% } %>'
        )
    });
});
