define([
    'jquery',
    'underscore',
    'backbone',
    'splunkjs/mvc/searchmanager',
    'nba/components/common/handleresterror',
], function($, _, Backbone, SearchManager, handleRestError) {
    return Backbone.View.extend({
        CONFIG_URL: '/servicesNS/nobody/network_behavior_analytics/properties/nba/',
        DOCS_RENAME_URL: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/Renamesourcetypes',
        THRESHOLD_PERCENT: 51,

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "section", "query", "formats"));

            this.configUrl = this.CONFIG_URL + this.section + '/logs_index';
            this.monitioringScope = [];
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.onError(message);
        },
        
        detect: function() {
            this.refreshScope();
        },

        refreshScope: function() {
            this.restService.get(this.configUrl, {}, function(err, response) {
                if (err) {
                    this.handleRestError(err);
                } else {
                    this.monitioringScope = this.parseScope(response.data);
            		this.runSearch();
                }
            }.bind(this));
        },

        parseScope: function(scopeResponse) {
            indexes = scopeResponse.split(",");
            var scope = []

            for (var i = 0; i < indexes.length; i++) {
                var index = indexes[i].trim()
                if (index) {
                    scope.push(index);
                }
            }

            return scope
        },

        runSearch: function() {
            var dataSearch = new SearchManager({
            	search: this.query,
                preview: false,
            });

            dataSearch.data("results", {count: 0}).on("data", function(results) {
                this.detectParseLogs(results.data().rows);
            }.bind(this));

            dataSearch.on("search:done", function(props) {
                if (props.hasOwnProperty('content') && props.content.hasOwnProperty('eventCount')) {
                    if (props.content.eventCount === 0) {
                        this.onEmptyResult();
                    }
                } else {
                    this.onError('The search returned an unexpected object.')
                }
            }.bind(this));

            dataSearch.on("search:progress", function(info) {
                if (info.hasOwnProperty('content') && info.content.hasOwnProperty('doneProgress')) {
                    var progress = Math.floor(Math.min(1.0, info.content.doneProgress) * 100);
                    this.onLoading(progress);
                }
            }.bind(this));

            dataSearch.on("search:error", function(err) {
                this.onError(err);
            }.bind(this));

            dataSearch.on("search:failed", function(err) {
                this.onError(err);
            }.bind(this));

            dataSearch.on("search:cancelled", function() {
                this.onError('The search was cancelled.')
            }.bind(this));
        },

        detectParseLogs: function(logs) {
            var detected = {};
            for (i = 0; i < logs.length; i++) {
                var event = this.detectParseLog(logs[i]);
                if (event && detected[event.id] == undefined) {
                    detected[event.id] = this.createDetectedItem(event);
                } else if (event) {
                    this.updateDetectedItem(detected[event.id], event);
                }
            }

            detected = this.appendStats(detected);
            this.onResult(detected);
        },

        createDetectedItem: function(event) {
            var item = {
                'id': event.id,
                'index': event.index,
                'sourcetype': event.sourcetype,
                'tags': false,
                'inScope': false,
                'live': false,
                'format': null,
                'formats': {},
                'logs': 0,
            }

            for (var i = 0; i < this.formats.length; i++) {
                var format = this.formats[i];
                item.formats[format.id] = {
                    'count': 0,
                    'percent': 0,   
                }
            }

            this.updateDetectedItem(item, event);
            return item;
        },

        updateDetectedItem: function(item, event) {
            item.logs++;

            if (event.format != null) {
                item.formats[event.format].count++;
            }

            if (event.tags == "1") {
                item.tags = true;
            }

            if (event.live) {
                item.live = true;
            }
        },

        detectParseLog: function(log) {
            var index = log[0];
            var sourcetype = log[1];

            if (!index || !sourcetype) {
                return null;
            }

            var tags = log[2];
            var indextime = log[3];
            var raw = log[4];

            var event = this.createEvent(index, sourcetype, tags, indextime, raw);
            event.format = this.detectFormat(event.raw);

            return event;
        },

        createEvent: function(index, sourcetype, tags, indextime, raw) {
            return {
                'id': this.createEventId(index, sourcetype),
                'index': index,
                'sourcetype': sourcetype,
                'tags': tags,
                'live': this.isLiveEvent(indextime),
                'format': null,
                'raw': raw,
            }
        },

        createEventId: function(index, sourcetype) {
        	return index + "|" + sourcetype;
        },

        isLiveEvent: function(indextime) {
            var ts = parseInt(indextime);
            if (isNaN(ts)) {
                return false;
            }

            var now = new Date().getTime() / 1000;
            return now - ts <= 3600;
        },

        detectFormat: function(rawLog) {
            if (rawLog == undefined) {
                return null;
            }

            for (var i = 0; i < this.formats.length; i++) {
                var format = this.formats[i];
                var match = true;

                for (var j = 0; j < format.regexs.length && match; j++) {
                    var regex = format.regexs[j];
                    match = regex.test(rawLog);
                }

                if (match) {
                    return format.id;
                }
            }

            return null;
        },

        appendStats: function(detected) {
            filteredItems = {}

            for (var itemId in detected) {
                var detectedItem = detected[itemId];
                detectedItem = this.chooseItemFormat(detectedItem);
                if (detectedItem.format != null || detectedItem.tags === true) {
                    detectedItem.inScope = this.isInScope(detectedItem.index);
                    filteredItems[itemId] = detectedItem;
                }
            }

            return filteredItems;
        },

        chooseItemFormat: function(item) {
            var maxDetected = 0;
            var detectedFormat = null;

            for (var formatName in item.formats) {
                var logsInFormat = this.formatPercent(formatName, item);
                item.formats[formatName].percent = logsInFormat;

                if (logsInFormat > maxDetected && logsInFormat >= this.THRESHOLD_PERCENT) {
                    maxDetected = logsInFormat;
                    detectedFormat = formatName;
                }
            }

            item.format = detectedFormat;
            return item;
        },

        formatPercent: function(formatName, item) {
            var numberOfLogs = item.logs;
            var logsInFormat = item.formats[formatName].count;

            return numberOfLogs > 0 ? logsInFormat / numberOfLogs * 100 : 0;
        },

        isInScope: function(indexName) {
        	return this.monitioringScope.length == 0 || this.monitioringScope.indexOf(indexName) > -1;
        },

        onError: function(err) {
            $(".data-misconfigured-message").html(this.templateMessage({
                message: "Error: " + err,
                msgClass: "error",
            }));
        },

        onLoading: function(progress) {
            $(".data-misconfigured-message").html(this.templateMessage({
                message: "Checking sourcetypes (" + progress + "%)...",
                msgClass: "search-progress",
            }));
        },

        onEmptyResult: function() {
            $(".data-misconfigured-message").html(this.templateMessage({
                message: "No misconfigured data found.",
                msgClass: "success",
            }));
        },

        onResult: function(result) {
            $(".data-misconfigured-message").html("");
            this.refreshDetected(result);
        },

        refreshProviders: function(providerStats) {
            var stats = providerStats || [];
            var body = "";

            if (stats.length === 0) {
                body = this.onEmptyProviders();
            } else {
                body = '<table style="width: 100%">';
                for (var i = 0; i < stats.length; i++) {
                    var provider = stats[i];
                    body += this.templateProvider({sourcetype: provider[0], events: provider[1]});
                }
                body += '</table>'
            }

            $(".data-provider-content").html(body);
        },

        onEmptyProviders: function() {
            return this.templateMessage({
                message: "We were unable to find any events compliant with the Splunk Common Information Model within the last 1 hour.",
                msgClass: "error",
            });
        },

        refreshDetected: function(result) {
            if (_.isEmpty(result)) {
                this.onEmptyResult();
            } else {
                this.renderDetected(result);
            }
        },

        renderDetected: function(detected, formats) {
            var body = '<table style="width: 100%">';
            var problemDetected = false;

            for (var itemId in detected) {
                var item = detected[itemId];
                var problems = false;
                var title = "";
                var content = "";

                if (!item.inScope) {
                    title = this.templateExtendTitle({ 'title': title, 'nextTitle': "Out of scope" });
                    content += this.templateOutOfScope({ 'index': item.index });
                    problems = true;
                }
                
                if (!item.live) {
                    title = this.templateExtendTitle({ 'title': title, 'nextTitle': "No live data" });
                    content += this.templateNoLiveData({ 'index': item.index });
                    problems = true; 
                }

                var format = _.find(this.formats, function(format){ return format.id == item.format });
                if (!item.tags && format) {
                    if (!format.custom) {
                        if (item.sourcetype === format.sourcetype) {
                            title = this.templateExtendTitle({ 'title': title, 'nextTitle': "Missing addon" });
                            content += this.templateMissingAddon({
                                sourcetype: item.sourcetype,
                                format: format.fullName,
                                addon_link: format.addonLink,
                                documentation_link: format.documentationLink,
                            });
                            problems = true;
                        } else {
                            title = this.templateExtendTitle({ 'title': title, 'nextTitle': "Wrong sourcetype" });
                            content += this.templateWrongSourcetype({
                                sourcetype: item.sourcetype,
                                format: format.fullName,
                                right_sourcetype: format.sourcetype,
                                addon_link: format.addonLink,
                                documentation_link: this.DOCS_RENAME_URL,
                            });
                            problems = true;
                        }
                    } else {
                        title = this.templateExtendTitle({ 'title': title, 'nextTitle': "Missing addon" });
                        content += this.templateInstallAddon({
                            format: format.fullName,
                            sourcetype: item.sourcetype,
                            addon_link: format.addonLink + item.sourcetype,
                            addon_name: format.addonName,
                        });
                        problems = true;
                    }
                }

                if (problems) {
                    body += this.templateIndex({
                        'sourcetype': item.sourcetype,
                        'index': item.index,
                        'title': title,
                        'content': content
                    });
                    problemDetected = true;
                }
            }
            body += '</table>'

            if (problemDetected) {
                $(".data-misconfigured-content").html(body);
            } else {
                this.onEmptyResult();
            }
        },

        templateMessage: _.template(
            '<span class="<%= msgClass %>"><%= message %></span>'
        ),

        templateProvider: _.template(
            '<tr style="height: 20px">' +
                '<td class="data-detection-left"><%= sourcetype %></td>' +
                '<td>' +
                    '<span class="success">Installed</span> ' +
                    '<span class="success-details">(<%= events %> events in the past hour)</span>' +
                '</td>' +
            '</tr>'
        ),

        templateIndex: _.template(
        	'<tr class="data-detection-title">' +
                '<td class="data-detection-left"><%= sourcetype %></td>' +
                '<td class="data-detection-error"><%= title %></td>' +
            '</tr>' +
            '<tr class="data-detection-desc">' +
                '<td class="data-detection-index"><%= index %></td>' +
                '<td class="data-detection-desc"><%= content %></td>' +
            '</tr>'
        ),

        templateExtendTitle: _.template(
        	"<% if (title.length > 0) { %>" +
        		"<%= title %>, <%= nextTitle %>" +
        	"<% } else { %>" +
        		"<%= nextTitle %>" +
        	"<% } %>"
        ),

        templateOutOfScope: _.template(
            "<p>" +
                "This sourcetype is found within the <code><%= index %></code> index, which is outside of the scope you have " +
                "defined under the <b>Data Location</b> settings." +
        	"</p>"
        ),

        templateNoLiveData: _.template(
            "<p>" +
                "We were unable to find any CIM compliant data indexed within the last 1 hour. Please check the " +
                "forwarder configuration and ensure data is being indexed." +
        	"</p>"
        ),
        
        templateMissingAddon: _.template(
        	"<p>" +
	        	"It appears your data is in <b><%= format %></b> format, but the corresponding official data provider " +
	            "addon is missing or misconfigured. Please install <a href='<%= addon_link %>' target='_blank'>" +
	            "Splunk Add-on for <%= format %></a> or revise its configuration if it's already installed. For further " +
	            "information, please refer to the <a href='<%= documentation_link %>' target='_blank'>" +
	            "add-on documentation</a>." +
	        "</p>"
        ),

        templateWrongSourcetype: _.template(
        	'<p>' +
				'It appears your data is in <b><%= format %></b> format, but has an incorrect sourcetype. ' +
	            'Please rename <code><%= sourcetype %></code> sourcetype to <code><%= right_sourcetype %></code> and install a ' +
	            'corresponding data provider add-on: <a href="<%= addon_link %>" target="_blank">Splunk Add-on for ' +
	            '<%= format %></a>. For further information how to rename a sourcetype, please refer here: ' +
	            '<a href="<%= documentation_link %>" target="_blank">How to rename a sourcetype</a> or contact ' +
	            '<a href="mailto:support@alphasoc.com">support@alphasoc.com</a>.' +
	        '</p>'
        ),

        templateInstallAddon: _.template(
        	'<p>' +
        		'It appears your data is in <b><%= format %></b> format, but a corresponding data provider plugin is ' +
            	'missing. Please download and install the required add-on: <a href="<%= addon_link %>"><%= addon_name %></a>.' +
            '</p>'
        ),

        template: _.template(
            '<div class="data-detection-modal body-main">' +
                '<div class="detection-provider-stats">' +
                    '<h2>Detected data providers</h2>' +
                    '<div class="data-provider-content"></div>' +
                '</div>' +
                '<div class="detection-misconfigured-data">' +
                    '<h2>Misconfigured data</h2>' +
                    '<div class="data-misconfigured-message">' +
                        '<span class="search-progress">Checking sourcetypes (0%)...</span>' +
                    '</div>' +
                    '<div class="data-misconfigured-content"></div>' +
                '</div>' +
            '</div>'
        ),
    });
});
