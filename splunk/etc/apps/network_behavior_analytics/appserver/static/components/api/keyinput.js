define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/api/evaluationrequestdialog',
    'nba/components/api/keyresetdialog',
    'nba/components/api/keyactivationdialog',
    'nba/components/common/handleresterror'
], function (_, $, Backbone, EvaluationRequestDialog, KeyResetDialog, KeyActivationDialog, handleRestError) {
    return Backbone.View.extend({
        initialize: function (options) {
            _.extend(this, _.pick(options, "restService", "onError"));
            this.children = {};
        },

        events: {
            'click button': 'saveClicked',
            'click a.key-request-link': 'requestEvaluationKey',
            'click a.key-reset-link': 'requestKeyReset',
            'click a.key-activate-link': 'requestKeyActivation',
        },

        disable: function(disable) {
            if (disable) {
                this.$('input').attr('disabled', true).removeClass('has-error').removeClass('is-valid')
                this.$('div.errors').text('');
            } else {
                this.$('input').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            if (this.onError) {
                this.onError(handleRestError(err));
            } else {
                var message = handleRestError(err);
                this.$('.api-key-valid').hide();
                this.$('div.errors').text(message);
            }
        },

        requestEvaluationKey: function() {
            if (this.children.evaluationRequestDialog) {
                this.children.evaluationRequestDialog.remove();
            }

            this.children.evaluationRequestDialog = new EvaluationRequestDialog({
                keyboard: true,
                restService: this.restService,
                onRequestSuccessful: this.keyRequestSuccessful.bind(this)
            }).render();
        },

        keyRequestSuccessful: function(response) {
            this.$('input').val(response.data.key);
            this.updateView(response.data);
        },

        requestKeyActivation: function() {
            if (this.children.keyActivationDialog) {
                this.children.keyActivationDialog.remove();
            }

            this.children.keyActivationDialog = new KeyActivationDialog({
                keyboard: true,
                restService: this.restService
            }).render();
        },

        requestKeyReset: function() {
            if (this.children.keyResetDialog) {
                this.children.keyResetDialog.remove();
            }

            this.children.keyResetDialog = new KeyResetDialog({
                keyboard: true,
                restService: this.restService
            }).render();
        },

        saveClicked: function() {
            this.saveKey(this.$('input').val());
        },

        saveKey: function(apiKey) {
            this.disable(true);

            this.restService.post('/network_behavior_analytics/account/status', { api_key: apiKey }, function (err, response) {
                if (err) {
                    this.handleRestError(err)
                } else {
                    this.updateView(response.data);
                }
                this.disable(false);
            }.bind(this));
        },

        updateView: function(status) {
            var input = this.$('input');
            var keyRequest = this.$('.key-request').hide();
            var keyReset = this.$('.key-reset').hide();
            var keyActivate = this.$('.key-activate').hide();
            var keyValid = this.$('.api-key-valid').hide();
            var button = this.$('button');

            input.val(status.key);

            if (status.key === "" && status.not_admin === false) {
                keyRequest.show();
                keyReset.show();
            } else if (status.valid === true && status.registered === false && status.not_admin === false) {
                keyActivate.show();
            } else if (status.valid === false && status.key !== "") {
                input.addClass('has-error');
                if (status.not_admin === false) {
                    keyReset.show();
                }
            }

            if (status.valid === true) {
                input.addClass('is-valid');
                if (status.registered === true) {
                    keyValid.show();
                }
            }
        },

        refresh: function() {
            this.disable(true);

            this.restService.get('/network_behavior_analytics/account/status', {}, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.updateView(response.data);
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
                'To enable scoring of your network data, ensure your API key is set below. ' +
                '<span class="key-request" style="display: none">' +
                    '<a href="#" class="key-request-link"><b>Request an evaluation key</b></a>.' +
                '</span>' +
            '</p>' +
            '<div class="api-key-input-form">' +
                '<input type="text" disabled="disabled" />' +
                '<button type="button" class="btn btn-default" style="margin: -3px 0 0 5px">Save</button>' +
            '</div>' +
            '<div class="errors config-error api-key-error"></div>' +
            '<div class="key-reset" style="display: none">' +
                '<a href="#" class="key-reset-link">I lost my API key.</a>' +
            '</div>' +
            '<div class="key-activate" style="display: none">' +
                '<b>Your API key has not been activated.</b> Please check your email or ' +
                '<a href="#" class="key-activate-link"><b>Activate Network Behavior Analytics</b></a>' +
                ' to enable full scoring and alerting.<br/>' +
                'If you have another activated API key, you can ' +
                '<a href="#" class="key-reset-link">reset it via email.</a>' +
            '</div>' +
            '<div class="api-key-valid" style="display: none">Your API key is valid.</div>'
        )
    });
});
