define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/msgdialog',
], function (_, $, Backbone, MsgDialog) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/scope/groups/anomaly',

        initialize: function (options) {
            _.extend(this, _.pick(options, "restService", "entryType", "label", "description"));

            this.groupName = null;
            this.children = {};
        },

        events: {
            'click input': 'checkboxClicked'
        },

        disable: function (disabled) {
            $('.anomaly-checkbox', this.$el).prop('disabled', disabled);
        },

        handleRestError: function(err) {
            if (err.status === 400 && err.data.error) {
                this.showDialog("Error", err.data.error)
            } else {
                alert("Server error " + err.status + ": " + JSON.stringify(err.data));
            }
        },

        showDialog: function (title, msg) {
            if (this.children.msgDialog) {
                this.children.msgDialog.remove();
            }

            this.children.msgDialog = new MsgDialog({
                keyboard: true,
                backdrop: 'static',
                message: msg,
                title: title,
            });

            this.children.msgDialog.render().$el.appendTo('body');
            return this.children.msgDialog;
        },

        checkboxClicked: function(ev) {
            var checked = $(ev.currentTarget).prop("checked");

            this.disable(true);
            this.restService.post(this.REST_URL, {
                group: this.groupName,
                type: this.entryType,
                checked: checked,
            }, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                    $(ev.currentTarget).prop("checked", !checked)
                }
                this.disable(false);
            }.bind(this));
        },

        refreshGroup: function(groupName) {
            this.groupName = groupName;
        },

        refresh: function (groupName) {
            if (this.groupName === null) {
                return;
            }

            this.disable(true);
            this.restService.get(this.REST_URL, {
                group: this.groupName,
                type: this.entryType,
            }, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    var checked = response.data.checked;
                    this.$('input').prop('checked', this.isChecked(checked));
                    this.disable(false);
                }
            }.bind(this));
        },

        isChecked: function(checked) {
            return checked === true || checked === "1" || checked === "t" || checked === "true";
        },

        render: function () {
            this.$el.html(this.checkboxTemplate({
                entryType: this.entryType,
                label: this.label,
                description: this.description
            }));
            if (this.groupName === null) this.disable(true);

            return this;
        },

        checkboxTemplate: _.template(
            '<div class="anomaly-detection-checkbox">' +
                '<input class="anomaly-checkbox" type="checkbox" />' +
                '<span class="desc"><%= label %></span>' +
                '<a data-toggle="collapse" href="#anomaly-toggle-<%= entryType %>" aria-expanded="false" aria-controls="anomaly-toggle">' +
                    'Learn more <span class="caret"></span>' +
                '</a>' +
                '<div class="collapse" id="anomaly-toggle-<%= entryType %>">' +
                    '<p><%= description %></p>' +
                '</div>' +
            '</div>'
        ),
    });
});
