define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/api/keyactivationform',
], function(_, Modal, KeyActivationForm) {
    return Modal.extend({
        initialize: function (options) {
            _.extend(options, {
                title: "AlphaSOC API Key Generation",
                wide: true,
                withFooter: true,
                withCancel: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.restService = options.restService;
            this.onRequestSuccessful  = options.onRequestSuccessful;
        },

        onKeySuccess: function(response) {
            if (this.onRequestSuccessful) this.onRequestSuccessful(response);
            this.renderSuccessButton();
        },

        onSuccess: function() {
            this.$('div.evaluation-request-body').hide();
            this.$('div.success-notice').show();
        },

        render: function() {
            this.renderModal(this.bodyTemplate);

            new KeyActivationForm({
                el: $('div.key-activation-form', this.$el),
                restService: this.restService,
                keyRequest: true,
                onKeySuccess: this.onKeySuccess.bind(this),
                onSuccess: this.onSuccess.bind(this),
            }).render();

            this.showModal();
            return this;
        },

        bodyTemplate: _.template(
            '<div class="evaluation-request-body">' +
                '<p>' +
                    'Provide your details below to generate an AlphaSOC API key. The application will contact our ' +
                    'licensing server and activate the key upon you clicking the verification link sent via email.' +
                '</p>' +
                '<p>' +
                    'By requesting an API key, you agree to the ' +
                    '<a href="https://www.alphasoc.com/terms-of-service/" target="_blank">' +
                        'Terms of Service and Privacy Policy <i class="icon-external"></i>' +
                    '</a>.' +
                '</p>' +
                '<div class="key-activation-form"></div>' +
            '</div>' +
            '<div class="success-notice" style="display: none">' +
                '<h3>Thank you!</h3>' +
                '<p>Your evaluation API key has been generated. Please check your email and click the verification link to activate the product.</p>' +
            '</div>'
        ),
    });
});
