var apiMessages;

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
    'nba/components/common/postinstalldialog',
    'nba/components/api/messages',
], function (mvc, ignored, _, $, PostInstallDialog, ApiMessages) {
    var restService = mvc.createService();

    $('div.dashboard-header').after('<div class="api-messages"></div>');
    apiMessages = new ApiMessages({
        el: $('div.api-messages'),
        restService: restService
    }).refresh();

    new PostInstallDialog({
        restService: restService,
        keyboard: false,
        backdrop: false,
    }).run();
});
