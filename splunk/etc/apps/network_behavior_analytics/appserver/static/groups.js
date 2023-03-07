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
    'nba/components/groups/grouplist',
    'nba/components/groups/tabcontent',
    'nba/components/common/tabs',
], function (mvc, ignored, _, $, PostInstallDialog, ApiMessages, GroupList,
    TabContent, Tabs) {

    var restService = mvc.createService();

    $('div.dashboard-header').after('<div class="api-messages"></div>');
    apiMessages = new ApiMessages({
        el: $('div.api-messages'),
        restService: restService,
    }).refresh();

    new PostInstallDialog({
        restService: restService,
        keyboard: false,
        backdrop: false,
    }).run();

    var tabsScope = new Tabs({
        el: $('#groups-tabs-scope'),
        restService: restService,
        tabs: [
            new TabContent({
                restService: restService,
                id: "inclusions",
                title: "IP ranges",
            }),
            new TabContent({
                restService: restService,
                id: "exclusions",
                title: "Exclusions",
            }),
        ],
    }).render();

    var tabsTrusted = new Tabs({
        el: $('#groups-tabs-trusted'),
        restService: restService,
        tabs: [
            new TabContent({
                restService: restService,
                id: "trusted_domains",
                title: "Domains",
                anomalyEnabled: true,
            }),
            new TabContent({
                restService: restService,
                id: "trusted_ips",
                title: "IP ranges",
                anomalyEnabled: true,
            }),
        ],
    }).render();

    new GroupList({
        el: $('div.groups-panel[data-entries-type="groups-list"]'),
        restService: restService,
        tableHeight: 425,
        onChange: function (groupName) {
            tabsScope.refreshGroup(groupName);
            tabsTrusted.refreshGroup(groupName);
        },
    }).render().refresh();
});
