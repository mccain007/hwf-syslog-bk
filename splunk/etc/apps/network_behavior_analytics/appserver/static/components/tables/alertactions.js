define([
    'underscore',
    'splunkjs/mvc/tableview',
    'nba/components/common/dropdownmenu',
], function(_, TableView, DropDownMenu) {
    URL = {
        'dns': {
            'vst': 'https://www.virustotal.com/gui/domain/<DESTINATION>/relations',
            'pd': 'https://pulsedive.com/indicator/?ioc=<DESTINATION>',
            'mv': 'https://maltiverse.com/hostname/<DESTINATION>',
        },
        'ip': {
            'vst': 'https://www.virustotal.com/gui/ip-address/<DESTINATION>/relations',
            'pd': 'https://pulsedive.com/indicator/?ioc=<DESTINATION>',
            'mv': 'https://maltiverse.com/ip/<DESTINATION>',
        }
    }

    MENU_VST = 'vst';
    MENU_PD = 'pd';
    MENU_MV = 'mv';
    MENU_CLUSTER = 'sc';

    CLUSTER_URL = '/app/network_behavior_analytics/search?q=';
    CLUSTER_HALF_SECONDS = 300;

    return TableView.BaseCellRenderer.extend({
        initialize: function() {
            this.dropDown = null;
        },

        canRender: function (cell) {
            return cell.field === 'Pivots';
        },

        setup: function(cell) {},
        tearDown: function(cell) {},

        showClusterError: function() {
            alert('Error decoding row data');
        },

        createDropDown: function(values) {
            return new DropDownMenu({
                dropdownClass: 'asoc-alert-actions',
                items: this.createItems(values),
            });
        },

        createItems: function(values) {
            if (values.length != 5) {
                return [];
            }

            var options = [];
            if (values[3] && values[3] !== "-") {
                var dest_type = values[4] == "1" ? "ip" : "dns";
                options = [
                    {
                        label: 'Open VirusTotal',
                        value: MENU_VST + '|' + dest_type + '|' + values[3],
                    }, {
                        label: 'Open Maltiverse',
                        value: MENU_MV + '|' + dest_type + '|' + values[3],
                    }
                ];

                try {
                    dest = this.b64EncodeUnicode(values[3]);
                    options.push({
                        label: 'Open Pulsedive',
                        value: MENU_PD + '|' + dest_type + '|' + dest,
                    })
                } catch {}
            }

            options.push({
                label: 'Show cluster',
                value: MENU_CLUSTER + '|' + values[0] + '|' + values[1] + '|' + values[2]
            })

            return options;
        },

        itemClicked: function(itemData) {
            if (itemData == null) {
                this.showClusterError();
                return;
            }

            var data = this.parseData(itemData);
            if (data == null) {
                this.showClusterError();
                return;
            }

            if (data.type == MENU_CLUSTER) {
                this.runCluster(data);
            } else {
                this.run(data);
            }
        },

        parseData: function(data) {
            var fields = data.split('|');
            if (fields.length == 0) {
                return null;
            }

            if (fields[0] === MENU_CLUSTER) {
                return this.createCluster(fields);
            } else {
                return this.createDataDict(fields);
            }
        },

        createCluster: function(fields) {
            if (fields.length != 4) {
                return null;
            }

            return { type: fields[0], ts: fields[1], section: fields[2], src: fields[3] }
        },

        createDataDict: function(fields) {
            if (fields.length != 3) {
                return null;
            }

            return { type: fields[0], section: fields[1], dest: fields[2] }
        },

        runCluster: function(data) {
            var params = {}
            params.source = data.src;

            ts = parseInt(data.ts)
            if (isNaN(ts)) {
                params.tsFrom = data.ts;
                params.tsTo = data.ts;
            } else {
                params.tsFrom = ts - CLUSTER_HALF_SECONDS;
                params.tsTo = ts + CLUSTER_HALF_SECONDS;
            }

            var searchString = this.formatClusterUrl(data.section, params)
            if (searchString == null) {
                this.showClusterError();
                return;
            }
            window.open(CLUSTER_URL + searchString, '_blank');
        },

        formatClusterUrl: function(section, params) {
            if (section == "dns") {
                return encodeURI(this.clusterSearchDns(params));
            } else if (section == "ip") {
                return encodeURI(this.clusterSearchIp(params));
            } else if (section == "http") {
                return encodeURI(this.clusterSearchHttp(params));
            } else if (section == "tls") {
                return encodeURI(this.clusterSearchTls(params));
            }

            return null;
        },

        run: function(data) {
            var url = this.formatUrl(data);
            if (url == null) {
                this.showClusterError();
                return;
            }
            window.open(url, '_blank');
        },

        b64EncodeUnicode(value) {
            return btoa(encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, function(_, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        },

        formatUrl: function(data) {
            var section_url = URL[data.section];
            if (section_url == undefined) {
                return null;
            }

            var url = section_url[data.type];
            if (url == undefined) {
                return null;
            }

            return url.replace('<DESTINATION>', data.dest);
        },

        render: function ($td, cell) {
            this.dropDown = this.createDropDown(cell.value);

            this.dropDown.on("itemClicked", function(itemData) {
                this.itemClicked(itemData);
            }.bind(this));

            this.dropDown.$el.detach();
            $td.html(this.dropDown.render().el);
        },

        clusterSearchDns: _.template(
            'search `nbalogsindexdns` tag="dns" tag="network" tag="resolution" ' +
            '_time>=<%= tsFrom %> _time<=<%= tsTo %> ' +
            '| eval Source=if(isnull(src_ip), src, src_ip) ' +
            '| search Source=<%= source %> ' +
            '| eval Time=strftime(_time, "%d-%b-%Y %H:%M:%S") ' +
            '| rename query as Destination, record_type as "Query type", reply_code as Response ' +
            '| table Time, Source, Destination, "Query type", Response'
        ),

        clusterSearchIp: _.template(
            'search `nbalogsindexip` tag="network" tag="communicate" ' +
            '_time>=<%= tsFrom %> _time<=<%= tsTo %> ' +
            '| eval Source=if(isnull(src_ip), src, src_ip) ' +
            '| search Source=<%= source %> ' +
            '| eval Time=strftime(_time, "%d-%b-%Y %H:%M:%S") ' +
            '| eval section="ip" ' +
            '| eval dest=if(isnull(dest), dest_ip, dest) ' +
            '| eval fdest=`format_dest(section, dest, dest_port)` ' +
            '| eval Destination=if(isnull(fdest) or fdest == "", dest, fdest) ' +
            '| eval Transport=if(isnull(transport), protocol, transport) ' +
            '| eval "Bytes in"=`human_bytes(bytes_in)` ' +
            '| eval "Bytes out"=`human_bytes(bytes_out)` ' +
            '| rename action as Action ' +
            '| table Time, Source, Destination, Action, Transport, "Bytes in", "Bytes out"'
        ),

        clusterSearchHttp: _.template(
            'search `nbalogsindexhttp` tag="web" _time>=<%= tsFrom %> _time<=<%= tsTo %> ' +
            '| eval Source=if(isnull(src_ip), src, src_ip) ' +
            '| search Source=<%= source %> ' +
            '| eval Time=strftime(_time, "%d-%b-%Y %H:%M:%S") ' +
            '| eval Destination=if(isnull(url), site, url) ' +
            '| rename http_user_agent as "User agent", status as Response action as Action ' +
            '| table Time, Source, Destination, "User agent", Response, Action'
        ),

        clusterSearchTls: _.template(
            'search `nbalogsindextls` tag="certificate" _time>=<%= tsFrom %> _time<=<%= tsTo %> ' +
            '| eval Source=if(isnull(src_ip), src, src_ip) ' +
            '| search Source=<%= source %> ' +
            '| eval Time=strftime(_time, "%d-%b-%Y %H:%M:%S") ' +
            '| eval "Valid from"=strftime(ssl_start_time, "%d-%b-%Y %H:%M:%S") ' +
            '| eval "Valid to"=strftime(ssl_end_time, "%d-%b-%Y %H:%M:%S") ' +
            '| rename ssl_issuer as Issuer, ssl_subject as Subject ' +
            '| table Time, Source, Issuer, Subject, "Valid from", "Valid to"'
        ),
    });
});
