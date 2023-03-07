define([
    'underscore',
    'backbone',
    'jquery',
], function(_, Backbone, $) {
    return Backbone.View.extend({
        BODY_SELECTOR: "div.modal-body",
        FOOTER_SELECTOR: "div.modal-footer",

        events: {
            'click .close': 'closeModal',
            'click .cancel': 'closeModal',
            'click .modal-backdrop': 'closeModal',
            'click .btn-ok': 'confirmModal',
        },

        initialize: function(options) {
            this.title = options.title;
            this.wide = options.wide;
            this.noClose = options.noClose;

            this.withFooter = options.withFooter;
            this.withConfirm = options.withConfirm;
            this.confirmText = options.confirmText || "OK";
            this.withCancel = options.withCancel;
            this.cancelText = options.cancelText || "Cancel";

            this.on('hidden', function () {
                this.closeModal();
            });
        },

        showModal: function() {
            $(document.body).append(this.el);
            if (!this.noClose) {
                this.$('.modal').on('keydown', this.keyhandleModal.bind(this));
            }

            this.$('.modal').show();
            this.$('.modal').focus();
        },

        keyhandleModal: function(event) {
            var code = event.keyCode || event.which;
            if (code === 27) {
                this.closeModal();
            }
        },

        confirmModal: function(event) {
            event.preventDefault();
            this.trigger('confirmed', true);
            this.closeModal();
        },

        closeModal: function() {
            if (this.noClose) {
                return;
            }

            this.unbind();
            this.remove();
        },

        renderSuccessButton: function(text) {
            if (!text) {
                text = "Done";
            }

            this.$(this.FOOTER_SELECTOR).html(
                '<a href="#" class="btn cancel btn-primary pull-left" data-dismiss="modal">' +
                    text +
                '</a>'
            )
        },

        renderSuccessFooter: function(text) {
            this.$('.modal').append('<div class="modal-footer"></div>');
            this.renderSuccessButton(text);
        },

        renderModal: function(body) {
            this.$el.html(this._modalTemplate({
                title: this.title,
                wideClass: this.wide ? "modal-wide" : "",
                noClose: this.noClose,
                withFooter: this.withFooter,
                withConfirm: this.withConfirm,
                confirmText: this.confirmText,
                withCancel: this.withCancel,
                cancelText: this.cancelText,
            }));

            if (body) {
                this.$(this.BODY_SELECTOR).html(body);
            }

            this.delegateEvents();
            return this;
        },

        _modalTemplate: _.template(
            '<div class="modal <%= wideClass %>" tabindex="0">' +
                '<div class="modal-header">' +
                    '<h3><%= title %></h3>' +
                    '<% if (!noClose) { %> ' +
                        '<button class="close">Close</button>' +
                    '<% } %>' +
                '</div>' +
                '<div class="modal-body modal-body-scrolling"></div>' +
                '<% if (withFooter) { %> ' +
                    '<div class="modal-footer">' +
                        '<% if (withConfirm) { %> ' +
                            '<button class="btn btn-primary btn-ok pull-left"><%= confirmText %></button>' +
                        '<% } %>' +
                        '<% if (withCancel) { %> ' +
                            '<button class="btn btn-default cancel pull-left"><%= cancelText %></button>' +
                        '<% } %>' +
                    '</div>' +
                '<% } %>' +
            '</div>' +
            '<div class="modal-backdrop"></div>'
        ),
    });
});
