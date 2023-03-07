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
    'nba/components/tables/threatsrowexpansion',
    'nba/components/tables/riskcellrenderer',
    'nba/components/tables/flagsrenderer',
    'nba/components/tables/alertactions',
], function (mvc, ignored, _, $, PostInstallDialog, ApiMessages, ThreatsRowExpansion,
    RiskCellRenderer, FlagsRenderer, AlertActions) {

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

    mvc.Components.get('alertevents').getVisualization(function (tableView) {
        tableView.addCellRenderer(new RiskCellRenderer());
        tableView.addRowExpansionRenderer(new ThreatsRowExpansion({ policy: 0 }));
        tableView.render();
    });

    mvc.Components.get('individualevents').getVisualization(function (tableView) {
        tableView.addCellRenderer(new FlagsRenderer());
        tableView.addCellRenderer(new AlertActions());
        tableView.render();
    });

    $('body').tooltip({
        selector: 'div.alert-flag-tooltip',
        trigger: 'hover',
    });
});
