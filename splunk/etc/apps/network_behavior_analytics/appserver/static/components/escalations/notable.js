define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/settings/configcheckbox',
    'nba/components/escalations/settings',
], function (_, $, Backbone, ConfigCheckbox, Settings) {
    return Backbone.View.extend({
        CONFIG_URL: '/servicesNS/nobody/network_behavior_analytics/properties/savedsearches/',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "onError"));
        },

        checkboxEnabledChanged: function(section, enabled) {
            if (enabled) {
                this.$('#escalation-settings-' + section).show(100);
            } else {
                this.$('#escalation-settings-' + section).hide(100);
            }
        },

        render: function() {
            this.$el.html(this.template(this));

            var threatsCheckboxConf = {
                el: this.$('#checkbox-threats-notable-enabled'),
                setting: 'enableSched',
                label: 'Show Threat Hunter events in Splunk ES',
                configUrl: this.CONFIG_URL + 'Threat%20-%20AlphaSOC%20NBA%20-%20Threat%20Hunter%20-%20Rule/',
                restService: this.restService,
                onError: this.onError,
                onChange: this.checkboxEnabledChanged.bind(this, 'threats-notable'),
                onRefreshed: this.checkboxEnabledChanged.bind(this, 'threats-notable')
            }

            var policyCheckboxConf = _.extend({}, threatsCheckboxConf, {
                el: this.$('#checkbox-policy-notable-enabled'),
                label: 'Show Policy Violations in Splunk ES',
                configUrl: this.CONFIG_URL + 'Threat%20-%20AlphaSOC%20NBA%20-%20Policy%20Violations%20-%20Rule/',
                onChange: this.checkboxEnabledChanged.bind(this, 'policy-notable'),
                onRefreshed: this.checkboxEnabledChanged.bind(this, 'policy-notable')
            });

            this.threatsCheckbox = new ConfigCheckbox(threatsCheckboxConf).render();
            this.policyCheckbox = new ConfigCheckbox(policyCheckboxConf).render();

            this.threatsSettings = new Settings({
                el: this.$('#escalation-settings-threats-notable'),
                restService: this.restService,
                showUrgency: true,
                onError: this.onError,
                alertType: "threats_notable",
            }).render();

            this.policySettings = new Settings({
                el: this.$('#escalation-settings-policy-notable'),
                restService: this.restService,
                showUrgency: false,
                onError: this.onError,
                alertType: "policy_notable",
            }).render();

            return this;
        },

        refresh: function() {
            this.threatsCheckbox.refresh();
            this.policyCheckbox.refresh();

            this.threatsSettings.refresh();
            this.policySettings.refresh();

            return this;
        },

        template: _.template(
            '<div class="escalation-desc">' +
                'Use the checkboxes below to show alerts within Splunk ES Notable Events. ' +
                '<a data-toggle="collapse" href="#incident-escalation-notable-docs" aria-expanded="false" aria-controls="incident-escalation-notable-docs">' +
                    'Learn&nbsp;more&nbsp;<span class="caret"></span>' +
                '</a>' +
            '</div>' +
            '<div class="collapse" id="incident-escalation-notable-docs">' +
                '<p>' +
                    'Network Behavior Analytics defines two correlation searches which are responsible ' +
                    'for generating notable events. Splunk ES will automatically pick them up. ' +
                    'If you want to modify these searches, please go to the Splunk searches, reports ' +
                    'and alerts settings. Then use advanced edit to adjust notable events.' +
                '</p>' +
                '<p>' +
                    'The underlying search exposes the following variables to notable events: ' +
                    '<code>$app$</code>, ' +
                    '<code>$modtime$</code>, ' +
                    '<code>$src$</code>, ' +
                    '<code>$src_ip$</code>, ' +
                    '<code>$src_user_group$</code>, ' +
                    '<code>$severity$</code>, ' +
                    '<code>$severity_id$</code>, ' +
                    '<code>$subject$</code>, ' +
                    '<code>$size$</code>, ' +
                    '<code>$desc$</code>, ' +
                    '<code>$category$</code>, ' +
                    '<code>$priority$</code>.' +
                '</p>' +
            '</div>' +
            '<div class="escalation-box">' +
                '<div id="checkbox-threats-notable-enabled"></div>' +
                '<div id="escalation-settings-threats-notable" style="display: none"></div>' +
                '<div id="checkbox-policy-notable-enabled"></div>' +
                '<div id="escalation-settings-policy-notable" style="display: none"></div>' +
            '</div>'
        ),
    });
});
