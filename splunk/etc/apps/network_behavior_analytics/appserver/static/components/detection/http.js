define([
    'underscore',
    'nba/components/common/modal',
    'nba/components/detection/detection',
], function(_, Modal, Detection) {
    return Modal.extend({
        initialize: function(options) {
            _.extend(options, {
                title: "HTTP data autodetection",
                wide: true,
            });

            Modal.prototype.initialize.call(this, options);
            this.numberOfEvents = 150;

            this.detection = new Detection({
                restService: options.restService,
                section: options.section,
                query: this.getQuery(),
                formats: this.getFormats(),
            });
        },

        getQuery: function() {
            return 'index=* earliest=-1d latest=+1d | eval tags=if(tag == "web", 1, 0) ' +
                   '| top ' + this.numberOfEvents + ' tags, _indextime, _raw by index, sourcetype ' +
                   '| fields index, sourcetype, tags, _indextime, _raw';
        },

        getFormats: function() {
            return [
                {
                    id: "bluecoat",
                    fullName: "Blue Coat ProxySG",
                    sourcetype: "bluecoat:proxysg:access:syslog",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2758/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/BlueCoatProxySG/About",
                    regexs: [/(?:"([^"]+)"|(\S+))\s+(?:"(\d{1,2}:\d{1,2}:\d{1,2})"|(\d{1,2}:\d{1,2}:\d{1,2}))\s+(?:"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"|(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}))\s+(?:"(\d+)"|(\d+))\s+(?:"(\d+)"|(\d+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s+(?:"([^"]+)"|(\S+))\s*/],
                },
                {
                    id: "microsoft_iis",
                    fullName: "Microsoft IIS",
                    sourcetype: "ms:iis:default",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3185/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/MSIIS/About",
                    regexs: [/^[^\s]+\s[^\s]+\s(?:\/[^\s]*|-)\s+[^\s]\s+("[^"]+")\s+\d+\s+("[^"]+")\s+(?:"[^"]*"|-)\s+(?:\d+|-)\s+(?:\d+|-)\s+(?:\d+|-)\s+(?:\d+|-)\s+(?:"[^"]*"|-)\s+/],
                },
                {
                    id: "squid",
                    fullName: "Squid Proxy",
                    sourcetype: "squid:access",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/2965/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/Squid/About",
                    regexs: [/^[^\s]+\s+(\d+)\s+([^\s]+)\s+([^\/\s]+)\/([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\/]+)\/([^\s]+)\s+(.*)$/],
                },
                {
                    id: "bro",
                    fullName: "BRO HTTP",
                    sourcetype: "bro_http",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/1617/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/BroIDS/Description",
                    regexs: [/^[0-9\.]+\s+[A-Za-z0-9]+\s+[^\s]+\s+[\d]+\s+[^\s]+\s+[\d]+\s+[\d]+\s+[^\s]+\s+[^\s]+\s+(\/[^\s]*)\s+(?:http|https)(:\/\/[^\s]+\s+)/],
                },
                {
                    id: "haproxy",
                    fullName: "HAProxy",
                    sourcetype: "haproxy:http",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3135/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/HAProxy/About",
                    regexs: [/\S+\s+haproxy\[[^\]]+\]:\s+[^\s:]+:[^\s:]+\s+\[[^\]]*\]\s+\S+\s+[^\s/]*\/[^\s\/]*\s+[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\s+\S+\s+[^\/\s]+\s+\S+\s+\S+\s+\S+\s+[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\/[^\/\s]*\s+[^\/\s]*\/[^\/\s]*\s+/],
                },
                {
                    id: "apache",
                    fullName: "Apache Web Server",
                    sourcetype: "apache:access",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3186/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/ApacheWebServer/About",
                    regexs: [/^[^ ]+\s+.+\s+\S+\s+\S+\s+\d+\s+\[\d+\/\w+\/\d+:\d+:\d+:\d+\s+[-+]\d+[^"\n]*"[^"]+[^ \n]*\s+\"[^ ]*\"\s+\d+(?:[^ \n]* ){2}\"[^"]+\"\s+\"[^"]+\"\s+\d+\s+\d+\s+\d+/],
                },
                {
                    id: "akamai",
                    fullName: "Akamai Cloud Monitor",
                    sourcetype: "akamai:cm:json",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3030/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/Akamai/About",
                    regexs: [/(?:"type":\s*"cloud_monitor".*"message":\s*{.*"reqHost":|"message":\s*{.*"reqHost":.*"type":\s*"cloud_monitor")/],
                },
                {
                    id: "nginx",
                    fullName: "NGINX",
                    sourcetype: "nginx:plus:access",
                    custom: false,
                    addonLink: "https://splunkbase.splunk.com/app/3258/",
                    documentationLink: "https://docs.splunk.com/Documentation/AddOns/latest/nginx/About",
                    regexs: [/^\S+\s+\S+\s+\S+\s+\[[^\]]+\]\s+"\s*[^\s"]+\s+\S+\s+\S+\"\s+\S+\s+\S+\s"[^"]*"\s"[^"]*"/],
                },
            ]
        },

        detect: function(stats) {
            this.render();
            this.detection.refreshProviders(stats);
            this.detection.detect();
        },

        render: function() {
            this.renderModal(this.detection.template);
            this.showModal();
            return this;
        },
    });
});
