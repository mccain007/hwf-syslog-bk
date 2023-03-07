define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        KV_STORE_URL: '/servicesNS/nobody/network_behavior_analytics/storage/collections/data/asocnbathreats/',

        initialize: function (options) {
            _.extend(this, _.pick(options, "restService"));
            this.data = [];
            
            this.restService.get(this.KV_STORE_URL, {query: '{"policy": true}', sort: "title"}, function(err, response) {
                if(err) {
                    this.initError();
                    this.handleRestError(err);
                } else {
                    this.data = response.data;
                    this.data.length == 0 ? this.renderNoData() : this.render();
                }
            }.bind(this));
        },

        events: {
            'click input': 'checkboxClicked'
        },

        handleRestError: function(err) {
            var message = handleRestError(err);
            this.$('div.errors').text(message);
        },

        raiseError: function(msg) {
            var err = { data: { error: msg } };
            this.handleRestError(err);
        },

        checkboxClicked: function(ev) {
            var checkbox = $(ev.currentTarget);
            checkbox.attr("disabled", true);
            this.$('div.errors').text('');

            var threatKey = checkbox.val();
            var threat = _.find(this.data, function(el){ return el._key === threatKey; });

            if(threat !== undefined) {
                var record = {
                    "name": threat.name,
                    "severity": threat.severity,
                    "title": threat.title,
                    "policy": threat.policy,
                    "show": checkbox.prop("checked")
                };

                var url = this.KV_STORE_URL + encodeURIComponent(threatKey);
                var headers = {"Content-Type": "application/json"};
                var data = JSON.stringify(record);

                this.restService.request(url, "POST", null, null, data, headers, function(err, response) {
                    if(err) {
                        this.handleRestError(err);
                        checkbox.prop('checked', !checkbox.is(':checked'));
                    }
                    checkbox.attr("disabled", false);
                }.bind(this));
            } else {
                this.raiseError("You have chosen the wrong threat. Refresh settings page and try again.");
                checkbox.prop('checked', !checkbox.is(':checked'));
                checkbox.attr("disabled", false);
            }
        },

        renderThreatsList: function() {
            var content = "";

            for (var i = 0; i < this.data.length; i++) {
                var row = this.data[i];
                var checked = row['show'] || row['show'] == undefined ? "checked" : "";
                content += this.checkboxTemplate({
                    threatKey: row['_key'],
                    checked: checked,
                    title: row['title'],
                });
            }

            var el = $('.policy-list', this.$el);
            el.html(content);
        },

        render: function() {
            this.$el.html(this.template(this));
            this.renderThreatsList();
            return this;
        },

        renderNoData: function() {
            this.$el.html(this.noDataTemplate({ messages: "Violations not found." }));
        },

        initError: function() {
            this.$el.html(this.template(this));
        },

        checkboxTemplate: _.template(
            '<div class="policy-inbox">' +
                '<input type="checkbox" value="<%= threatKey %>" <%= checked %> />' +
                '<span><%= title %></span>' +
            '</div>'
        ),

        noDataTemplate: _.template(
            '<p style="font-style: italic"><%= messages %></p>' +
            '<div class="policy-list"></div>'
        ),

        template: _.template(
            '<div class="policy-list"></div>' +
            '<div class="errors config-error"></div>'
        ),
    });
});
