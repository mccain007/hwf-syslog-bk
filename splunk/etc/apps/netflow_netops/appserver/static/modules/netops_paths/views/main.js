define([
  'jquery',
  'underscore',
  'backbone',
  'd3',

  'splunkjs/mvc',
  'splunkjs/mvc/messages',
  'splunkjs/mvc/progressbarview',
  'splunkjs/mvc/resultslinkview',
  'splunkjs/mvc/refreshtimeindicatorview',

  'text!modules/netops_paths/templates/layout.html',
  'modules/netops_paths/models/vm_pairs',
  './graph_koleso'

], function ($, _, Backbone, d3, mvc,
             Messages, ProgressBarView, ResultsLinkView, RefreshTimeView,
             layoutTpl, VmPairsProxy, GraphKolesoView) {
  'use strict';

  return Backbone.View.extend({

    events: {
      'click .clear-selected-device' : 'resetDeviceIfaceFilter'
    },

    initialize: function () {
      this.proxy = new VmPairsProxy();
      this.listenTo(this.proxy, 'search:start', this.onSearchStart);
      this.listenTo(this.proxy, 'search:done', this.onSearchDone);
      this.listenTo(this.proxy, 'data:sync', this.onDataSync);
    },

    render: function () {
      this.$el.html(_.template(layoutTpl, {
        deviceIP              : mvc.Components.get('default').get('dev_ip'),
        deviceIface           : mvc.Components.get('default').get('dev_iface_name')
      }));
      return this;
    },

    onSearchStart: function() {
      $('*').css('cursor', 'progress');
      this.displayMessage('waiting');
      this.showProgressBar();
    },

    onSearchDone: function(o) {
      $('*').css('cursor', 'auto');
      if(!o.content.resultCount) {
        this.displayMessage('no-results');
      }
    },

    displayMessage: function(msg) {
      Messages.render(msg, this.$('.content'));
      return this;
    },

    showProgressBar: function () {
      if (!this.progressBar) {
        this.progressBar = new ProgressBarView({
          el: this.$('.progress-container'),
          managerid: this.proxy.searchManager.id
        });
      }
    },

    showResultsLink: function() {
      if(!this.resultsLink) {
        this.resultsLink = new ResultsLinkView({
          el: this.$('.view-results'),
          manager: this.proxy.searchManager.id
        }).render();
      }
    },

    showRefreshTime: function() {
      if(!this.refreshTime) {
        this.refreshTime = new RefreshTimeView({
          el: this.$('.refresh-time-indicator'),
          manager: this.proxy.searchManager.id,
          'refresh.time.visible': true
        }).render();
      }
    },

    onDataSync: function (data) {
      this.showResultsLink();
      this.showRefreshTime();

      if(this.kolesoView) { this.kolesoView.remove(); }

      this.kolesoView = new GraphKolesoView(data, this.proxy);
      this.$('.content').html(this.kolesoView.render().el);
    },

    resetDeviceIfaceFilter: function () {
      var tokens = mvc.Components.get('default');
      tokens.set('dev_ip', '');
      tokens.set('dev_iface', '');
      tokens.set('dev_iface_name', '');
      tokens.trigger('change:dev_ip');

      this.$('.selected-device-iface').empty(); // addClass('hide');
    }

  });

});
