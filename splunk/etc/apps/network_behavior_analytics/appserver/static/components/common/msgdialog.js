define([
    'underscore',
    'nba/components/common/modal',
], function(_, Modal) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: options.title,
                withFooter: true,
                withConfirm: true,
                confirmText: options.okCaption,
                withCancel: options.withCancel,
            });

            Modal.prototype.initialize.call(this, options);
            this.message = options.message;
        },

        render: function() {
            this.renderModal(this.template({
                message: this.message,
            }));

            this.showModal();
            return this;
        },

        template: _.template('<%= message %>'),
    });
});
