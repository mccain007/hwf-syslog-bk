define([
  'jquery',
  'underscore',
  'backbone',
  'd3',

  'splunkjs/mvc',
  'splunkjs/mvc/searchmanager',
  'splunkjs/mvc/singleview'

], function($, _, Backbone, d3, mvc, SearchManager, SingleView) {
  'use strict';

  return Backbone.View.extend({

    initialize: function (data) {
      this.data = data;
      this.managerId = _.uniqueId('hh_manager_');
      var tokens = mvc.Components.getInstance('default');

      new SearchManager({
        id: this.managerId,
        earliest_time: tokens.get('earliest'),
        latest_time: tokens.get('latest'),
        search: '`netflow_search_rule_20181` device="' + data.dev +
          '" snmp_ifName="' + data.if_name +
          '" | timechart avg(if_health_score) as avg_health_score span=1m  | fillnull value=100 avg_health_score'
      });
    },

    render: function (target) {

      new SingleView({
        managerid: this.managerId,
        el: target,
        //title: 'Health score',
        beforeLabel: 'Health score',
        //underLabel: 'trend compared to last hour',
        field: 'avg_health_score',
        showSparkline: true,
        showTrendIndicator: true,
        trendDisplayMode: 'absolute',
        //trendInterval: '1h',
        numberPrecision: '0',
        trendColorInterpretation: 'inverse',
        rangeColors: [ 0x0E31EB, 0x6db7c6, 0xf7bc38, 0xf58f39, 0xd93f3c ],
        //TODO: rangeValues: [ 0-35, 36-65, 66-100 ],
        colorMode: 'block',
        colorBy: 'value',
        useColors: false,
        height: 60
      });

      return this;
    }

  });

});