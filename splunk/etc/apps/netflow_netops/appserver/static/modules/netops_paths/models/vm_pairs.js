define([
  'jquery',
  'underscore',
  'backbone',
  'd3',

  'splunkjs/mvc',
  'splunkjs/mvc/searchmanager'

], function ($, _, Backbone, d3, mvc, SearchManager) {
  'use strict';

  return Backbone.Model.extend({

    initialize: function () {

      // Coming from Health page (check values) OR not (empty values)
      // and fill tokens 'nulls' with empty string for splunk's where(%%) command
      var tokens = mvc.Components.getInstance('default');
      tokens.set('dev_ip', (tokens.get('dev_ip') || ''));
      tokens.set('dev_iface', (tokens.get('dev_iface') || ''));

      this.searchManager = new SearchManager({
        search: '`netops_path_vm_pairs("$filter_name$", "$filter_ip$", "$vtep_ip$", "$vxlan_id$", "$dev_ip$", "$dev_iface$")`',
        default: { latest_time: 'now', earliest_time: '-60m@m' },
        earliest_time: '$earliest$',
        latest_time: '$latest$',
        preview: true
      }, {
        tokens: true
      });
      this.searchManager.on('search:start', this.onSearchStart, this);
      this.searchManager.on('search:done', this.onSearchDone, this);
      this.searchManager.data('preview', {count: 0, output_mode: 'json'})
        .on('data', this.parseData, this);
    },

    onSearchStart: function () { this.trigger('search:start'); },

    onSearchDone: function (o) { this.trigger('search:done', o); },

    parseData: function (data) {
      this.data = data.collection().toJSON();
      //console.log(this.data);
      this.trigger('data:sync', this.data);
    }

  });

});
