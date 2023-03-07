define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/data/status',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "section", "title",
                "dataName", "successMsg", "renderDesc"));

            if (this.renderDesc == undefined) {
                this.renderDesc = false;
            }
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.$('div.errors').text(message);
        },

        createSuccessMsg: function() {
            var msg = "Module is working correctly.";
            if (this.successMsg != undefined) {
                msg = this.successMsg
            }
            return {level: 4, message: msg}
        },

        refresh: function() {
            this.$('div.errors').text("");
            this.restService.get(this.REST_URL, {mode: "full", section: this.section}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.renderMessages(response.data.messages);
                }
            }.bind(this));

            return this;
        },

        renderMessages: function(messages) {
            if (messages == undefined) {
                this.handleRestError({data: "Could not fetch status messages from the REST endpoint."});
                return;
            } else if (messages.length == 0) {
                messages.push(this.createSuccessMsg())
            }

            var content = "";
            for (var i = 0; i < messages.length; i++) {
                content += this.renderMessage(messages[i]);
            }

            var el = $('.data-status-messages', this.$el);
            el.html(content);
        },

        renderMessage: function(msg) {
            var msgClass, iconClass;

            if (msg.level == 0) {
                console.log(msg.message);
                return;
            } else if (msg.level == 1) {
                msgClass = 'warningbox-info';
                iconClass = "icon-info-circle";
            } else if (msg.level == 2) {
                msgClass = 'warningbox-warning';
                iconClass = "icon-warning";
            } else if (msg.level == 4) {
                msgClass = 'warningbox-success';
                iconClass = "icon-check";
            } else {
                msgClass = 'warningbox-error';
                iconClass = "icon-error";
            }

            return this.templateMessage({msgClass: msgClass, iconClass: iconClass, msgText: msg.message})
        },

        render: function () {
            this.$el.html(this.template(this));
            return this;
        },

        templateMessage: _.template(
            '<div class="data-status-box <%= msgClass %>">' +
                '<span class="data-icon <%= iconClass %>"></span>' +
                '<p><%= msgText %></p>' +
            '</div>'
        ),

        template: _.template(
            '<% if (renderDesc) { %> ' +
                '<h2 class="panel-title"><%= title %> data health</h2>' +
                '<p>The application searches for CIM compliant <%= dataName %> events to score. The status bar ' +
                'below reports whether data is being processed correctly. If you make changes to your ' +
                'configuration, this may take a few minutes to update.</p>' +
            '<% } %>' +
            '<div class="data-status">' +
                '<div class="errors config-error"></div>' +
                '<div class="data-status-messages"></div>' +
            '</div>'
        ),
    });
});
