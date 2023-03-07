define([
    'jquery',
    'underscore',
    'backbone',
], function($, _, Backbone) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "keyRequest", "onKeySuccess", "onSuccess"));

            if (this.keyRequest === true) {
                this.restUrl = "/network_behavior_analytics/api/key/request";
                this.buttonText = "Generate key";
            } else {
                this.restUrl = "/network_behavior_analytics/account/register";
                this.buttonText = "Activate product";
            }

            this.formFields = [
                {label: 'Name', name: 'name', type: 'text', required: true},
                {label: 'Organization', name: 'organization', type: 'text', required: true},
                {label: 'Email', name: 'email', type: "email", required: true},
                {label: 'Telephone', name: 'phone', type: 'text', required: false}
            ];
        },

        events: {
            'click .btn-submit': 'submit',
        },

        disable: function(disabled) {
            for (var i = 0; i < this.formFields.length; i++) {
                var el = this.$('input[name="' + this.formFields[i].name + '"]');
                disabled ? el.attr('disabled', true) : el.removeAttr('disabled');
            }

            var btn = this.$('button.btn-submit');
            if (disabled) {
                btn.text('Contacting the licensing server...').attr('disabled', true);
            } else {
                btn.text(this.buttonText).removeAttr('disabled');
            }
        },

        parseRestError: function(err) {
            var errorStatus = this.$('div.error-status');

            if (err.data.errors) {
                this.setFieldErrors(err.data.errors);
            } else if (err.data.error) {
                var errMsg = err.data.error
                try {
                    if (errMsg.indexOf("Email address already registered") > -1) {
                        if (this.keyRequest === true) {
                            errMsg = `This email address has a valid API key. Please select "I'm an existing user", ` +
                                `click "I lost my API key", and reset your key via email.`;
                        } else {
                            errMsg = `This email address has a valid API key. Please close this form ` +
                                `and reset your key via email.`;
                        }
                    }
                } catch {
                    errMsg = err.data.error
                }
                errorStatus.text(errMsg).show();
            } else {
                errorStatus.html(
                    'Request failed. Please contact <a href="mailto:support@alphasoc.com">' +
                    'support@alphasoc.com</a>.'
                ).show();
                console.log(err);
            }
        },

        setFieldErrors: function(fieldErrors) {
            for (var i = 0; i < this.formFields.length; i++) {
                var fieldName = this.formFields[i].name;
                var formError = this.$('span.form-errors[data-field="' + fieldName + '"]');
                formError.text(fieldErrors[fieldName] || "");
            }
        },

        clearFieldErrors: function() {
            this.setFieldErrors({})
        },

        getFormValues: function() {
            var form = this.$('form');
            var formValues = {};

            for (var i = 0; i < this.formFields.length; i++) {
                var field = this.formFields[i];
                formValues[field.name] = $('input[name="' + field.name + '"]', form).val();
            }

            return formValues;
        },

        submit: function(ev) {
            ev.preventDefault();

            this.disable(true);
            this.clearFieldErrors();
            this.$('div.success-status').hide();
            this.$('div.error-save-status').hide();
            this.$('div.error-status').hide();

            var formValues = this.getFormValues();
            this.restService.post(this.restUrl, formValues, function(err, response) {
                if (this.keyRequest === true) {
                    this.submittedKey(err, response);
                } else {
                    this.submittedActivate(err, response);
                }
            }.bind(this));
        },

        submittedActivate: function(err, response) {
            this.disable(false);

            if (err) {
                this.parseRestError(err);
            } else {
                if (this.onSuccess) this.onSuccess();
            }
        },

        submittedKey: function(err, response) {
            if (err) {
                if (err.data.key) {
                    this.saveKey(err.data.key, false);
                } else {
                    this.disable(false);
                }

                this.parseRestError(err);
            } else {
                this.saveKey(response.data.key, true);
            }
        },

        saveKey: function(apiKey, success) {
            var successStatus = this.$('div.success-status');
            var errorSaveStatus = this.$('div.error-save-status');

            this.restService.post('/network_behavior_analytics/account/status', { api_key: apiKey }, function (err, response) {
                this.disable(false);
                if (err) {
                    errorSaveStatus.html(
                        'Your API key has been generated but the application could not save it. Please contact ' +
                        '<a href="mailto:support@alphasoc.com">support@alphasoc.com</a>.'
                    ).show();
                } else {
                    if (this.onKeySuccess) this.onKeySuccess(response);

                    if (success === true) {
                        if (this.onSuccess) this.onSuccess();
                    } else {
                        successStatus.text(
                            "Your API key has been generated but the activation process has failed. " +
                            "Please close this window and go to the Settings tab to activate your API key."
                        ).show();
                    }
                }
            }.bind(this));
        },

        render: function() {
            this.$el.html(this.template({
                formFields: this.formFields,
                buttonText: this.buttonText,
            }));

            return this;
        },

        template: _.template(
            '<div class="activation-form">' +
                '<form class="form-horizontal key-activation">' +
                    '<% _(formFields).each(function(formField) { %>' +
                        '<div class="form-group">' +
                            '<label for="activation-form-<%= formField.name %>" class="col-sm-2 control-label"><%= formField.label %></label>' +
                            '<div class="col-sm-10">' +
                                '<input type="<%= formField.type %>" id="activation-form-<%= formField.name %>" name="<%= formField.name %>" class="form-control"/>' +
                                '<span class="form-errors" data-field="<%= formField.name %>"></span>' +
                            '</div>' +
                        '</div>' +
                    '<% }) %>' +
                    '<div class="form-group">' +
                        '<label class="col-sm-2 control-label"></label>' +
                        '<div class="col-sm-10">' +
                            '<button class="btn btn-primary btn-submit"><%= buttonText %></button>' +
                        '</div>' +
                    '</div>' +
                '</form>' +
                '<div class="success-status"></div>' +
                '<div class="error-save-status"></div>' +
                '<div class="error-status"></div>' +
            '</div>'
        ),
    });
});
