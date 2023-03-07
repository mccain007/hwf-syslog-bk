define([
    'jquery',
    'underscore',
    'nba/components/common/modal',
    'splunkjs/mvc/sharedmodels',
], function($, _, Modal, SharedModels) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "Import from CSV",
                wide: true,
                withFooter: true,
                withConfirm: true,
                confirmText: "Import CSV",
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
                url: '/' + splunkLocale + '/splunkd/__raw/network_behavior_analytics/scope/csv',
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
                        if (response.errors) {
                            status += "<ul>";
                            var errors = response.errors;
                            for (var error in errors) {
                                status += "<li>" + error + ": line";
                                status += errors[error].length > 1 ? "s " : " ";
                                status += errors[error].join(", ");
                                status += "</li>";
                            }
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
                '<p>This function imports data from CSV files in the following format:</p>' +
                '<pre>' +
                    '"Group name","Entry type","Entry","Description"\n' +
                    '"","an empty entry will be treated as a comment and will be omitted"\n' +
                    '"Endpoints","ips_in_scope","127.0.0.1","localhost"\n' +
                    '...' +
                '</pre>' +
                '<p>' +
                    'The file must be UTF-8 encoded. Allowed entry types: <code>ips_in_scope</code>, <code>excluded_ips</code>, ' +
                    '<code>whitelisted_domains</code>, <code>whitelisted_ips</code>, <code>anomaly_domains</code>, <code>anomaly_ips</code>.' +
                '</p>' +
                '<form>' +
                    '<input type="file" name="csv-import-file" accept="text/csv" />' +
                '</form>' +
            '</div>' +
            '<div class="status"></div>'
    });
});
