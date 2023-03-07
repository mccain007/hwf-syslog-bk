define([
    'underscore',
    'jquery',
    'backbone',
    'splunkjs/mvc/searchmanager',
], function (_, $, Backbone, SearchManager) {
    return Backbone.View.extend({
        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "section", "title", "dataName",
                "detection", "queryMacro", "queryTags"));

            this.stats = [];
            this.liveStats = [];

            this.error = null;
            this.runned = false;
        },

        runProviderSearch: function() {
            var providerSearch = new SearchManager({
                search: this.providerSearchQuery(),
                preview: false,
            });

            providerSearch.data("results").on("data", function(results) {
                this.stats = results.data().rows;
                this.refreshStats();
            }.bind(this));

            providerSearch.on("search:progress", function(info) {
                this.searchProgress(info);
            }.bind(this));

            providerSearch.on("search:done", function(props) {
                if (props.hasOwnProperty('content') && props.content.hasOwnProperty('eventCount')) {
                    if (props.content.eventCount === 0) {
                        this.stats = [];
                        this.refreshStats();
                    }
                } else {
                    this.renderError('The search returned an unexpected object.')
                }
            }.bind(this));

            providerSearch.on("search:error", function(err) {
                this.renderError(err);
            }.bind(this));

            providerSearch.on("search:failed", function(err) {
                this.renderError(err);
            });

            providerSearch.on("search:cancelled", function() {
                this.renderError('The search was cancelled.');
            }.bind(this));
        },

        providerSearchQuery: function() {
            return '`' + this.queryMacro + '` ' + this.queryTags + ' earliest=-24h latest=+24h _index_earliest=-1h ' +
                   '| stats count by sourcetype | sort by sourcetype';
        },

        searchProgress: function(info) {
            if (info.hasOwnProperty('content') && info.content.hasOwnProperty('doneProgress')) {
                var progress = Math.floor(Math.min(1.0, info.content.doneProgress) * 100);
                var msg = "Checking (" + progress + "%)...";
                this.renderContent(this.messageTemplate({style: 'font-style: italic', msg: msg}));
            }
        },

        runLiveDataSearch: function() {
            var liveDataSearch = new SearchManager({
                search: this.liveDataSearchQuery(),
                preview: false,
            });

            liveDataSearch.data("results").on("data", function(results) {
                var rows = results.data().rows;
                this.liveStats = rows;

                if (rows.length > 0) {
                    this.renderContent(this.noLiveDataTemplate(this));
                } else {
                    this.renderContent(this.noDataTemplate(this));
                }
            }.bind(this));

            liveDataSearch.on("search:progress", function(info) {
                this.searchProgress(info);
            }.bind(this));

            liveDataSearch.on("search:done", function(props) {
                if (props.hasOwnProperty('content') && props.content.hasOwnProperty('eventCount')) {
                    if (props.content.eventCount === 0) {
                        this.liveStats = [];
                        this.renderContent(this.noDataTemplate(this));
                    }
                } else {
                    this.renderError('The search returned an unexpected object.')
                }
            }.bind(this));

            liveDataSearch.on("search:error", function(err) {
                this.renderError(err);
            }.bind(this));

            liveDataSearch.on("search:failed", function(err) {
                this.renderError(err);
            });

            liveDataSearch.on("search:cancelled", function() {
                this.renderError('The search was cancelled.');
            }.bind(this));
        },

        liveDataSearchQuery: function() {
            return '`' + this.queryMacro + '` ' + this.queryTags + ' earliest=-7d latest=+1d | head 1 ';
        },

        events: {
            'click .data-detection': 'dataDetectionClicked',
        },

        dataDetectionClicked: function(ev) {
            this.detection.detect(this.stats);
        },

        refreshStats: function () {
            if (this.stats.length === 0) {
                this.runLiveDataSearch();
            } else {
                this.renderStats();
            }
        },

        refreshRows: function() {
            if (this.error) {
                this.renderContent(this.messageTemplate({style: 'color: #d02020', msg: 'Error: ' + this.error }));
            } else if (this.stats.length === 0) {
                if (this.liveStats.length > 0) {
                    this.renderContent(this.noLiveDataTemplate(this));
                } else {
                    this.renderContent(this.noDataTemplate(this));
                }
            } else {
                this.renderStats();
            }
        },

        refreshSearch: function() {
            this.error = null;

            this.renderContent(this.messageTemplate({style: 'font-style: italic', msg: 'Checking (0%)...'}));
            this.runProviderSearch();
            this.runned = true;
        },

        refresh: function() {
            if (!this.runned) {
                this.refreshSearch();
            } else {
                this.refreshRows();
            }
        },

        renderError: function (err) {
            var msg = $('<div></div>').text(err).html();
            if (msg.slice(-1) !== '.') msg += '.';
            msg += ' Please contact <a href="mailto:support@alphasoc.com">support@alphasoc.com</a>.';

            this.error = msg;
            this.renderContent(this.messageTemplate({style: 'color: #d02020', msg: 'Error: ' + msg }));
        },

        renderContent: function(htmlContent) {
            $('#data-logs-stats-content', this.$el).html(htmlContent);
        },

        renderStats: function() {
            var body = '<table style="width: 100%">';
            for (var i = 0; i < this.stats.length; i++) {
                var item = this.stats[i];
                body += this.rowTemplate({ sourcetype: item[0], events: item[1] });
            }
            body += '<tr><td></td><td style="padding-top: 3px"><a href="#" class="data-detection" style="font-weight: bold">' +
                'Add more providers / autodetect ' + this.title + ' data</a></td></tr></table>';

            this.renderContent(body);
        },

        render: function () {
            this.$el.html(this.template(this));
            return this;
        },

        template: _.template(
            '<h2 class="panel-title">Detected <%= title %> data providers</h2>' +
            '<div id="data-logs-stats-content" class="data-location-box"></div>'
        ),

        messageTemplate: _.template(
            '<div><p style="<%= style %>"><%= msg %></p></div>'
        ),

        rowTemplate: _.template(
            '<tr>' +
                '<td style="width: 40%; font-weight: bold"><%= sourcetype %></td>' +
                '<td>' +
                    '<span style="color: #228B22">Installed</span> ' +
                    '<span style="color: #999999">(<%= events %> events in the past hour)</span>' +
                '</td>' +
            '</tr>'
        ),

        noLiveDataTemplate: _.template(
            '<div>' +
                '<h3 style="color: #d02020">No live data found</h3>' +
                '<p style="color: #d02020">' +
                    'The data provider is configured correctly, but there is no live data. Please check ' +
                    'the forwarder configuration and ensure data is being indexed.' +
                '</p>' +
                '<div class="data-detection-button">' +
                    '<button type="button" class="btn btn-default data-detection">Try to autodetect <%= title %> data</button>' +
                '</div>' +
            '</div>'
        ),

        noDataTemplate: _.template(
            '<div>' +
                '<h3 style="color: #d02020">No data providers found</h3>' +
                '<p style="color: #d02020">' +
                    'Network Behavior Analytics is designed to process live <%= dataName %> events ' +
                    'compliant with the Splunk Common Information Model (CIM). We were unable to ' +
                    'find any CIM compliant data indexed within the last 7 days. Please configure a ' +
                    'suitable Technical Addon (TA) for your data format and ensure that live data is indexed.' +
                '</p>' +
                '<div class="data-detection-button">' +
                    '<button type="button" class="btn btn-default data-detection">Try to autodetect <%= title %> data</button>' +
                '</div>' +
            '</div>'
        )
    });
});
