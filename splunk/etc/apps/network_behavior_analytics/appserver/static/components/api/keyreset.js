define([
    'underscore',
    'jquery',
    'backbone'
], function(_, $, Backbone) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, 'restService', 'onSuccess'));
        },

        events: {
            'click button': 'resetClicked',
            'input input': 'inputChanged',
        },

        disableControls: function(disable) {
            var btn = this.$('button');
            var input = this.$('input');

            if (disable) {
                btn.attr('disabled', 'disabled');
                input.attr('disabled', 'disabled');
            } else {
                btn.removeAttr('disabled');
                input.removeAttr('disabled');
            }
        },

        inputChanged: function(ev) {
            var val = this.$(ev.target).val().trim();
            var button = this.$('button');

            if (val === "") {
                button.attr('disabled', 'disabled')
            } else {
                button.removeAttr('disabled');
            }
        },

        resetClicked: function() {
            var email = this.$('input').val().trim();
            var errors = this.$('div.errors');

            errors.hide();
            this.disableControls(true);

            this.restService.post('/network_behavior_analytics/api/key/reset', {email: email}, function(err, response) {
                if (err) {
                    var message;
                    if (err.data) {
                        message = err.data.error || err.data.message;
                    }
                    if (!message) {
                        message = 'An error occured. Try again later.';
                        console.log(err);
                    }
                    errors.text(message).show();
                } else {
                    this.$('div.main-body').hide();
                    this.$('div.success-notice').show();
                    if (this.onSuccess) this.onSuccess();
                }
                this.disableControls(false);
            }.bind(this));
        },

        render: function() {
            this.$el.html(this.template({}));
            return this;
        },

        template: _.template(
            '<div class="main-body">' +
                '<p>Please enter your email address below</p>' +
                '<input style="width: 64%" name="email" type="email" />' +
                '<button type="button" disabled="disabled" class="btn btn-default conf-save">Reset API key</button>' +
                '<div class="errors" style="color: #d02020; display: none"></div>' +
            '</div>' +
            '<div class="success-notice" style="display: none">' +
                '<h4>API key reset request completed</h4>' +
                '<p>You will receive an email with further instructions.</p>' +
            '</div>'
        )
    })
});
