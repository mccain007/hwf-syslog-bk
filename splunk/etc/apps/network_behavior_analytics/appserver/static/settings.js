var apiMessages, masterNodeWarning;

require.config({
    paths: {
        "nba": "../app/network_behavior_analytics"
    }
});

require([
    'splunkjs/ready!',
    'splunkjs/mvc/simplexml/ready!',
    'underscore',
    'jquery',
    'nba/components/common/msgdialog',
    'nba/components/api/messages',
    'nba/components/api/onpremiseradio',
    'nba/components/api/urlinput',
    'nba/components/api/keyinput',
    'nba/components/settings/configcheckbox',
    'nba/components/settings/configproxy',
    'nba/components/settings/policycheckboxes',
    'nba/components/settings/sourcedisplay',
    'nba/components/escalations/incident',
    'nba/components/escalations/notable',
], function (mvc, ignored, _, $, MsgDialog, ApiMessages, ApiOnPremiseRadio, ApiUrlInput,
    ApiKeyInput, ConfigCheckbox, ConfigProxy, PolicyCheckboxes, SourceDisplay,
    IncidentEscalation, NotableEscalation) {

    var restService = mvc.createService();

    $('div.dashboard-header').after('<div class="api-messages"></div>');
    apiMessages = new ApiMessages({
        el: $('div.api-messages'),
        restService: restService
    }).refresh();

    new ApiOnPremiseRadio({
        el: $('#api-on-premise'),
        restService: restService,
    }).render().refresh();

    new ApiUrlInput({
        el: $('#api-url-input'),
        restService: restService,
    }).render().refresh();

    new ApiKeyInput({
        el: $('#api-key-input'),
        restService: restService,
    }).render().refresh();

    new ConfigCheckbox({
        el: $('#master-node-checkbox'),
        setting: "master_node",
        label: "This search head is a master node",
        description: "If you are running this application on multiple search heads, elect this search head " +
            "as the master node using the checkbox, and uncheck on the others. If you only run the application " +
            "on a single search head, leave this box checked.",
        restService: restService,
        renderDesc: false,
        onChange: function (checked) {
            if (!checked) {
                if (masterNodeWarning) {
                    masterNodeWarning.remove();
                    masterNodeWarning = null;
                }
                masterNodeWarning = new MsgDialog({
                    keyboard: true,
                    backdrop: 'static',
                    message: 'Please make sure that you have exactly one Network Behavior ' +
                        'Analytics master node in your distributed Splunk environment. ' +
                        'If you only run the application on a single search head, ' +
                        'leave this box checked.',
                    title: 'Warning'
                }).render().$el.appendTo('body');
            }
        },
        onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); },
    }).render().refresh();

    new ConfigCheckbox({
        el: $('#ssl-verify-cloud-checkbox'),
        setting: "ssl_verify_cloud",
        label: "X.509 certificate verification",
        description: "This option enforces TLS certificate pinning for <b>api.alphasoc.net</b>, preventing " +
            "man-in-the-middle and interception of API traffic.",
        restService: restService,
        renderDesc: false,
        onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); },
    }).render().refresh();

    new ConfigCheckbox({
        el: $('#ssl-verify-on-premise-checkbox'),
        setting: "ssl_verify_on_premise",
        label: "X.509 certificate verification",
        description: "This option enforces TLS certificate pinning for <b><span class='on-premise-desc-url'></span></b>, preventing " +
            "man-in-the-middle and interception of API traffic.",
        restService: restService,
        renderDesc: true,
        onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); }
    }).render().refresh();

    new ConfigProxy({
        el: $('#config-proxy'),
        restService: restService
    }).render().refresh();

    new SourceDisplay({
        el: $('#alert-source-display'),
        restService: restService
    }).render().refresh();

    new PolicyCheckboxes({
        el: $('#policy-checkboxes'),
        restService: restService,
    });

    new IncidentEscalation({
        el: $('#incident-escalation'),
        restService: restService,
        onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); }
    }).render().refresh();

    new NotableEscalation({
        el: $('#notable-escalation'),
        restService: restService,
        onError: function (err) { apiMessages.addMessage(apiMessages.LEVELS.ERROR, err); }
    }).render().refresh();
});
