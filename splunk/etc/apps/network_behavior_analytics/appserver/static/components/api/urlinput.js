define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror'
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/api/url',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService"));
        },

        events: {
            'click button': 'saveClicked',
        },

        disable: function(disable) {
            if (disable) {
                this.$('input').attr('disabled', true)
                this.$('div.errors').text('');
            } else {
                this.$('input').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.$('div.errors').text(message);
        },

        saveClicked: function() {
            this.disable(true);

            var url = this.$('input').val();
            this.restService.post(this.REST_URL, {url: url}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    if (url === "" || url === undefined) {
                        url = "your url"
                    }
                    $('.on-premise-desc-url').html(url);
                }
                this.disable(false);
            }.bind(this));
        },

        refresh: function() {
            this.disable(true);

            this.restService.get(this.REST_URL, {}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.$('input').val(response.data.url)
                }
                this.disable(false);
            }.bind(this));

            return this;
        },

        render: function() {
            this.$el.html(this.template({}));
            return this;
        },
        
        template: _.template(
            '<p>' +
                'Please enter the URI of your AlphaSOC AE instance. ' +
                'To discuss on-premise deployment, please contact ' +
                '<a href="mailto:support@alphasoc.com"><b>support@alphasoc.com</b></a>' +
            '</p>' +
            '<input type="text" disabled="disabled" />' +
            '<button type="button" class="btn btn-default" style="margin: -3px 0 0 5px">Save</button>' +
            '<div class="errors config-error"></div>'
        )
    });
});
