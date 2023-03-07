define([
    'jquery',
    'underscore',
    'nba/components/common/modal',
    'splunkjs/mvc/sharedmodels',
], function($, _, Modal, SharedModels) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "Import from YAML file",
                wide: true,
                withFooter: true,
                withConfirm: true,
                confirmText: "Import YAML",
                withCancel: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.restService = options.restService;
        },

        events: $.extend({}, Modal.prototype.events, {
            'click .btn-ok': 'submit',
            'change input': function() {
                if (this.$('input[type="file"]').val()) {
                    this.$('.btn-ok').removeAttr('disabled');
                } else {
                    this.$('.btn-ok').attr('disabled', 'disabled');
                }
            }
        }),

        submit: function() {
            var formData = new FormData(this.$('form')[0]);
            var splunkLocale = SharedModels.get('app').get('locale');
            var statusDiv = this.$('div.status');

            this.$('.btn-ok').attr('disabled', 'disabled');
            statusDiv.removeClass('text-error');
            statusDiv.html("Processing...");
            $.ajax({
                url: '/' + splunkLocale + '/splunkd/__raw/network_behavior_analytics/scope/yaml',
                type: 'POST',
                success: function(data) {
                    this.trigger('imported', true);
                    this.closeModal();
                }.bind(this),
                error: function(data) {
                    console.log('error', data);
                    statusDiv.addClass('text-error');
                    if (data.responseJSON) {
                        var response = data.responseJSON;
                        var status = "";
                        if (response.error) {
                            status += "<p>" + response.error + "</p>";
                        }
                        statusDiv.html(status);
                    } else if (data && data.status && data.statusText) {
                        var status = "<p>Import error</p><ul>" +
                            "<li>Status code: " + data.status + "</li>" +
                            "<li>Message: " + data.statusText + "</li>" +
                        "</ul>";
                        statusDiv.html(status);
                    } else {
                        statusDiv.html("Import error");
                    }
                    this.$('.btn-ok').removeAttr('disabled');
                }.bind(this),
                data: formData,
                //Options to tell jQuery not to process data or worry about content-type.
                cache: false,
                contentType: false,
                processData: false
            });
        },

        render: function() {
            this.renderModal(this.template);
            this.$('.btn-ok').attr('disabled', 'disabled');

            this.showModal();
            return this;
        },

        template: '' +
            '<div class="description">' +
                '<p>This function imports data from YAML files in the following format:</p>' +
                '<pre>' +
                    'groups:\n' +
                    '\tnew_york:\n' +
                    '\t\tlabel: "New York"\n' +
                    '\t\tin_scope:\n' +
                    '\t\t- 10.0.0.0/8\n' +
                    '\t\tout_scope:\n' +
                    '\t\t- 10.0.0.1\n' +
                    '\t\ttrusted_domains:\n' +
                    '\t\t- "*.lan"\n' +
                    '\t\ttrusted_ips:\n' +
                    '\t\t- 172.16.0.0/12\n' +
                    '\t\t- fc00::/7\n' +
                    '\tboston:\n' +
                    '\t\t...' +
                '</pre>' +
                '<p>' +
                    'The file must be UTF-8 encoded. Allowed entry types: <code>in_scope</code>, <code>out_scope</code>, ' +
                    '<code>trusted_domains</code>, <code>trusted_ips</code>.' +
                '</p>' +
                '<form>' +
                    '<input type="file" name="yaml-import-file" accept="text/x-yaml" />' +
                '</form>' +
            '</div>' +
            '<div class="status"></div>'
    });
});
