define([
  'jquery',
  'underscore',
  'backbone',
  'splunkjs/mvc/searchmanager'
], function ($, _, Backbone, SearchManager) {
  'use strict';
  
  var SEARCH_QUERY = '`netops_health_search_query("$health$")` | `netops_health_rows_for_graph`';
  
  var TREND_DICT = {
    5 : { title: 'Ascending',    bonus: -20 },
    4 : { title: 'Improving',    bonus: -10 },
    3 : { title: 'Steady',       bonus:  -5 },
    2 : { title: 'Degrading',    bonus:  10 },
    1 : { title: 'Falling',      bonus:  20 },
    0 : { title: 'Undetermined', bonus:   0 }
  };

  return Backbone.Model.extend({
    initialize: function() {
      if(!this.searchManager) {
        this.searchManager = new SearchManager({
          earliest_time: '$earliest$',
          latest_time: '$latest$',
          search: SEARCH_QUERY
        }, { tokens: true});
      }

      this.searchManager.on('search:start', this.onSearchStart, this);
      this.searchManager.on('search:done', this.onSearchDone, this);
      this.searchResults = this.searchManager.data('preview', {count: 0, output_mode: 'json'})
        .on('data', this.parseData, this);
    },

    onSearchStart: function() {
      this.trigger('search:start');
    },

    onSearchDone: function(o) {
      this.trigger('search:done', o);
    },

    getWorst: function(device) {
      if(device['device_type'] === 'vds') {
        this.nodeCache[device['name']]['worst_if_name'] = 'N/A';
        this.nodeCache[device['name']]['worst_if_score'] = 'N/A';
      } else {
        var worst_if_name = "no data", worst_if_score = 101;
        
        $.each(device['children'], function(i, iface) {
          var name = iface['name'];
          var score = parseInt(iface['if_health_score']);

          if(score < worst_if_score) {
            worst_if_name = name;
            worst_if_score = score;
          }
        });

        this.nodeCache[device['name']]['worst_if_name'] = worst_if_name;
        this.nodeCache[device['name']]['worst_if_score'] = worst_if_score;
      }
    },
            
    getTrend: function(num) {
      num = parseInt(num, 10);
      if(TREND_DICT.hasOwnProperty(num)) {
        return TREND_DICT[num];
      } else {
        return TREND_DICT[0];
      }
    },
    
    calcRisk: function(health, trend) {
      if(trend === 'N/A' || health === 'N/A') {
        return 'N/A';
      }
      trend = parseInt(trend, 10);
      health = parseInt(health, 10);

      var B = this.getTrend(trend).bonus;
      return Math.pow(-1 * health, 2) * B / 2500 + health * (B - 25) / 25 + 100;
    },
     
    //This function is used to prepare JSON for d3 module in appropriate format from such syslog:
    //device=1.1.1.1 snmp_index=1 if_health_score=2 if_health_trend=3 r_load=0 bytes_out=333 bytes_in=444 packets_out=39 packets_in=27 r_rate=0 t_int=10
    parseData: function(data) {
      var that = this;
      this.json = [];
      this.nodeCache = {};
      
      data.collection().each(function(row) {
        var children = {
          'name':             row.get('if_name'),
          'snmp_index':       row.get('snmp_index'),
          'children':         [ {} ],
          'if_health_score':  row.get('if_health_score'),
          'traffic_in':       row.get('TrafficIn'),
          'traffic_out':      row.get('TrafficOut'),
          'if_health_risk':   that.calcRisk(row.get('if_health_score'), row.get('if_health_trend')),
          'packets_in':       row.get('PacketsIn'),
          'packets_out':      row.get('PacketsOut'),
          'rel_load':         row.get('latest_r_load'),
          'rel_rate':         row.get('latest_r_rate')
        };
        
        if(! _.has(that.nodeCache, row.get('device'))) {
          that.nodeCache[row.get('device')] = {
            name             : row.get('device'),
            device_type      : row.get('device_type'),
            device_type_name : that.getTypeName(row.get('device_type')),
            exp_ip_name      : row.get('exp_ip_name'),
            snmp_indexes     : [ row.get('snmp_index') ],
            ifaces_n         : row.get('ifaces_n'),
            children         : [ children ],
            type             : "i",
            dev_health_score : row.get('dev_health_score'),
            dev_health_risk  : that.calcRisk(row.get('dev_health_score'), row.get('dev_health_trend'))
          };
        } else {
          that.nodeCache[row.get('device')].snmp_indexes.push(row.get('snmp_index'));
          that.nodeCache[row.get('device')].children.push(children);
        }
      });
                
      $.each(this.nodeCache, function(i, device) { that.getWorst(device); });
                
      for(var k in this.nodeCache) { this.json.push(this.nodeCache[k]); }
      
      this.trigger('data:sync', this.json);
    },

    getTypeName: function (code) {
      var type = null;
      switch (code) {
        case 'tor': type = 'ToR'; break;
        case 'as': type = 'AS'; break;
        case 'vds': type = 'VDS'; break;
        case 'device': type = 'Device'; break;
      }
      return type;
    }

  });
});
