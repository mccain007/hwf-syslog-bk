define([
    'underscore',
    'jquery',
    'backbone',
    'splunkjs/mvc/radiogroupview',
    'nba/components/common/handleresterror',
], function (_, $, Backbone, RadiogroupView, handleRestError) {
    return Backbone.View.extend({
        CONFIG_URL: '/servicesNS/nobody/network_behavior_analytics/properties/nba/main/api_on_premise',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService"));

            this.choices = [
                { id: "api-radiogroup-cloud", label: "Cloud", value: "0" },
                { id: "api-radiogroup-on-premise", label: "On-premise", value: "1" },
            ];
        },

        events: {
            'change input[type=radio]': 'radioChanged'
        },

        disable: function(disable) {            
            if (disable) {
                this.$('#api-on-premise-radiogroup input').attr('disabled', disable);
                this.$('div.errors').text('');
            } else {
                this.$('#api-on-premise-radiogroup input').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.$('div.errors').text(message);
        },

        hideOptions: function(on_premise) {
            if (on_premise === true) {
                $("#ssl-verify-cloud-checkbox").hide();
                $("#ssl-verify-on-premise-checkbox").show();
                $("#api-url-input").show();
            } else {
                $("#ssl-verify-cloud-checkbox").show();
                $("#ssl-verify-on-premise-checkbox").hide();
                $("#api-url-input").hide();
            }
        },

        radioChanged: function(ev) {
            var checkbox = $(ev.currentTarget);
            var api_on_premise = checkbox.val();

            if (api_on_premise == "0" || api_on_premise == "1") {
                this.disable(true);
                this.restService.post(this.CONFIG_URL, {value: api_on_premise}, function (err, response) {
                    if (err) {
                        this.handleRestError(err);
                    }

                    this.refresh();
                    this.disable(false);
                }.bind(this));
            }
        },

        refresh: function() {
            this.disable(true);

            this.restService.get(this.CONFIG_URL, {}, function (err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    var radioValue = response.data == "1" ? "1" : "0";

                    $("input[name=api-on-premise-radiogroup]").prop('checked', false);
                    $("input[name=api-on-premise-radiogroup][value=" + radioValue + "]").prop('checked', true);

                    this.hideOptions(radioValue == "1" ? true : false);
                }
                this.disable(false);
            }.bind(this));

            return this;
        },

        render: function() {
            this.$el.html(this.template(this));
            this.renderChoices();
            return this;
        },

        renderChoices: function() {
            var fieldsetBody = ""
            for (var i = 0; i < this.choices.length; i++) {
                fieldsetBody += this.templateChoice(this.choices[i]);
            }
            this.$('#api-on-premise-radiogroup fieldset').html(fieldsetBody);
        },

        templateChoice: _.template(
            '<div class="choice">' +
                '<input name="api-on-premise-radiogroup" value="<%= value %>" id="<%= id %>" type="radio">' +
                '<label for="<%= id %>"><%= label %></label>' +
            '</div>'
        ),

        template: _.template(
            '<div class="api-on-premise-label">Processing mode:</div>' +
            '<div id="api-on-premise-radiogroup">' +
                '<fieldset></fieldset>' +
            '</div>' +
            '<div class="errors config-error"></div>'        
        )
    });
});
