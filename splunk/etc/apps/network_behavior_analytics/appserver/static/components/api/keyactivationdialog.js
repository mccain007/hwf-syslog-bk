define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/api/keyactivationform',
], function(_, Modal, KeyActivationForm) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "Product activation",
                wide: true,
                withFooter: true,
                withCancel: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.restService = options.restService;
        },

        onSuccess: function() {
            this.$('div.introduction').hide();
            this.$('div.key-activation-form').hide();
            this.$('div.success-notice').show();
            this.renderSuccessButton();
        },

        render: function() {
            this.renderModal(this.bodyTemplate);

            new KeyActivationForm({
                el: $('div.key-activation-form', this.$el),
                restService: this.restService,
                keyRequest: false,
                onSuccess: this.onSuccess.bind(this),
            }).render();

            this.showModal();
            return this;
        },

        bodyTemplate: _.template(
            '<div class="introduction">' +
                '<p style="margin-bottom: 20px">' +
                    'To activate the product and enable all of the alerting and scoring features, ' +
                    'please complete the following fields, including a valid email address that ' +
                    'is used for verification purposes.' +
                '</p>' +
            '</div>' +
            '<div class="key-activation-form"></div>' +
            '<div class="success-notice" style="display: none">' +
                '<h3>Thank you!</h3>' +
                '<p>Your request has been submitted. Please check your email and click the verification link to activate the product.</p>' +
            '</div>'
        )
    });
});
