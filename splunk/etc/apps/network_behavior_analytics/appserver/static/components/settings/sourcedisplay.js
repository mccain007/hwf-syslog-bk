define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/settings/source/display',

        initialize: function (options) {
            _.extend(this, _.pick(options, "restService"));

            this.choices = [
                {
                    id: "source-display-hostname",
                    value: "hostname",
                    label: "Display source hostname if available",
                },
                {
                    id: "source-display-ip",
                    value: "ip",
                    label: "Always use source IP when rendering alerts",
                },
            ];
        },

        events: {
            'change input[type=radio]': 'radioChanged'
        },

        disable: function(disable) {
            if (disable) {
                this.$('input').attr('disabled', true);
                this.$('div.errors').text('');
            } else {
                this.$('input').removeAttr('disabled');
            }
        },

        handleRestError: function(err) {
            var message = "";
            if (err && err.status == 404) {
                message = "Unrecognized source display type. Please choose an option from the list below.";
            } else {
                message = handleRestError(err);
            }
            this.$('div.errors').text(message);
        },

        radioChanged: function (ev) {
            this.disable(true);

            var selectedType = $(ev.currentTarget).val();
            this.restService.post(this.REST_URL, {type: selectedType}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                }
                this.disable(false);
            }.bind(this));
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
            $("input[name=source-display-choice]").prop('checked', false);
            $("input[name=source-display-choice][value=" + data.type + "]").prop('checked', true);
        },

        render: function () {
            this.$el.html(this.template(this));
            this.renderChoices();
            return this;
        },

        renderChoices: function() {
            var fieldsetBody = ""
            for (var i = 0; i < this.choices.length; i++) {
                fieldsetBody += this.templateChoice(this.choices[i]);
            }
            this.$('#source-display-group fieldset').html(fieldsetBody);
        },

        templateChoice: _.template(
            '<div class="choice">' +
                '<input name="source-display-choice" value="<%= value %>" id="<%= id %>" type="radio">' +
                '<label for="<%= id %>"><%= label %></label>' +
            '</div>'
        ),

        template: _.template(
            '<div class="errors config-error"></div>' +
            '<div id="source-display-group">' +
                '<fieldset></fieldset>' +
            '</div>'
        )
    });
});
