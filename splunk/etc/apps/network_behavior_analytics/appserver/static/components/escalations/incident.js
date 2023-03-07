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

            var policyCheckboxConf = {
                el: this.$('#checkbox-policy-enabled'),
                setting: 'enableSched',
                label: 'Escalate Policy Violations',
                configUrl: this.CONFIG_URL + 'AlphaSOC%20NBA%20-%20New%20violations/',
                restService: this.restService,
                onError: this.onError,
                onChange: this.checkboxEnabledChanged.bind(this, 'policy'),
                onRefreshed: this.checkboxEnabledChanged.bind(this, 'policy')
            }

            var threatsCheckboxConf = _.extend({}, policyCheckboxConf, {
                el: this.$('#checkbox-threats-enabled'),
                label: 'Escalate Threat Hunter events',
                configUrl: this.CONFIG_URL + 'AlphaSOC%20NBA%20-%20New%20threats/',
                onChange: this.checkboxEnabledChanged.bind(this, 'threats'),
                onRefreshed: this.checkboxEnabledChanged.bind(this, 'threats')
            });

            this.policyCheckbox = new ConfigCheckbox(policyCheckboxConf).render();
            this.threatsCheckbox = new ConfigCheckbox(threatsCheckboxConf).render();

            this.policySettings = new Settings({
                el: this.$('#escalation-settings-policy'),
                restService: this.restService,
                showUrgency: false,
                onError: this.onError,
                alertType: "policy",
            }).render();

            this.threatsSettings = new Settings({
                el: this.$('#escalation-settings-threats'),
                restService: this.restService,
                showUrgency: true,
                onError: this.onError,
                alertType: "threats",
            }).render();

            return this;
        },

        refresh: function() {
            this.policyCheckbox.refresh();
            this.threatsCheckbox.refresh();

            this.policySettings.refresh();
            this.threatsSettings.refresh();

            return this;
        },

        template: _.template(
            '<div class="escalation-desc">' +
                'Use the checkboxes below to escalate alerts via email and installed add-ons (e.g. ServiceNow). ' +
                '<a data-toggle="collapse" href="#incident-escalation-docs" aria-expanded="false" aria-controls="incident-escalation-docs">' +
                    'Learn&nbsp;more&nbsp;<span class="caret"></span>' +
                '</a>' +
            '</div>' +
            '<div class="collapse" id="incident-escalation-docs">' +
                '<p>' +
                    'Network Behavior Analytics leverages Splunk alert actions system to monitor for ' +
                    'new threats and react accordingly. Install and configure ' +
                    '<a href="/manager/network_behavior_analytics/appsremote?offset=0&count=20&order=latest&content=alert_actions">' +
                        'a custom alert action of your choice' +
                    '</a> and schedule the application to notify you on new threats.' +
                '</p>' +
                '<p>' +
                    'The underlying search exposes the following variables you can use when configuring alert actions: ' +
                    '<code>$result.time$</code>, ' +
                    '<code>$result.source$</code>, ' +
                    '<code>$result.group$</code>, ' +
                    '<code>$result.severity$</code>, ' +
                    '<code>$result.top_threat$</code>, ' +
                    '<code>$result.total_threats$</code>.' +
                '</p>' +
            '</div>' +
            '<div class="escalation-box">' +
                '<div id="checkbox-threats-enabled"></div>' +
                '<div id="escalation-settings-threats" style="display: none"></div>' +
                '<div id="checkbox-policy-enabled"></div>' +
                '<div id="escalation-settings-policy" style="display: none"></div>' +
            '</div>'
        ),
    });
});
