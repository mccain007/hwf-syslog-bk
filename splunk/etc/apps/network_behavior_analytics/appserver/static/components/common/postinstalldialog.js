define([
    'jquery',
    'underscore',
    'nba/components/common/modal',
    'nba/components/api/keyreset',
    'nba/components/api/keyactivationform',
    'nba/components/settings/configproxy',
    'nba/components/common/handleresterror',
], function($, _, Modal, KeyReset, KeyActivationForm, ConfigProxy, handleRestError) {
    if(typeof(String.prototype.trim) === "undefined") {
        String.prototype.trim = function() {
            return String(this).replace(/^\s+|\s+$/g, '');
        };
    }

    return Modal.extend({
        initialize: function (options) {
            _.extend(options, {
                title: "AlphaSOC API Key Generation",
                wide: true,
                noClose: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.restService = options.restService;
        },

        events: $.extend({}, Modal.prototype.events, {
            'click a.save-api-key': 'saveApiKey',
            'click a.key-reset': 'resetApiKey',
            'click a.link-existing-user': 'showExistingUserDetails',
            'click a.link-new-user': 'showNewUserDetails',
            'click a.proxy-settings': 'toggleProxySettings'
        }),

        showDialog: function() {
            this.render();
        },

        showExistingUserDetails: function(e) {
            e.preventDefault();
            this.$('div.details-existing-user').show('fast');
            this.$('div.details-new-user').hide('fast');
        },

        showNewUserDetails: function(e) {
            e.preventDefault();
            this.$('div.details-new-user').show('fast');
            this.$('div.details-existing-user').hide('fast');
        },

        toggleProxySettings: function(e) {
            e.preventDefault();
            var details = this.$('div.details-proxy-settings');
            var link = this.$('a.proxy-settings');

            if (details.is(':hidden')) {
                link.text('Hide proxy settings');
                details.show('fast');
            } else {
                link.text('Proxy settings');
                details.hide('fast');
            }
        },

        parseRestError: function (err) {
            return handleRestError(err);
        },

        saveApiKey: function(e) {
            e.preventDefault();
            var input = this.$('input.api-key-input');
            var link = this.$('a.save-api-key');
            var apiKey = input.val().trim();
            var errorsDiv = this.$('div.api-key-error');

            if (!apiKey) {
                errorsDiv.text('You have to provide your API key').show();
                return;
            }

            errorsDiv.text('').hide();
            input.attr('disabled', true);
            link.attr('disabled', true);

            this.restService.post('/network_behavior_analytics/account/status', {api_key: apiKey}, function(err, response) {
                input.attr('disabled', false);
                link.attr('disabled', false);
                if (err) {
                    errorsDiv.text(this.parseRestError(err)).show();
                    return;
                }

                if (response.data.hasOwnProperty('error')) {
                    errorsDiv.text(response.data.error).show();
                    return;
                }

                // when there's no error in the response the key should be valid,
                // but let's check it one more time
                if (response.data.valid !== true) {
                    errorsDiv.text('Invalid API Key').show();
                    return;
                }

                // all ok, hide the window
                this.noClose = false;
                this.closeModal();
            }.bind(this));
        },

        resetApiKey: function (ev) {
            ev.preventDefault();
            this.$('div.key-reset-div').toggle('fast');
        },

        onKeySuccess: function() {
            this.noClose = false;
            this.renderSuccessFooter();
        },

        onSuccess: function() {
            this.$('div.post-install-body').hide();
            this.$('div.success-notice').show();
        },

        run: function() {
            this.restService.get('/network_behavior_analytics/account/status', {}, function(err, resp) {
                if (err) {
                    console.log(err);
                } else {
                    if (resp.data.key !== "") return;
                    else if (resp.data.not_admin) return;
                    this.showDialog();
                }
            }.bind(this));
            return this;
        },

        render: function() {
            this.renderModal(this.template);

            new KeyActivationForm({
                el: $('div.key-activation-form', this.$el),
                restService: this.restService,
                keyRequest: true,
                onKeySuccess: this.onKeySuccess.bind(this),
                onSuccess: this.onSuccess.bind(this),
            }).render();

            new ConfigProxy({
                el: this.$('div.details-proxy-settings'),
                restService: this.restService
            }).render().refresh();

            new KeyReset({
                el: this.$('div.key-reset-div'),
                restService: this.restService
            }).render();

            this.showModal();
            return this;
        },

        template: '' +
            '<div class="body-main modal-post-install-dialog">' +
                '<div class="post-install-body">' +
                    '<h3 style="margin-bottom: 20px; padding-right: 20px">' +
                        'Thank you for installing Network Behavior Analytics for Splunk! To use ' +
                        'the application you must have an API key. Please follow the steps below.' +
                    '</h3>' +
                    '<p><a href="#" class="link-existing-user">&raquo; I\'m an existing user</a></p>' +
                    '<div class="details-existing-user" style="padding-left: 9px; padding-bottom: 25px; display: none">' +
                        '<p>Please enter your API key</p>' +
                        '<div>' +
                            '<div style="float: left; width: 70%; padding-right: 20px">' +
                                '<input type="text" style="width: 100%" class="api-key-input"/>' +
                            '</div>' +
                            '<a href="#" class="btn btn-primary save-api-key">Save</a>' +
                        '</div>' +
                        '<div style="display: none; clear: both; color: #d02020; margin-bottom: 10px" class="errors api-key-error"></div>' +
                        '<div style="clear: both">' +
                            '<a href="#" class="key-reset">I lost my API key</a>' +
                            '<div class="key-reset-div" style="display: none"></div>' +
                        '</div>' +
                    '</div>' +
                    '<p><a href="#" class="link-new-user">&raquo; I\'m a new user and I want to generate a free key</a></p>' +
                    '<div class="details-new-user" style="padding-left: 9px; display: none">' +
                        '<p style="padding-right: 80px">' +
                            'Provide your details below to generate an AlphaSOC API key. ' +
                            'The application will contact our licensing server and activate ' +
                            'the key upon you clicking the verification link sent via email.' +
                        '</p>' +
                        '<p>' +
                            'By requesting an API key, you agree to the ' +
                            '<a href="https://www.alphasoc.com/terms-of-service/" target="_blank">' +
                            'Terms of Service and Privacy Policy ' +
                            '<i class="icon-external"></i>'+
                            '</a>.'+
                        '</p>'+
                        '<div class="key-activation-form"></div>' +
                    '</div>' +
                    '<p style="margin: 30px 0 -8px; opacity: 0.6"><a href="#" class="proxy-settings">Proxy settings</a></p>' +
                    '<div class="details-proxy-settings" style="display: none"></div>' +
                '</div>' +
                '<div class="success-notice" style="display: none">' +
                    '<h3>Thank you!</h3>' +
                    '<p>Your evaluation API key has been generated. Please check your email and click the verification link to activate the product.</p>' +
                '</div>' +
            '</div>'
    });
});
