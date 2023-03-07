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

    $('div.dashboard-header p.description').append(
        '<br/>Please check <a href="https://www.alphasoc.com/docs/nba-licensing" target="_blank"> ' +
        'AlphaSOC licensing plans <i class="icon-external"></i></a> for example pricing and contact ' +
        '<a href="mailto:sales@alphasoc.com"><b>sales@alphasoc.com</b></a> to discuss your requirements.'
    );

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
