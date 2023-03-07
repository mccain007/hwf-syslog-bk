define([
  'jquery',
  'underscore',
  'backbone',
  'd3',

  'splunkjs/mvc',

  'modules/netops_paths/models/paths',
  './iface_details',
  'text!modules/netops_paths/templates/device_info.html',
  'text!modules/netops_paths/templates/traffic-abba.html'

], function($, _, Backbone, d3, mvc, PathModels, IfaceDetailsView, infoPanelTpl, trafficAbbaTpl) {
  'use strict';

  var NOTHING = '255.255.255.255';

  var NODE_TYPES = {
    host      : { name:    'Host', size: 14, img:    '/static/app/netflow_netops/img/host.png' },
    phost     : { name:   'pHost', size: 14, img:    '/static/app/netflow_netops/img/host.png' },
    vm_host   : { name:  'VMHost', size: 14, img: '/static/app/netflow_netops/img/vm-host.png' },
    vtep      : { name:    'VTEP', size: 14, img: '/static/app/netflow_netops/img/vm-host.png' },
    vm        : { name:      'VM', size: 14, img:      '/static/app/netflow_netops/img/vm.png' },
    vm_vxlan  : { name:'VM-VXLAN', size: 14, img:      '/static/app/netflow_netops/img/vm.png' },
    vds       : { name:     'VDS', size: 14, img:     '/static/app/netflow_netops/img/vds.png' },
    tor       : { name:     'ToR', size: 14, img:     '/static/app/netflow_netops/img/tor.png' },
    device    : { name:  'Device', size: 14, img:  '/static/app/netflow_netops/img/device.png' },
    pdevice   : { name: 'pDevice', size: 14, img:  '/static/app/netflow_netops/img/device.png' },
    as        : { name:      'AS', size: 14, img:  '/static/app/netflow_netops/img/device.png' },
    unknown   : { name: 'Unknown', size: 14, img: '/static/app/netflow_netops/img/unknown.png' },
    external  : { name:'Internet', size: 14, img:'/static/app/netflow_netops/img/external.png' }
  };

  return Backbone.View.extend({

    className: 'graph-view graph-path',

    width: Math.min(1100, Math.max(500, ($(window).width() - 420))),
    height: 520,

    color: d3.scale.category10(),

    initialize: function (data) {
      this.data = data;

      this.pathsProxy = new PathModels.PathsProxy();
      this.listenTo(this.pathsProxy, 'search:start', this.onSearchStart);
      this.listenTo(this.pathsProxy, 'search:done', this.onSearchDone);
      this.listenTo(this.pathsProxy, 'pathDataSync', this.onPathDataSync);

      this.healthProxy = new PathModels.HealthProxy();
      this.listenTo(this.healthProxy, 'healthDataSync', this.applyHealthInfo);
    },

    render: function () {
      this.pathsProxy.searchPath(this.data.src, this.data.dest, this.data.direction);

      return this;
    },

    onSearchStart: function () {
      $('*').css('cursor', 'progress');
    },

    onSearchDone: function (o) {
      $('*').css('cursor', 'auto');

      if (!o.content.resultCount) {

        if (!this.$noData) {
          this.$noData = $('<p class="no-data">No results found.</p>');
          this.$el.append(this.$noData);
        }

        this.$noData.show();
      }
    },

    onPathDataSync: function (data) {
      if (this.$noData) {
        this.$noData.hide();
      }

      this.criteria = data.criteria;
      this.nodes = data.nodes;
      this.links = data.links;
      this.paths = data.paths;

      if(this.svg) { this.svg.remove(); }
      this.svg = d3.select(this.el).append('svg')
        .attr('width', '100%')
        .attr('height', this.height)
        .attr('draggable', false)
        .on('dragstart', function () {
          d3.event.preventDefault();
          return false;
        });

      this.registerSvgDefs();

      this.draw();

      this.loadHealthData();

      this.$el.append(_.template(trafficAbbaTpl, {
        ab: this.getBytesWithUnit(data.trafficAB),
        ba: this.getBytesWithUnit(data.trafficBA),
        ab_off: (this.criteria.direction === 'backward'),
        ba_off: (this.criteria.direction === 'forward')
      }));

      return this;
    },

    getBytesWithUnit: function (bytes) {
      if (isNaN(bytes)) { return; }

      var units = [ ' bytes', ' KB', ' MB', ' GB', ' TB', ' PB', ' EB', ' ZB', ' YB' ];
      var amountOf2s = Math.floor( Math.log( +bytes )/Math.log(2) );
      if(amountOf2s < 1) {
        amountOf2s = 0;
      }
      var i = Math.floor( amountOf2s / 10 );
      bytes = +bytes / Math.pow( 2, 10*i );

      // Rounds to 2 decimals places.
      if (bytes.toString().length > bytes.toFixed(2).toString().length) {
        bytes = bytes.toFixed(2);
      }

      return bytes + units[i];
    },

    registerSvgDefs: function () {
      // Define markers
      this.svg.append('svg:defs').selectAll('marker').data([ 'forward-green', 'forward-gray', 'backward' ])
        .enter()
        .append('svg:marker')
        .attr('id', function (d) { return 'marker-' + d; })
        .attr('viewBox', function (d) {
          if (d.indexOf('forward') >= 0) {
            return '0, -10, 15, 20';
          } else {
            return '-15, -10, 15, 20';
          }
        })
        .attr('refX', function (d) { if (d.indexOf('forward') >= 0) return 10; else return -10; })
        .attr('refY', 0)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', function (d) {
          if (d.indexOf('forward') >= 0) {
            return 'M0,-10L15,0L0,10Z';
          } else {
            return 'M0,-10L-15,0L0,10Z';
          }
        })
        .style('fill', function (d) {
          if (d === 'forward-green') {
            return 'green';
          } else {
            return 'gray';
          }
        });
    },

    draw: function () {

      this.positionNodes();

      var link = this.svg.selectAll('.link').data(this.links);
      link.enter()
        .append('g')
        .attr('class', function (d) {
          return 'link ' + (d.isResolved() ? 'link-resolved' : 'link-unresolved');
        });

      var node = this.svg.selectAll('.node').data(this.nodes);
      node.enter()
        .append('g')
        .attr('class', function (d) { return d.get('node_id') + ' node'; });

      node.append('circle')
        .attr('r', 24)
        .style('fill', function (d) { return this.color(d.get('type')); }.bind(this))
        .style('fill-opacity', 0);

      node.append('text')
        .attr('dx', function (d) {
          if (d.isFirst)
            return -28;
          else
            return 28;
        })
        .attr('dy', -8)
        .attr('text-anchor', function (d) {
          if (d.isFirst)
            return 'end';
          else
            return 'start';
        })
        .text(function(d) {
          var title = d.get('title') || d.get('name');
          return this.getNodeType(d.get('type')).name + (title != NOTHING ? ' ' + title : '');
        }.bind(this));

      node.append('title')
        .text(function (d) { return d.get('name'); });

      node.append('image')
        .attr('width', 48).attr('height', 48)
        .attr('x', -24)
        .attr('y', -24)
        .attr('xlink:href', function (d) { return this.getNodeType(d.get('type')).img; }.bind(this));

      node.on('mouseover.highlight', function (d) {
        this.svg.selectAll('.link')
          .filter(function (l) {
            return l.get('source').get('name') === d.get('name') || l.get('target').get('name') === d.get('name');
          })
          .classed('highlighted', true);
      }.bind(this));

      node.on('mouseout.highlight', function (d) {
        this.svg.selectAll('.link')
          .filter(function (l) {
            return l.get('source').get('name') === d.get('name') || l.get('target').get('name') === d.get('name');
          })
          .classed('highlighted', false);
      }.bind(this));

      node.on('mousedown.dragnodes', function (d) {
        var svg = this.svg;
        var dragNode = d3.select('.' + d.get('node_id'));
        var deltaX = d.x - d3.mouse(svg[0][0])[0];
        var deltaY = d.y - d3.mouse(svg[0][0])[1];

        var links = svg.selectAll('.link')
          .filter(function (l) {
            return l.get('source').get('name') === d.get('name') || l.get('target').get('name') === d.get('name');
          });

        svg.on('mousemove.dragnodes', function () {
          d.x = d3.mouse(svg[0][0])[0] + deltaX;
          d.y = d3.mouse(svg[0][0])[1] + deltaY;
          dragNode.attr('transform', 'translate(' + d.x + ',' + d.y + ')');
          this.positionLinks(links);
        }.bind(this));

        svg.on('mouseup.dragnodes', function () {
          svg.on('mousemove.dragnodes', null);
          svg.on('mouseup.dragnodes', null);
        });

      }.bind(this));

      this.positionLinks(this.svg.selectAll('.link'));

      this.svg.selectAll('.node').data(this.nodes)
        .attr('transform', function (d) {
          return 'translate(' + d.x + ', ' + d.y + ')';
        });

    },

    positionNodes: function () {

      // sort paths by length
      this.paths.sort(function (p1, p2) {
        return p1.get('nodes').length > p2.get('nodes').length;
      });

      // set every node its X and Y coordinate
      var posited = [];
      var h = this.height;
      var l = this.width;
      var n = this.paths.length;

      var y0 = h / 2;
      var deltaY = h / (n + 2);

      var i = 0, path;
      while (path = this.paths[i++]) {

        var j = 0, node, nodes = path.get('nodes');

        var y = y0;

        var m = nodes.length;

        var deltaX = l / (m + 1);
        var x0 = deltaX;
        var res = false;

        if (path.get('backward')) { nodes.reverse(); }
        nodes[0].isFirst = true;

        while (node = nodes[j++]) {

          var x = x0;

          //console.log('pos: ', node.get('node_id'), node.get('name'), x, y);

          if (posited.indexOf(node.get('node_id')) < 0) {
            //console.log('position node');

            node.x = x;
            node.y = y;
            posited.push(node.get('node_id'));

            res = true;
          } else {
            //console.log('already positioned');
          }

          x0 = x = x0 + deltaX;

        }

        if (res) {
          y0 = y = y0 + deltaY;
          deltaY = (-1) * (deltaY + deltaY);
        }


      }
    },

    positionLinks: function (links) {
      // Bugfix for IE: remove link and render new
      links
        .each(function (d) { d.calcPositions(); })
        .select('line')
        .remove();

      links.append('line')
        .attr('marker-end', function (d) {
          if (d.isResolved()) {
            return 'url(#marker-forward-green)';
          } else {
            return 'url(#marker-forward-gray)';
          }
        })
        .attr('x1', function (d) { return d.x1; })
        .attr('y1', function (d) { return d.y1; })
        .attr('x2', function (d) { return d.x2; })
        .attr('y2', function (d) { return d.y2; }).classed('hide', true).classed('hide',false);
    },

    loadHealthData: function () {
      var devices = [];

      var arr = _.filter(this.nodes, function (node) {
        return ( node.get('type') != 'vm' && node.get('type') != 'vm_vxlan');
      }, this);

      _.each(arr, function (node) {
        devices.push('device="' + node.get('name') + '"');
      });

      //console.log('load health: ', devices);

      // device="120.1.10.80" OR device="120.1.10.81"...
      this.healthProxy.searchHealthData(devices.join(' OR '));
    },

    applyHealthInfo: function (healthData) {

      //console.log('apply health data: ', healthData);

      var nodes = this.svg.selectAll('.node').data(this.nodes)
        .filter(function (d) { return healthData.hasOwnProperty(d.get('name')); });

      nodes.select('circle')
        .style('fill', function (d) {
          return d.type == 'vds' ? 'transparent' : this.colorByHealth(healthData[d.get('name')].min_health_score);
        }.bind(this))
        .style('fill-opacity', .8);

      nodes.on('mouseover.details', function(d) {
        var data = d.toJSON();
        if (!_.isEqual(this.currData, data)) {
          this.currData = data;
          this.showInfoPanel(data, healthData[data.name]);
          this.showHealthHistory(data.name, healthData[data.name].interfaces);
        }
      }.bind(this));
      /*.on('mouseout', function(d) {
        this.hideInfoPanel();
      }.bind(this));*/

      return this;
    },

    showInfoPanel: function (data, health) {
      this.getInfoPanel().stop().hide().html(_.template(infoPanelTpl, {
        node: data,
        typeName: this.getNodeType(data.type).name,
        health: health
      })).fadeIn();
    },

    showHealthHistory: function (dev, ifaces) {
      _.each(ifaces, function (iface) {
        this.$('.health-history-' + iface.snmp_index).empty();
        new IfaceDetailsView({
          dev: dev,
          if_name: iface.snmp_if_name,
          if_index: iface.snmp_index
        }).render(this.$('.health-history-' + iface.snmp_index));
      }.bind(this));
    },

    hideInfoPanel: function () {
      this.getInfoPanel().hide();
    },

    // additional info panel to display device health details
    getInfoPanel: function () {
      if (!this.infoPanel) {
        this.infoPanel = $('<div class="netops-info-panel hidden"></div>');
        this.$el.append(this.infoPanel);
      }
      return this.infoPanel;
    },

    colorByHealth: function (health) {
      health = parseInt(health, 10);

      var color = "#ccdd82";
      if (health < 66) { color = '#fedc81'; }
      if (health < 36) { color = '#f8696b'; }
      if (isNaN(health)) { color = '#cccccc'; }

      return color;
    },

    getNodeType: function (name) {
      if (NODE_TYPES.hasOwnProperty(name)) {
        return NODE_TYPES[name];
      } else {
        return NODE_TYPES['unknown'];
      }
    }

  });

});
