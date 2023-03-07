define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/urgencynames',
    'nba/components/common/handleresterror',
], function (_, $, Backbone, urgencyNames, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/servicesNS/nobody/network_behavior_analytics/properties/savedsearches/',
        APP_CONFIG_URL: '/servicesNS/nobody/network_behavior_analytics/properties/nba/escalation/',

        SCHEDULES: [
            ['*/5 * * * *', '5 minutes', '-5m'],
            ['*/15 * * * *', '15 minutes', '-15m'],
            ['*/30 * * * *', '30 minutes', '-30m'],
            ['0 * * * *', 'hour', '-1h'],
            ['0 */4 * * *', '4 hours', '-4h'],
            ['0 */12 * * *', '12 hours', '-12h'],
            ['0 0 * * *', 'day', '-1d'],
        ],

        THROTTLING: [
            ['disabled', 'Disabled'],
            ['15m', '15 minutes'],
            ['30m', '30 minutes'],
            ['1h', '1 hour'],
            ['2h', '2 hours'],
            ['4h', '4 hours'],
            ['6h', '6 hours'],
            ['12h', '12 hours'],
            ['1d', '1 day'],
            ['7d', '1 week'],
        ],

        SAVED_SEARCH: '`nbaeventsindex` type=alert threats=* ' +
            '| mvexpand threats ' +
            '| eval group=mvjoin(mvsort(if(isnull(src_groups), "-", src_groups)), ", ") ' +
            '| lookup asocnbathreats name AS threats OUTPUT title, severity, show, policy ' +
            '| eval show=if(isnull(show), 1, show) ' +
            '| eval policy=if(isnull(policy), 0, policy) ' +
            '| search show=1 policy=$policy$ severity>=$severity$ ' +
            '| eval c_time=strftime(strptime(original_event, "%d-%b-%Y %H:%M:%S%z"), "%d-%b-%Y %H:%M:%S") ' +
            '| eval alert_source = if(isnull(src_disp) or src_disp == "", src_ip, src_disp) ' +
            '| sort 0 -severity ' +
            '| streamstats count by alert_source, group ' +
            '| stats latest(c_time) AS "time", dc(title) AS "total_threats", list(eval(if(count<=1,title,null()))) AS "top_threat", max(severity) AS "severity" by alert_source, group ' +
            '| rename alert_source AS source ' +
            '| sort by -severity, -time',

        SAVED_SEARCH_NOTABLE: '`nbaeventsindex` type=alert threats=* ' +
            '| mvexpand threats ' +
            '| eval src_user_group=mvjoin(mvsort(if(isnull(src_groups), "-", src_groups)), ", ") ' +
            '| lookup asocnbathreats name AS threats OUTPUT title, severity, show, policy ' +
            '| eval show=if(isnull(show), 1, show) ' +
            '| eval policy=if(isnull(policy), 0, policy) ' +
            '| search show=1 policy=$policy$ severity>=$severity$ ' +
            '| eval c_time=strftime(strptime(original_event, "%d-%b-%Y %H:%M:%S%z"), "%d-%b-%Y %H:%M:%S") ' +
            '| eval alert_source = if(isnull(src_disp) or src_disp == "", src_ip, src_disp) ' +
            '| sort 0 -severity ' +
            '| streamstats count by alert_source, src_user_group ' +
            '| stats values(app) AS app, latest(c_time) AS "modtime", dc(title) AS "size", max(severity) AS severity_id, values(src_ip) AS src_ip, values(threats) AS desc, list(eval(if(count<=1,title,null()))) AS subject by alert_source, src_user_group ' +
            '| eval severity=case(severity_id == 2, "low", severity_id == 3, "medium", severity_id == 4, "high", severity_id == 5, "critical", true(), "informational") ' +
            '| eval priority="$priority$" ' +
            '| eval category="$category$" ' +
            '| rename alert_source as src',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "alertType", "showUrgency", "onError"));

            if (this.alertType === 'threats') {
                this.actionsLink = 'AlphaSOC%2520NBA%2520-%2520New%2520threats';
                this.configUrl = this.REST_URL + 'AlphaSOC%20NBA%20-%20New%20threats/';
                this.policy = '0';
            } else if (this.alertType === 'policy') {
                this.actionsLink = 'AlphaSOC%2520NBA%2520-%2520New%2520violations';
                this.configUrl = this.REST_URL + 'AlphaSOC%20NBA%20-%20New%20violations/';
                this.policy = '1';
            } else if (this.alertType === 'threats_notable') {
                this.actionsLink = 'Threat%2520-%2520AlphaSOC%2520NBA%2520-%2520Threat%2520Hunter%2520-%2520Rule';
                this.configUrl = this.REST_URL + 'Threat%20-%20AlphaSOC%20NBA%20-%20Threat%20Hunter%20-%20Rule/';
                this.policy = '0';
                this.priority = 'medium';
                this.category = 'Threat Hunter';
            } else if (this.alertType === 'policy_notable') {
                this.actionsLink = 'Threat%2520-%2520AlphaSOC%2520NBA%2520-%2520Policy%2520Violations%2520-%2520Rule';
                this.configUrl = this.REST_URL + 'Threat%20-%20AlphaSOC%20NBA%20-%20Policy%20Violations%20-%20Rule/';
                this.policy = '1';
                this.priority = 'low';
                this.category = 'Policy Violations';
            }

            this.currentUrgency = 3;
            this.urgencies = [];
            for (var i = 0; i <= 5; i++) this.urgencies.push([i, urgencyNames(i)])
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.onError(message);
        },

        setSchedule: function(ev, field) {
            var val = ev.target.value;
            var select = this.$('select.schedule');

            select.attr('disabled', true);
            this.restService.post(this.configUrl + 'cron_schedule', { value: val }, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                    select.removeAttr('disabled');
                } else {
                    var earliest = this.chooseEarliest(val);
                    this.restService.post(this.configUrl + 'dispatch.earliest_time', { value: earliest }, function (errp, resp) {
                        if (errp) {
                            this.handleRestError(errp);
                        }
                        select.removeAttr('disabled');
                    }.bind(this));
                }
            }.bind(this));
        },

        chooseEarliest: function(value) {
            var earliest = '-1d';
            for (var i = 0; i < this.SCHEDULES.length; i++) {
                if (this.SCHEDULES[i][0] === value) {
                    earliest = this.SCHEDULES[i][2];
                    break;
                }
            }
            return earliest;
        },

        getSchedule: function() {
            var select = this.$('select.schedule');

            select.attr('disabled', true);
            this.restService.get(this.configUrl + 'cron_schedule', {}, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    select.html(this.getSelectSettings(res.data, this.SCHEDULES));
                }
                select.removeAttr('disabled');
            }.bind(this));
        },

        getSelectSettings: function(val, choices) {
            var html = '';
            var found = false;

            for (var i = 0; i < choices.length; i++) {
                var choice = choices[i];
                html += '<option value="' + choice[0] + '"';
                if (val === choice[0]) {
                    html += ' selected="selected"';
                    found = true;
                }
                html += '>' + choice[1] + '</option>';
            }

            if (!found) {
                html += '<option value="' + val;
                html += '" selected="selected">' + val + '</option>';
            }

            return html;
        },

        setUrgency: function(ev, field) {
            var val = ev.target.value;
            this.currentUrgency = parseInt(val);

            var select = this.$('select.urgency');

            select.attr('disabled', true);
            this.restService.post(this.APP_CONFIG_URL + this.alertType + '.minimum_urgency', { value: val }, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                    select.removeAttr('disabled');
                } else {
                    var search = this.chooseSearch();
                    if (search == null) {
                        select.removeAttr('disabled');
                    } else {
                        this.restService.post(this.configUrl + 'search', { value: search }, function (err, res) {
                            if (err) {
                                this.handleRestError(err);
                            }
                            select.removeAttr('disabled');
                        }.bind(this));
                    }
                }
            }.bind(this));
        },

        chooseSearch: function() {
            var search = null;
            if (this.alertType === 'threats') {
                search = this.SAVED_SEARCH.replace(/\$policy\$/g, this.policy).replace(/\$severity\$/g, this.currentUrgency);
            } else if (this.alertType === 'threats_notable') {
                search = this.SAVED_SEARCH_NOTABLE.replace(/\$policy\$/g, this.policy).replace(/\$severity\$/g, this.currentUrgency)
                .replace(/\$priority\$/g, this.priority).replace(/\$category\$/g, this.category);
            }
            return search;
        },

        getUrgency: function() {
            var select = this.showUrgency ? this.$('select.urgency') : null
            if (select) {
                select.attr('disabled', true);
            }

            this.restService.get(this.APP_CONFIG_URL + this.alertType + '.minimum_urgency', {}, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    var val = parseInt(res.data);
                    this.currentUrgency = isNaN(val) ? 3 : val;

                    if (select) {
                        select.html(this.getSelectSettings(this.currentUrgency, this.urgencies));
                    }
                }
                if (select) {
                    select.removeAttr('disabled');
                }
            }.bind(this));
        },

        setThrottling: function(ev) {
            var val = ev.target.value;
            var select = this.$('select.throttling');

            select.attr('disabled', true);
            this.restService.post(this.configUrl + 'alert.suppress', { value: val === 'disabled' ? 0 : 1 }, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                    select.removeAttr('disabled');
                } else {
                    if (val === 'disabled') {
                        select.removeAttr('disabled');
                    } else {
                        this.restService.post(this.configUrl + 'alert.suppress.period', { value: val }, function (errp, resp) {
                            if (errp) {
                                this.handleRestError(errp);
                            }
                            select.removeAttr('disabled');
                        }.bind(this));
                    }
                }
            }.bind(this));
        },

        getThrottling: function() {
            var select = this.$('select.throttling');

            select.attr('disabled', true);
            this.restService.get(this.configUrl + 'alert.suppress', {}, function (err, res) {
                if (err) {
                    this.handleRestError(err);
                    select.removeAttr('disabled');
                } else {
                    if (res.data === '1') {
                        this.restService.get(this.configUrl + 'alert.suppress.period', {}, function (errp, resp) {
                            if (errp) {
                                this.handleRestError(errp);
                            } else {
                                select.html(this.getSelectSettings(resp.data, this.THROTTLING));
                            }
                            select.removeAttr('disabled');
                        }.bind(this));
                    } else {
                        select.html(this.getSelectSettings('disabled', this.THROTTLING));
                        select.removeAttr('disabled');
                    }
                }
            }.bind(this));
        },

        render: function() {
            this.$el.html(this.template(this));
            return this;
        },

        refresh: function() {
            this.getSchedule();
            this.getUrgency();
            this.getThrottling();

            this.$('select.schedule').change(this.setSchedule.bind(this));
            this.$('select.urgency').change(this.setUrgency.bind(this));
            this.$('select.throttling').change(this.setThrottling.bind(this));

            return this;
        },

        template: _.template(
            '<table class="escalation-settings-table">' +
                '<tr>' +
                    '<% if (showUrgency) { %>' +
                        '<td class="description">Minimum urgency</td>' +
                    '<% } %>' +
                    '<td class="description">Check for alerts every</td>' +
                    '<td class="description">Throttling ' +
                        '<a data-toggle="collapse" href="#throttling-learnmore-<%= alertType %>" aria-expanded="false" aria-controls="throttling-learnmore-<%= alertType %>">' +
                            'Learn&nbsp;more&nbsp;<span class="caret"></span>' +
                        '</a>' +
                        '<div class="collapse" id="throttling-learnmore-<%= alertType %>">' +
                            '<p>After triggering an alert for a source, don\'t trigger again for this period.</p>' +
                        '</div>' +
                    '</td>' +
                    '<% if (!showUrgency) { %>' +
                        '<td></td>' +
                    '<% } %>' +
                    '<td></td>' +
                '</tr>' +
                '<tr>' +
                    '<% if (showUrgency) { %>' +
                        '<td><select class="urgency"></select></td>' +
                    '<% } %>' +
                    '<td><select class="schedule"></select></td>' +
                    '<td><select class="throttling"></select></td>' +
                    '<% if (!showUrgency) { %>' +
                        '<td></td>' +
                    '<% } %>' +
                    '<td class="td-btn">' +
                        '<a class="btn" target="_blank" href="/savedsearchredirect?s=/servicesNS/nobody/network_behavior_analytics/saved/searches/<%= actionsLink %>">' +
                            'Configure actions <i class="icon-external"></i>' +
                        '</a>' +
                    '</td>' +
                '</tr>' +
            '</table>'
        ),
    });
});
