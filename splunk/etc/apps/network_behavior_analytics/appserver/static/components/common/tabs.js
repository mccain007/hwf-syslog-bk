define([
    'underscore',
    'jquery',
    'backbone',
    'nba/components/common/handleresterror',
], function(_, $, Backbone, handleRestError) {
    return Backbone.View.extend({
        REST_URL: '/network_behavior_analytics/data/status',

        initialize: function(options) {
            _.extend(this, _.pick(options, "restService", "tabs", "dataLocation"));
            this.active = null;
        },

        events: {
            'click .tabs-nav-item': 'tabClicked',
        },

        handleRestError: function(err) {
            handleRestError(err);
        },

        tabClicked: function(ev) {
            var tabEl = $(ev.currentTarget);
            for (var i = 0; i < this.tabs.length; i++) {
                var tab = this.tabs[i];
                if (tab.id === tabEl.attr('id')) {
                    this.activateTab(tab, false);
                }
            }
        },

        initTab: function() {
            var tab = this.tabs[0];
            this.activateTab(tab, true);
        },

        activateTab: function(tab, init) {
            if (tab == undefined) {
                return;
            }

            if(!init && this.active !== null && tab.id == this.active.id) {
                return;
            }

            if (this.active !== null) {
                this.active.hide();
            }
            this.active = tab;

            $('.tabs-nav-item', this.$el).removeClass('active');
            $('#' + tab.id, this.$el).addClass('active');
            
            tab.render().refresh();
            if (this.dataLocation) {
                this.refreshTabStatus();
            }
        },

        refreshTabStatus: function() {
            this.restService.get(this.REST_URL, {mode: "notify"}, function(err, response) {
                var sections = [];

                if (err) {
                    this.handleRestError(err);
                } else {
                    sections = response.data.sections;
                }

                this.renderTabsStatus(sections);
            }.bind(this));
        },

        refreshGroup: function(groupName) {
            for (var i = 0; i < this.tabs.length; i++) {
                var tab = this.tabs[i];
                if (tab.refreshGroup) {
                    tab.refreshGroup(groupName);
                }
            }
            this.initTab();
        },

        renderTabsStatus: function(sections) {
            for (var i = 0; i < this.tabs.length; i++) {
                var tab = this.tabs[i];

                var tabLink = $('#' + tab.id + ' .tabs-nav-title', this.$el);
                var tabLinkIcon = $('.icon-error', tabLink);

                if (_.contains(sections, tab.id)) {
                    if (tabLinkIcon.length == 0) {
                        tabLink.prepend('<span class="data-nav-icon icon-error"></span>');
                    }
                } else {
                    tabLinkIcon.remove();
                }
            }
        },

        renderTabs: function (entries) {
            var body = "";
            for (var i = 0; i < this.tabs.length; i++) {
                var tab = this.tabs[i];
                body += this.templateTab({ id: tab.id, title: tab.title });
            }

            var el = $('.tabs-nav', this.$el);
            el.html(body);
        },

        render: function() {
            this.$el.html(this.template(this));
            this.renderTabs();

            if (this.dataLocation) {
                this.initTab();
            }

            return this;
        },

        templateTab: _.template(
            '<div id="<%= id %>" class="tabs-nav-item">' +
                '<div class="tabs-nav-title"><%= title %></div>' +
            '</div>'
        ),

        template: _.template(
            '<div class="tabs-nav"></div>'
        ),
    });
});
