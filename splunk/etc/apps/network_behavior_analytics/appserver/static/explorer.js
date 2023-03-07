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
    'nba/components/tables/riskcellrenderer',
], function (mvc, ignored, _, $, PostInstallDialog, ApiMessages, RiskCellRenderer) {
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

    var riskTables = ['rawalerts', 'suspiciousdestinations', 'highrisksourcestable'];
    for (var i = 0; i < riskTables.length; i++) {
        var tableId = riskTables[i];
        mvc.Components.get(tableId).getVisualization(function (tableView) {
            tableView.addCellRenderer(new RiskCellRenderer());
            tableView.render();
        });
    }
});
