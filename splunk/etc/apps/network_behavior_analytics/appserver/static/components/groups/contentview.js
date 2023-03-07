define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/msgdialog',
], function (_, $, Backbone, MsgDialog) {
    if (typeof (String.prototype.trim) === "undefined") {
        String.prototype.trim = function () {
            return String(this).replace(/^\s+|\s+$/g, '');
        };
    }

    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/scope/groups/entries',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "entryType", "tableHeight"));
            this.groupName = null;

            this.addPlaceholder = this.entryType === "trusted_domains" ? "Domain name" : "IP address or CIDR range";
            this.dialogName = this.entryType === "trusted_domains" ? "domain name" : "IP address or CIDR range";

            this.disable(true);
            this.children = {};
        },

        events: {
            'click div.rm-button': 'removeEntry',
            'click button.btn-add-entry': 'addEntry',
            'keyup input[type="text"]': 'addEntryKeyUp'
        },

        disable: function(disabled) {
            if (disabled) {
                $('.group-entries', this.$el).addClass("disabled");
            } else {
                $('.group-entries', this.$el).removeClass("disabled");
            }

            $('input', this.$el).prop('disabled', disabled);
            $('button', this.$el).prop('disabled', disabled);
        },

        handleRestError: function(err) {
            if (err.status === 400 && err.data.error) {
                this.showDialog("Error", err.data.error)
            } else {
                alert("Server error " + err.status + ": " + JSON.stringify(err.data));
            }
        },

        showDialog: function(title, msg) {
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

        addEntry: function() {
            var entry = this.$('input[name="entry"]').val().trim();
            var description = this.$('input[name="description"]').val().trim();

            if (!entry) {
                this.showDialog('Error', 'Please enter a valid ' + this.dialogName + ".");
                return false;
            }

            this.disable(true);
            this.restService.post(this.REST_URL, {
                group: this.groupName,
                type: this.entryType,
                entry: entry,
                description: description,
            }, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.refresh();
                    $('input', this.$el).val('');
                }
                this.disable(false);
            }.bind(this));
        },

        removeEntry: function(ev) {
            var entry = $(ev.currentTarget).attr('data-entry');

            this.disable(true);
            this.restService.del(this.REST_URL, {
                group: this.groupName,
                type: this.entryType,
                entry: entry,
            }, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.refresh();
                }
                this.disable(false);
            }.bind(this));
        },

        addEntryKeyUp: function(ev) {
            if (typeof ev == 'undefined' && window.event) { ev = window.event; }
            if (ev.keyCode != 13) return;

            this.addEntry();
        },

        renderEntries: function (entries) {
            var body = "";
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                body += this.entryTemplate({ entry: entry[0], description: entry[1] });
            }

            var el = $('table', this.$el);
            el.html(body);
        },

        refreshGroup: function(groupName) {
            this.groupName = groupName;
        },

        refresh: function() {
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
                } else if (response.data.entries) {
                    this.renderEntries(response.data.entries);
                    this.disable(false);
                }
            }.bind(this));
        },

        render: function () {
            this.$el.html(this.template(this));
            $('div.group-entries', this.$el).css('height', this.tableHeight || 100);
            if (this.groupName === null) this.disable(true);

            return this;
        },

        entryTemplate: _.template(
            '<tr>' +
                '<td class="entry"><%= entry %></td>' +
                '<td class="description"><%= description %></td>' +
                '<td>' +
                    '<div class="rm-button" data-entry="<%= entry %>">' +
                        '<i class="icon-x-circle"></i>' +
                    '</div>' +
                '</td>' +
            '</tr>'
        ),

        template: _.template(
            '<div class="group-entries">' +
                '<table width="100%"></table>' +
            '</div>' +
            '<div class="group-add-entry">' +
                '<label>Add new entry</label>' +
                '<input type="text" name="entry" placeholder="<%= addPlaceholder %>" />' +
                '<input type="text" name="description" placeholder="Description (optional)" />' +
                '<button type="button" class="btn btn-default btn-add-entry">Add</button>' +
            '</div>'
        ),
    });
});
