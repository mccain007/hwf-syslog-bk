define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/api/keyreset'
], function (_, Modal, KeyReset) {
    return Modal.extend({
        initialize: function (options) {
            _.extend(options, {
                title: "API key reset",
                withFooter: true,
                withCancel: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.restService = options.restService;
        },

        onSuccess: function () {
            this.renderSuccessButton();
        },

        render: function () {
            this.renderModal(this.template);

            new KeyReset({
                el: this.$('div.main-body'),
                restService: this.restService,
                onSuccess: this.onSuccess.bind(this)
            }).render();

            this.showModal();
            return this;
        },

        template: '<div class="main-body key-reset-single-modal"></div>'
    });
});
