define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/settings/proxy',

        initialize: function (options) {
            _.extend(this, _.pick(options, "restService"));
        },

        events: {
            'click button': 'saveClicked',
            'click input[name="credentials"]': 'checkboxClicked',
        },

        checkboxClicked: function(event) {
            var input = $(event.currentTarget);
            this.onChangeCredentials(input.prop('checked'));
        },

        disable: function(disable) {
            if (disable) {
                this.$('input').attr('disabled', true);
                this.$('button').attr('disabled', true);
                this.$('div.errors').text('');
            } else {
                this.$('input').removeAttr('disabled');
                this.$('button').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.$('div.errors').text(message);
        },

        onChangeCredentials: function(checked) {
            this.toogleCredentialsForm(checked);
        },

        toogleCredentialsForm: function(credentials) {
            if (credentials === true) {
                $("#proxy-password-form").show();
            } else {
                $("#proxy-password-form").hide();
            }
        },

        saveClicked: function () {
            this.disable(true);

            var payload = this.getPayload();
            this.restService.post(this.REST_URL, payload, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                }
                this.disable(false);
            }.bind(this));
        },

        getPayload: function() {
            var credentials = this.$('input[name="credentials"]').prop('checked') ? "1" : "0";
            var address = this.$('input[name="address"]').val();
            var username = this.$('input[name="username"]').val();
            var password = this.$('input[name="password"]').val();

            return { address: address, credentials: credentials, username: username, password: password };
        },

        refresh: function() {
            this.disable(true);

            this.restService.get(this.REST_URL, {}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.loadData(response.data);
                }
                this.disable(false);
            }.bind(this));

            return this;
        },

        loadData: function(data) {
            this.$('input[name="address"]').val(data.address);
            this.$('input[name="username"]').val(data.username);
            this.$('input[name="password"]').val(data.password);

            var credentials = this.convert2Boolean(data.credentials);
            this.$('input[name="credentials"]').prop('checked', credentials);

            this.onChangeCredentials(credentials);
        },

        convert2Boolean: function(value) {
            if (value) {
                value = value.toLowerCase();
            }
            
            return value === "1" || value === "t" || value === "true";
        },

        render: function () {
            this.$el.html(this.template(this));
            return this;
        },

        template: _.template(
            '<div class="settings-proxy-box">' +
                '<p>' +
                    'If you use an HTTP proxy, please configure it below. For further details, please ' +
                    '<a target="_blank" href="https://docs.splunk.com/Documentation/Splunk/latest/Admin/ConfigureSplunkforproxy">' +
                        'consult the documentation <i class="icon-external"></i>' +
                    '</a>' +
                '</p>' +
                '<input name="address" type="text" placeholder="Proxy address, e.g. http://10.1.1.5:8080/" disabled="disabled" />' +
                '<div class="proxy-credentials-checkbox">' +
                    '<input name="credentials" type="checkbox" disabled="disabled" /> ' +
                    '<span>Proxy server requires credentials</span>' +
                '</div>' +
                '<div id="proxy-password-form">' +
                    '<input name="username" type="text" placeholder="Username" disabled="disabled" class="proxy-form-username" />' +
                    '<input name="password" type="password" placeholder="Password" disabled="disabled" />' +
                '</div>' +
                '<div class="proxy-form-save">' +
                    '<button type="button" class="btn btn-default proxy-save">Save proxy</button>' +
                    '<div class="errors config-error"></div>' +                
                '</div>' +
            '</div>'
        )
    });
});
