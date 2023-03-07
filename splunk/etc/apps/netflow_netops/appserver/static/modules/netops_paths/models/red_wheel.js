define([
  'jquery',
  'underscore',
  'backbone',

  'splunkjs/mvc',
  'splunkjs/mvc/searchmanager'

], function($, _, Backbone, mvc, SearchManager) {
  'use strict';

  var SEARCH_VMS_BY_HEALTH = '`netops_path_vms_affected_by_health($filter_health$, "$dev_ip$", $dev_iface$)`';

  return Backbone.Model.extend({

    getSearchManager: function () {
      if (!this._searchManager) {
        this._searchManager = new SearchManager({
          search: mvc.tokenSafe(SEARCH_VMS_BY_HEALTH),
          default: { "latest_time": "now", "earliest_time": "-60m@m" },
          autostart: false
        }, {
          tokens: true
        });
        this._searchManager.on('search:start', this.onSearchStart, this);
        this._searchManager.on('search:done', this.onSearchDone, this);
        this._searchManager.data('results', {count: 0, output_mode: 'json'})
          .on('data', this.parseData, this);
      }
      return this._searchManager;
    },

    /**
     * Tokens:
     *  (standart timepicker) $earliest$ = -60m@m
     *  (standart timepicker) $latest$ = now
     *  (url) $dev_ip$
     *  (url) $dev_iface$
     *  $filter_health$
     */
    search: function (filter_health) {
      var tokens = mvc.Components.getInstance('default');
      tokens.set('filter_health', filter_health);

      var sm = this.getSearchManager();

      sm.set('earliest_time', tokens.get('earliest'));
      sm.set('latest_time', tokens.get('latest'));

      sm.startSearch();
    },

    onSearchStart: function () {
      this.trigger('search:start');
    },

    onSearchDone: function (o) {
      this.trigger('search:done', o);
    },

    parseData: function (data) {
      this.data = data.collection().toJSON();
      var plain = [];
      this.data.forEach(function (d) {
        plain.push(d.search)
      });
      this.trigger('searchSync', plain);
    }

  });

});
