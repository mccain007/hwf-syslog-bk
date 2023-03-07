define([
  'jquery',
  'underscore',
  'backbone',
  'd3',

  'splunkjs/mvc',

  'modules/netops_paths/models/red_wheel',
  'modules/netops_paths/views/vm_pairs',
  'text!modules/netops_paths/templates/graph_koleso.html'

], function($, _, Backbone, d3, mvc, RedWheelProxy, VmPairsView, graphKolesoTpl) {
  'use strict';

  var UNKNOWN = 'unknown';
  var IP_OF_NOTHING = '255.255.255.255';

  return Backbone.View.extend({

    className: 'graph-view graph-view-koleso',

    map: null,

    events: {
      'change .max-device-health-control'       : 'changeMaxDeviceHealth',
      'input .max-device-health-control'        : 'inputMaxDeviceHealth',
      'change .highlight-affected-vms-control'  : 'changeHighlightAffectedVMs'
    },

    initialize: function (data, proxy) {
      this.data = data;
      this.proxy = proxy;
      
      this.maxResults = 5;
      this.totalResults = 0;
      this.displayedResults = [];
      this.displayedPairs = [];

      this.deviceHealth = 65;
      this.highlightAffectedVMs = true;

      var d = 615;
      this.graphSettings = {
        diameter    : d,
        width       : d,
        height      : d,
        radius      : d / 2,
        innerRadius : d / 2 - 120
      };

      this.bundle = d3.layout.bundle();

      this.line = d3.svg.line.radial()
        .interpolate("bundle")
        .tension(.85)
        .radius(function(d) { return d.y; })
        .angle(function(d) { return d.x / 180 * Math.PI; });

      this.cluster = d3.layout.cluster()
        .size([ 360, this.graphSettings.innerRadius ])
        .sort(null)
        .value(function(d) { return d.size; });

      this.highlightedVMs = [];

      this.redWheelProxy = new RedWheelProxy();
      this.listenTo(this.redWheelProxy, 'search:start', this.onRedWheelSearchStart);
      this.listenTo(this.redWheelProxy, 'search:done', this.onRedWheelSearchDone);
      this.listenTo(this.redWheelProxy, 'searchSync', this.onRedWheelSearchSync);
      this.redWheelProxy.search(this.deviceHealth);
    },

    render: function () {
      this.initTotalDisplayedResults();

      this.$el.html(_.template(graphKolesoTpl, {
        graphSettings         : this.graphSettings,
        totalResults          : this.totalResults.length,
        displayedResults      : this.displayedResults.length,
        deviceHealth          : this.deviceHealth,
        deviceIP              : mvc.Components.get('default').get('dev_ip'),
        deviceIface           : mvc.Components.get('default').get('dev_iface_name'),
        highlightAffectedVMs  : this.highlightAffectedVMs
      }));

      this.div = d3.select(this.$('.svg-holder')[0]);

      this.loadGraphData();

      // If src VM already selected (passed via URL), then should go to path
      var srcVm = mvc.Components.get('default').get('src_vm');
      if (srcVm) {

        // Reset selected VM since it should be called once
        mvc.Components.get('default').unset('src_vm');

        // Use timer to break current ("render") call chain
        var to = setTimeout(function () {
          clearTimeout(to);
          this.autoSelectSrcVm(srcVm);
        }.bind(this), 1);

      }

      return this;
    },

    initTotalDisplayedResults: function () {
      this.totalResults = this.getTotalResults();
      this.displayedResults = this.totalResults.slice(0, Math.min(this.totalResults.length, this.maxResults));
      this.displayedPairs = [];

      this.data.forEach(function (p) {
        if (this.displayedResults.indexOf(p.src_ip) >= 0 ||
          this.displayedResults.indexOf(p.dest_ip) >= 0)
        {
          this.displayedPairs.push(p);
        }
      }.bind(this));
    },

    getTotalResults: function () {
      var res = [];

      var add = function (ip) {
        if(res.indexOf(ip) < 0) {
          res.push(ip);
        }
      };

      this.data.forEach(function (p) {
        add(p.src_ip);
        add(p.dest_ip);
      }.bind(this));

      return res;
    },

    loadGraphData: function () {
      this.graphData = this.displayedPairs;

      this.map = { '': { name: '', data: null, children: [], targets: [] } };

      this.nodes = this.cluster.nodes(this.packageNodes(this.graphData));
      this.links = this.packageLinks(this.nodes);

      // clear and remove old svg (if presented)

      this.$('svg').remove();

      var d = this.graphSettings.diameter;
      var r = this.graphSettings.radius;

      this.svg = this.div.append('svg')
        .attr("width", d)
        .attr("height", d)
        .attr('draggable', false)
        .on('dragstart', function () {
          d3.event.preventDefault();
          return false;
        })
        .append("g")
        .attr("transform", "translate(" + r + "," + r + ")");

      this.svg.selectAll(".circle")
        .data([ r ])
        .enter()
        .append('circle')
        .attr('r', Number).attr('x', Number).attr('y', Number)
        .style('fill', '#ffffff').style('cursor', 'move')
        .on('mousedown', function (d) { this.onMousedown(d); }.bind(this));

      this.svg.selectAll(".link")
        .data(this.bundle(this.links))
        .enter().append("path")
        .attr("class", "link ")
        .attr("d", this.line)
        .style('stroke-width', function (d) {
          return this.calcWidth(d[0].data.total_bytes);
        }.bind(this));

      var g = this.svg.selectAll(".node")
        .data(this.nodes) // .filter(function(d) { return !d.children; })
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; });
      g.append('title').text(function (d) { return d.name; });
      g.append("text")
        .attr("dx", function(d) { return d.x < 180 ? 8 : -8; })
        .attr("dy", ".31em")
        .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; })
        .text(function(d) {
          var title = d.title || d.name;
          if (title) {
            if (d.type === 'vm') {
              return 'VM ' + title;
            } else
            if (d.type === 'vm_vxlan') {
              return 'VM-VXLAN ' + title;
            } else {
              return title;
            }
          }
          return null;
        })
        .on('mouseover', function (d) { this.onMouseover(d); }.bind(this))
        .on('mouseout', function (d) { this.onMouseout(d); }.bind(this))
        .on('click', function (d) { this.selectVm(d); }.bind(this));
    },

    mouse: function (e) {
      this.rect = this.rect || this.$('.static-cont').offset();

      return [ e.pageX - this.graphSettings.radius - this.rect.left,
               e.pageY - this.graphSettings.radius - this.rect.top ];
    },

    onMousedown: function (d) {
      this.p0 = this.mouse(d3.event);

      d3.select(window)
        .on('mousemove', function () { this.onMousemove(); }.bind(this))
        .on('mouseup', function () { this.onMouseup(); }.bind(this));
    },

    onMousemove: function () {
      this.p1 = this.mouse(d3.event);

      var dm = Math.atan2(this.cross(this.p0, this.p1), this.dot(this.p0, this.p1)) * 180 / Math.PI;

      this.div.style("transform", "rotateZ(" + dm + "deg)");
    },

    rotation: 0,

    onMouseup: function () {
      this.p1 = this.mouse(d3.event);

      var dm = Math.atan2(this.cross(this.p0, this.p1), this.dot(this.p0, this.p1)) * 180 / Math.PI;

      this.div.style("transform", null);

      this.rotation += dm;

      if (this.rotation > 360)
        this.rotation -= 360;
      else if (this.rotation < 0)
        this.rotation += 360;

      var rotate = this.rotation;
      var transform = "translate(" + [
        this.graphSettings.radius,
        this.graphSettings.radius
      ].join(",") + ")rotate(" + rotate + ")";

      this.svg.attr("transform", transform)
        .selectAll("g.node text")
        .attr("dx", function(d) { return (d.x + rotate) % 360 < 180 ? 8 : -8; })
        .attr("text-anchor", function(d) { return (d.x + rotate) % 360 < 180 ? "start" : "end"; })
        .attr("transform", function(d) { return (d.x + rotate) % 360 < 180 ? null : "rotate(180)"; });

      d3.select(window)
        .on('mousemove', null)
        .on('mouseup', null);
    },

    cross: function (a, b) {
      return a[0] * b[1] - a[1] * b[0];
    },

    dot: function (a, b) {
      return a[0] * b[0] + a[1] * b[1];
    },

    onMouseover: function (node) {
      this.svg.selectAll('.node')
        .classed('faded', true)
        .classed('highlighted', function (d) {
          return node.targets ? (node.name == d.name || node.targets.indexOf(d.name) >= 0) : false;
        });

      this.svg.selectAll('.link').data(this.links)
        .classed('faded', true)
        .classed('highlighted', function (d) {
          return node.targets ? (d.source.name == node.name && node.targets.indexOf(d.target.name) >= 0) : false;
        });
    },

    onMouseout: function (node) {
      this.svg.selectAll('.node').classed('highlighted', false).classed('faded', false);
      this.svg.selectAll('.link').classed('highlighted', false).classed('faded', false);
    },

    packageNodes: function (records) {

      records.forEach(function(d) {
        this.registerNodes(d);
      }.bind(this));

      //console.log(this.map);

      return this.map[''];
    },

    registerNodes: function (d) {
      if (d.src_vhost_ip === IP_OF_NOTHING) d.src_vhost_ip = '';
      if (d.dest_vhost_ip === IP_OF_NOTHING) d.dest_vhost_ip = '';

      if (d.src_vm_name === UNKNOWN) d.src_vm_name = '';
      if (d.dest_vm_name === UNKNOWN) d.dest_vm_name = '';
      if (d.src_name === UNKNOWN) d.src_name = '';
      if (d.dest_name === UNKNOWN) d.dest_name = '';
	  if (d.src_vhost_name === UNKNOWN) d.src_vhost_name = '';
      if (d.dest_vhost_name === UNKNOWN) d.dest_vhost_name = '';

      // register hosts of VMs (src and dest)
      if (!this.map.hasOwnProperty(d.src_vhost_ip)) {
        this.map[d.src_vhost_ip] = { name: d.src_vhost_ip, type: 'vm_host', title: d.src_vhost_name, data: d, children: [ {} ], targets: [] };
        this.map[''].children.push(this.map[d.src_vhost_ip]);
      }
      if (!this.map.hasOwnProperty(d.dest_vhost_ip)) {
        this.map[d.dest_vhost_ip] = { name: d.dest_vhost_ip, type: 'vm_host', title: d.dest_vhost_name, data: d, children: [ {} ], targets: [] };
        this.map[''].children.push(this.map[d.dest_vhost_ip]);
      }

      // register VMs (src and dest) and attach to its registered hosts
      if (!this.map.hasOwnProperty(d.src_ip)) {
        this.map[d.src_ip] = { name: d.src_ip, type: d.src_type, title: d.src_name, data: d, children: [], targets: [] };
        if (d.src_type !== 'vm' && d.src_type !== 'vm_vxlan') {
          this.map[d.src_ip].children.push({});
        } else {
          this.map[d.src_ip].title = d.src_vm_name;
        }
        this.map[d.src_vhost_ip].children.push(this.map[d.src_ip]);
      }
      if (!this.map.hasOwnProperty(d.dest_ip)) {
        this.map[d.dest_ip] = { name: d.dest_ip, type: d.dest_type, title: d.dest_name, data: d, children: [], targets: [] };
        if (d.dest_type !== 'vm' && d.dest_type !== 'vm_vxlan') {
          this.map[d.dest_ip].children.push({});
        } else {
          this.map[d.dest_ip].title = d.dest_vm_name;
        }
        this.map[d.dest_vhost_ip].children.push(this.map[d.dest_ip]);
      }

      // add connection (src -> dest) to array of targets (will be used to register links)
      if (this.map[d.src_ip].targets.indexOf(this.map[d.dest_ip].name) < 0) {
        this.map[d.src_ip].targets.push(this.map[d.dest_ip].name);
        this.map[d.src_ip].targets.sort();
      }
    },

    packageLinks: function (nodes) {
      var links = [];

      nodes.forEach(function(d) {

        if (d.targets) {
          d.targets.forEach(function(i) {
            links.push({source: this.map[d.name], target: this.map[i]});
          }.bind(this));
        }

      }.bind(this));

      return links;
    },

    autoSelectSrcVm: function (srcVm) {
      if (this.map.hasOwnProperty(srcVm)) {
        this.selectVm(this.map[srcVm]);
      }
    },

    selectVm: function (node) {
      if (this.vmPairsView) {
        this.vmPairsView.off('wheel:restartSearch');
        this.vmPairsView.remove();
      }

      if (node.targets && node.targets.length > 0) {
        this.vmPairsView = new VmPairsView(node, this.map);
        this.vmPairsView.on('wheel:restartSearch', function () { this.proxy.searchManager.startSearch(); }, this);
        this.$el.prepend(this.vmPairsView.render().el);
      }
    },

    calcWidth: function (num) {
      var gb = Math.pow(1024, 3);
      var mb = Math.pow(1024, 2);
      return (num > mb) ? ( (num > gb) ? 8 : 4 ) : 1;
    },

    /********************************
     * Red Wheel part
     */
    onRedWheelSearchStart: function () {
      this.highlightedVMs = [];
      this.svg.selectAll('.node').classed('red-node', false);

      $('*').css('cursor', 'progress');

      this.$('.affected-vms-total').addClass('hide');
    },

    onRedWheelSearchDone: function (/*o*/) {
      $('*').css('cursor', 'auto');
    },

    onRedWheelSearchSync: function (data) {
      //console.log('onRedWheelSearchSync: ', data);
      this.highlightedVMs = data;
      this.changeHighlightAffectedVMs();


      this.$('.affected-vms-total .number').html(this.highlightedVMs.length);
      this.$('.affected-vms-total').removeClass('hide');
    },

    inputMaxDeviceHealth: function () {
      this.$('.max-device-health-value').html(this.$('.max-device-health-control').val());
    },

    changeMaxDeviceHealth: function () {
      this.deviceHealth = this.$('.max-device-health-control').val();

      this.$('.max-device-health-value').html(this.deviceHealth);

      this.redWheelProxy.search(this.deviceHealth);
    },

    changeHighlightAffectedVMs: function () {
      this.highlightAffectedVMs = this.$('.highlight-affected-vms-control').prop('checked');

      if (this.highlightAffectedVMs) {
        this.svg.selectAll('.node')
          .filter(function (d) { return this.highlightedVMs.indexOf(d.name) >= 0; }.bind(this))
          .classed('red-node', true);
      } else {
        this.svg.selectAll('.node').classed('red-node', false);
      }
    }

  });

});
