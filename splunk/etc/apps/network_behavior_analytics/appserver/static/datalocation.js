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
    'nba/components/data/tabcontent',
    'nba/components/data/alerts',
    'nba/components/data/logsexport',
    'nba/components/detection/dns',
    'nba/components/detection/ip',
    'nba/components/detection/http',
    'nba/components/detection/dhcp',
    'nba/components/detection/tls',
    'nba/components/detection/vpn',
    'nba/components/common/tabs',
    'nba/components/data/destsummary',
], function (mvc, ignored, _, $, PostInstallDialog, ApiMessages, TabContent, DataAlerts,
    LogsExport, DnsDetection, IpDetection, HttpDetection, DhcpDetection,
    TlsDetection, VpnDetection, Tabs, DestSummary) {

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

    new Tabs({
        el: $('#data-tabs'),
        restService: restService,
        dataLocation: true,
        tabs: [
            new TabContent({
                el: $('#data-logs-dns'),
                restService: restService,
                id: "dns",
                title: "DNS",
                dataName: "DNS resolution",
                queryMacro: 'nbalogsindexdns',
                queryTags: 'tag="dns" tag="network" tag="resolution"',
                enabledLabel: "Score DNS event data via the Analytics Engine",
                successMsg: "The application is collecting DNS resolution events.",
                detection: new DnsDetection({
                    restService: restService,
                    section: "dns",
                }),
            }),
            new TabContent({
                el: $('#data-logs-ip'),
                restService: restService,
                id: "ip",
                title: "IP",
                dataName: "network traffic",
                queryMacro: 'nbalogsindexip',
                queryTags: 'tag="network" tag="communicate"',
                enabledLabel: "Score IP session data via the Analytics Engine",
                successMsg: "The application is collecting IP session events.",
                detection: new IpDetection({
                    restService: restService,
                    section: "ip",
                }),
            }),
            new TabContent({
                el: $('#data-logs-http'),
                restService: restService,
                id: "http",
                title: "HTTP",
                dataName: "web traffic",
                queryMacro: 'nbalogsindexhttp',
                queryTags: 'tag="web"',
                enabledLabel: "Score HTTP event data via the Analytics Engine",
                successMsg: "The application is collecting HTTP traffic events.",
                detection: new HttpDetection({
                    restService: restService,
                    section: "http",
                }),
            }),
            new TabContent({
                el: $('#data-logs-tls'),
                restService: restService,
                id: "tls",
                title: "TLS",
                dataName: "TLS",
                queryMacro: 'nbalogsindextls',
                queryTags: 'tag="certificate"',
                enabledLabel: "Score TLS event data via the Analytics Engine",
                successMsg: "The application is collecting TLS events.",
                detection: new TlsDetection({
                    restService: restService,
                    section: "tls",
                }),
            }),
            new TabContent({
                el: $('#data-logs-dhcp'),
                restService: restService,
                id: "dhcp",
                title: "DHCP",
                dataName: "DHCP",
                queryMacro: 'nbalogsindexdhcp',
                queryTags: 'tag="network" tag="session" tag="dhcp"',
                enabledLabel: "Correlate DHCP event data via the Analytics Engine",
                successMsg: "The application is collecting DHCP events.",
                detection: new DhcpDetection({
                    restService: restService,
                    section: "dhcp",
                }),
            }),
            new TabContent({
                el: $('#data-logs-vpn'),
                restService: restService,
                id: "vpn",
                title: "VPN",
                dataName: "VPN",
                queryMacro: 'nbalogsindexvpn',
                queryTags: 'tag="network" tag="session" tag="vpn"',
                enabledLabel: "Correlate VPN event data via the Analytics Engine",
                successMsg: "The application is collecting VPN events.",
                detection: new VpnDetection({
                    restService: restService,
                    section: "vpn",
                }),
            }),
        ],
    }).render();

    new DataAlerts({
        el: $('#data-alerts'),
        restService: restService,
    }).render().refresh();

    new DestSummary({
        el: $('#data-destinations'),
        restService: restService,
    }).render().refresh();

    new LogsExport({
        el: $('#data-logs-export'),
    }).render();
});
