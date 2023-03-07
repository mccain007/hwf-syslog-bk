define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/dropdownmenu',
    'nba/components/common/msgdialog',
    'nba/components/groups/csvimportdialog',
    'nba/components/groups/yamlimportdialog',
], function (_, $, Backbone, DropDownMenu, MsgDialog, CsvImportDialog, YamlImportDialog) {
    if (typeof (String.prototype.trim) === "undefined") {
        String.prototype.trim = function () {
            return String(this).replace(/^\s+|\s+$/g, '');
        };
    }

    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/scope/groups',
        REST_CSV_URL: '/splunkd/__raw/network_behavior_analytics/scope/csv',
        REST_YAML_URL: '/splunkd/__raw/network_behavior_analytics/scope/yaml',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "tableHeight", "onChange"));

            this.selectedEntry = null;
            this.selectedKey = null;
            this.disabled = null;
            this.dropdown = null;
            this.children = {};
        },

        events: {
            'click div.rm-button': 'removeEntry',
            'click button.btn-add-entry': 'addGroup',
            'keyup input[type="text"]': 'addGroupKeyUp',
            'click tr.selectable': 'onChangeGroup',
            'click a.csv-import': 'csvImport',
            'click a.csv-export': 'csvExport',
            'click a.yaml-import': 'yamlImport',
            'click a.yaml-export': 'yamlExport',
        },

        newDropdown: function() {
            return new DropDownMenu({
                dropdownClass: 'asoc-groups-options',
                icon: 'icon-gear',
                position: 'top',
                items: this.dropdownInitItems(),
            });
        },

        dropdownInitItems: function() {
            return [
                {
                    label: 'Export to CSV...',
                    value: 'csv-export'
                },
                {
                    label: 'Import from CSV...',
                    value: 'csv-import'
                },
                {
                    label: 'Export to YAML...',
                    value: 'yaml-export'
                },
                {
                    label: 'Import from YAML...',
                    value: 'yaml-import'
                },
            ];
        },

        dropdownItemClicked: function(data) {
            if (data === 'csv-export') {
                this.csvExport()
            } else if (data === 'csv-import') {
                this.csvImport()
            } else if (data === 'yaml-export') {
                this.yamlExport()
            } else if (data === 'yaml-import') {
                this.yamlImport()
            }
        },

        setDisabled: function(disabled) {
            this.disabled = disabled;

            if (this.disabled) {
                $('.group-entries', this.$el).addClass("disabled");
            } else {
                $('.group-entries', this.$el).removeClass("disabled");
            }

            $('input', this.$el).prop('disabled', this.disabled);
            $('button', this.$el).prop('disabled', this.disabled);
        },

        showDialog: function(title, msg, withCancel, okCaption) {
            if (this.children.msgDialog) {
                this.children.msgDialog.remove();
            }

            this.children.msgDialog = new MsgDialog({
                keyboard: true,
                backdrop: 'static',
                message: msg,
                title: title,
                withCancel: withCancel,
                okCaption: okCaption
            });

            this.children.msgDialog.render().$el.appendTo('body');
            return this.children.msgDialog;
        },

        setEntries: function(entries) {
            var el = $('table', this.$el);

            if (entries.length > 0 && this.selectedEntry === null) {
                this.selectedEntry = entries[0];
            }

            if (entries.length === 0) {
                this.selectedEntry = null;
            }
            if (this.onChange) this.onChange(this.selectedEntry);

            var body = "";
            for (var i = 0; i < entries.length; i++) {
                var entry = entries[i];
                var escaped = typeof entry === 'string' ? entry.replace(/"/g, '&quot;') : entry;
                var selected = entry === this.selectedEntry ? "selected" : "";
                body += this.entryTemplate({ escaped: escaped, entry: entry, selected: selected });
            }
            el.html(body);
        },

        addGroup: function(ev) {
            if (ev) ev.preventDefault();

            var groupName = this.$('input[name="group"]').val().trim();

            if (!groupName) {
                this.showDialog('Error', 'Please enter a valid group name.', false);
                return;
            }

            this.setDisabled(true);
            this.restService.post(this.REST_URL, {group: groupName}, function (err, response) {
                this.setDisabled(false);
                if (err) {
                    if (err.status === 400 && err.data.error) {
                        this.showDialog("Error", err.data.error, false)
                    } else {
                        alert("Server error " + err.status + ": " + JSON.stringify(err.data));
                    }
                    return;
                }
                this.refresh();
                $('input', this.$el).val('');
            }.bind(this));
        },

        addGroupKeyUp: function (ev) {
            if (typeof ev == 'undefined' && window.event) { ev = window.event; }
            if (ev.keyCode != 13) return;

            this.addGroup();
        },

        removeEntry: function (ev) {
            var groupName = $(ev.currentTarget).attr('data-entry');
            var msg = "Do you really want to delete group " + groupName + "?";

            this.showDialog("Please confirm", msg, true, "Delete").on('confirmed', function() {
                this.setDisabled(true);
                this.restService.del(this.REST_URL, {group: groupName}, function (err, response) {
                    this.setDisabled(false);
                    if (err) {
                        alert("Server error " + err.status + ": " + JSON.stringify(err.data));
                        return;
                    }

                    if (response.data.removed) {
                        this.selectedEntry = null;
                        this.refresh();
                    }
                }.bind(this));
            }.bind(this));
        },

        render: function () {
            this.dropdown = this.newDropdown();
            this.dropdown.on("itemClicked", function(itemData) {
                this.dropdownItemClicked(itemData);
            }.bind(this));
            this.dropdown.$el.detach();

            this.$el.html(this.template(this));
            $('div.group-entries', this.$el).css('height', this.tableHeight || 100);
            if (this.selectedEntry === null) this.setDisabled(true);

            $('#asoc-groups-options', this.$el).html(this.dropdown.render().el);
            return this;
        },

        refresh: function () {
            this.setDisabled(true);
            this.restService.get(this.REST_URL, {}, function (err, response) {
                if (err) {
                    alert("Server error " + err.status + ": " + JSON.stringify(err.data));
                    return;
                }

                this.setEntries(response.data.groups);
                this.setDisabled(false);
            }.bind(this));
        },

        changeGroup: function (entry) {
            var currentTr = $('tr[data-entry="' + entry + '"]', this.$el);
            $('tr', this.$el).removeClass('selected');
            currentTr.addClass('selected');
            this.selectedEntry = entry;
            if (this.onChange) {
                this.onChange(entry);
            }
        },

        onChangeGroup: function (ev) {
            var entry = $(ev.currentTarget).attr('data-entry');
            this.changeGroup(entry);
        },

        csvExport: function() {
            return this.groupsExport(this.REST_CSV_URL);
        },

        yamlExport: function() {
            return this.groupsExport(this.REST_YAML_URL);
        },

        groupsExport: function(url) {
            window.location = url;
            return false;
        },

        csvImport: function() {
            this.groupsImport(CsvImportDialog);
        },

        yamlImport: function () {
            this.groupsImport(YamlImportDialog);
        },

        groupsImport: function (Dialog) {
            $('.dropup.open', this.$el).removeClass('open');

            if (this.children.importDialog) {
                this.children.importDialog.remove();
            }

            this.children.importDialog = new Dialog({
                keyboard: true,
                backdrop: 'static',
                restService: this.restService
            });

            this.children.importDialog.on('imported', function () {
                this.refresh();
            }.bind(this));

            this.children.importDialog.render().$el.appendTo('body');
        },

        entryTemplate: _.template(
            '<tr class="selectable <%= selected %>" data-entry="<%= escaped %>">' +
                '<td class="entry"><%= entry %></td>' +
                '<td style="width: 5%; min-width: 25px">' +
                    '<div class="rm-button" data-entry="<%= escaped %>">' +
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
                '<input type="text" name="group" placeholder="New group name" style="width: 50%" />' +
                '<button type="button" class="btn btn-default btn-add-entry">Add</button>' +
                '<div id="asoc-groups-options" class="pull-right options-button"></div>' +
            '</div>'
        ),
    });
});
