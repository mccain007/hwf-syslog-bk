define([
    'underscore',
    'jquery',
    'splunkjs/mvc',
    'splunkjs/mvc/tableview',
    'splunkjs/mvc/chartview',
    'splunkjs/mvc/searchmanager'
], function(_, $, mvc, TableView, ChartView, SearchManager) {
    return TableView.BaseRowExpansionRenderer.extend({
        initialize: function (options) {
            _.extend(this, _.pick(options, "policy"));
            if (this.policy == undefined) {
                this.policy = 0;
            }

            this.searchManager = new SearchManager({
                id: 'threats-search-manager',
                preview: false
            });

            this.threatsChart = new ChartView({
                id: 'threats-details-chart',
                type: 'line',
                managerid: 'threats-search-manager',
                height: 190,

                'charting.axisTitleX.visibility': 'collapsed',
                'charting.axisTitleY.visibility': 'collapsed',
                'charting.legend.labelStyle.overflowMode': 'ellipsisNone'
            });

            this.threatsChart.on('click:legend', this.setThreatToken.bind(this));
            this.threatsChart.on('click:chart', this.setThreatToken.bind(this));

            this.currentSource = null;
        },

        setThreatToken: function(ev) {
            ev.preventDefault();

            var tokenModels = ['default', 'submitted'];
            for (var i = 0; i < tokenModels.length; i++) {
                var tokenModel = mvc.Components.get(tokenModels[i]);
                tokenModel.set('detailthreat', ev.name2);
                tokenModel.set('detaildescription', ev.name2 + ' on');
                tokenModel.set('detailsource', this.currentSource);
            }
        },

        canRender: function(rowData) {
            return true;
        },

        render: function($container, rowData) {
            this.currentSource = _(rowData.cells).find(function (cell) {
                return cell.field === "Source";
            }).value;

            var tokenModel = mvc.Components.get('default');

            var search = '`nbaeventsindex` type=alert ' +
                '| search ' + tokenModel.get('sectionfilter') + ' ' +
                '| eval alert_source = if(isnull(src_disp) or src_disp == "", src_ip, src_disp) ' +
                '| search alert_source="' + this.currentSource + '" ' +
                '| eval action_filter_matched=`match_filter_event_action("' + tokenModel.get('actionfilter') + '")` ' +
                '| search action_filter_matched=1' +
                '| eval groups=if(isnull(src_groups), "-", src_groups) ' +
                '| search ' + tokenModel.get('groupfilter') + ' ' +
                '| lookup asocnbathreats name AS threats OUTPUT title, severity, show, policy ' +
                '| eval show=if(isnull(show), 1, show) ' +
                '| eval policy=if(isnull(policy), 0, policy) ' +
                '| eval threats=mvzip(mvzip(mvzip(title, severity, "|"), show, "|"), policy, "|") ' +
                '| mvexpand threats ' +
                '| rex field=threats "(?<title>[^|]+).(?<severity>[^|]+).(?<show>[^|]+).(?<policy>.*)" ' +
                '| search title=* severity>=' + tokenModel.get('severityscore') + ' policy=' + this.policy + ' show=1 ' +
                '| eval _time=strptime(original_event, "%d-%b-%Y %H:%M:%S%z") ' +
                '| timechart count by title';

            this.searchManager.set({
                earliest_time: tokenModel.get('earliest'),
                latest_time: tokenModel.get('latest'),
                search: search
            });

            var el = this.threatsChart.render().el;
            $container.append(el);
        }
    });
});
