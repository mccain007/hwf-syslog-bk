define([
  'underscore',
  'jquery',
  'backbone',
  'splunkjs/mvc',
  'splunkjs/mvc/progressbarview',
  'splunkjs/mvc/messages',
  'splunkjs/mvc/resultslinkview',
  'splunkjs/mvc/refreshtimeindicatorview',
  'text!modules/netops_health/templates/layout.html',
  'modules/netops_health/models/devices-ifaces',
  'modules/netops_health/views/devices-ifaces',
  'common/drilldown_tree_node'
], function(_, $, Backbone, mvc, ProgressBarView, Messages, ResultsLinkView, RefreshTimeView, layoutTpl, DevIfacesProxy, DevIfacesView, DrilldownTreeNode) {
  'use strict';
    
  return Backbone.View.extend({

    initialize: function() {
      this.proxy = new DevIfacesProxy();
      
      this.listenTo(this.proxy, 'search:start', this.onSearchStart);
      this.listenTo(this.proxy, 'search:done', this.onSearchDone);
      this.listenTo(this.proxy, 'data:sync', this.onDataSync);
      
      //Initializing common drilldown component
      var chart_2_1 = new DrilldownTreeNode({ 'id': 'chart_2_1' });
 	 	 	var chart_2_2 = new DrilldownTreeNode({ 'id': 'chart_2_2' });
 	 	 	var chart_2_3 = new DrilldownTreeNode({ 'id': 'chart_2_3' });
 	 	 	
 	 	 	var mainGraph = new DrilldownTreeNode({ 'id': 'mainGraph', 'children': [chart_2_1, chart_2_2, chart_2_3], 'token': 'Exporter/Interface' });
    },

    render: function() {
      this.$el.html(_.template(layoutTpl));
      return this;
    },

    onSearchStart: function() {
      $('*').css('cursor', 'progress');
      this.displayMessage('waiting');
      this.showProgressBar();

      var tokens = mvc.Components.get('default');
      var currentExporter = tokens.get('Exporter/Interface');
      if (currentExporter) {
        tokens.set('Exporter/Interface', '');
        //tokens.trigger('change:Exporter/Interface');
      }
    },

    onSearchDone: function(o) {
      $('*').css('cursor', 'auto');
      if(!o.content.resultCount) { this.displayMessage('no-results'); }
    },

    displayMessage: function(msg) {
      Messages.render(msg, this.$('.netops-health-graph'));
      return this;
    },

    showProgressBar: function() {
      if(!this.progressBar) {
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

    onDataSync: function(data) {
      this.showResultsLink();
      this.showRefreshTime();
      
      this.$('.netops-health-graph').html(this.newTreeView(data).render().el);
    },

    newTreeView: function(data) {
      if(this.treeView) {
        this.treeView.undelegateEvents();
        this.treeView.remove();
      }

      this.treeView = new DevIfacesView(data);

      return this.treeView;
    }
  });
});
