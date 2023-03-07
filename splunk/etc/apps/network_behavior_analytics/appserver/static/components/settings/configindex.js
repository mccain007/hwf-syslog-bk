define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        initialize: function (options) {
            _.extend(this, _.pick(options, "restService", "restEndpoint", "section", "onChange"));
            if (!this.restEndpoint) {
                this.restEndpoint = "logsindex";
            }

            this.restUrl = "/network_behavior_analytics/settings/" + this.restEndpoint;
        },

        events: {
            'click button': 'saveClicked'
        },

        disable: function(disable) {
            if (disable) {
                this.$('input').attr('disabled', true);
                this.$('button').attr('disabled', true);
                this.$('div.errors').text('');
                this.$('div.success').text('');
            } else {
                this.$('input').removeAttr('disabled');
                this.$('button').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.showError(message);
        },

        showError: function(msg) {
            this.$('div.success').text('');
            this.$('div.errors').text(msg);
        },

        showSuccess: function(msg) {
            this.$('div.errors').text('');
            this.$('div.success').text(msg);
        },

        saveClicked: function() {
            this.disable(true);
            var index = this.$('input').val();

            var payload = {'index': index}
            if (this.section) {
                payload['section'] = this.section;
            }

            this.restService.post(this.restUrl, payload, function(err) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.showSuccess('Index has been changed.');
                    if (this.onChange) {
                        this.onChange();
                    }
                }
                this.disable(false);
            }.bind(this));
        },

        refresh: function() {
            this.disable(true);

            var payload = {}
            if (this.section) {
                payload['section'] = this.section;
            }

            this.restService.get(this.restUrl, payload, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.$('input').val(response.data.index);
                }
                this.disable(false);
            }.bind(this));

            return this;
        },

        render: function () {
            this.$el.html(this.template(this));
            return this;
        },

        template: _.template(
            '<input type="text" value="" disabled="disabled" class="config-input" />' +
            '<button type="button" class="btn btn-default conf-save">Save</button>' +
            '<div class="errors config-error"></div>' +
            '<div class="success config-success"></div>'
        )
    });
});
