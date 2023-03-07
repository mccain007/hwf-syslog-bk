define([
  'jquery',
  'underscore',
  'backbone',

  'splunkjs/mvc',
  'splunkjs/mvc/searchmanager'

], function($, _, Backbone, mvc, SearchManager) {
  'use strict';

  var Node = Backbone.Model.extend({

    defaults: {
      node_id     : null,
      type        : null,
      name        : null,
      title       : null,
      if_in       : [],
      if_out      : []
    },

    initialize: function (data) {
      if (data.node_id) {
        this.set('node_id', 'n_' + data.node_id);
      } else {
        this.set('node_id', _.uniqueId('n_'));
      }

      if (!_.isArray(data.if_in)) {
        this.set('if_in', [ data.if_in ]);
      }

      if (!_.isArray(data.if_out)) {
        this.set('if_out', [ data.if_out ]);
      }

      if (this.isExternalAddress(this.get('name'))) {
        this.set('type', 'external');
      }

      if (this.get('type') === 'vds') {
        this.set('name', this.get('name') + ' (VDS)');
      }

      if (this.get('title') === 'unknown') {
        this.set('title', '');
      }
    },

    isPhysical: function () {
      var type = this.get('type');
      return !(type === 'vm' || type === 'vm_vxlan' || type === 'vds');
    },

    isExternalAddress: function (ipv4) {
      var reason = null;
      var a = ipv4.split('.').map(function(s){ return parseInt(s, 10); });

      if (!a || a.length !== 4) {
        throw 'Invalid IPv4 address';
      }

      // test 0.0.0.0 - 0.255.255.255 (0.0.0.0/8)
      if (a[0] === 0) {
        reason = 'Used for broadcast messages to the current ("this") network as specified by RFC 1700, page 4.';
      }

      // test 10.0.0.0 - 10.255.255.255 (10.0.0.0/8)
      if (a[0] === 10) {
        reason =  'Used for local communications within a private network as specified by RFC 1918.';
      }

      // test 100.64.0.0 - 100.127.255.255 (100.64.0.0/10)
      if (a[0] === 100 && a[1] >= 64 && a[1] <= 127) {
        reason =  'Used for communications between a service provider and its subscribers when using a Carrier-grade NAT, as specified by RFC 6598.';
      }

      // test 127.0.0.0 - 127.255.255.255 (127.0.0.0/8)
      if (a[0] === 127) {
        reason =  'Used for loopback addresses to the local host, as specified by RFC 990.';
      }

      // test 169.254.0.0 - 169.254.255.255 (169.254.0.0/16)
      if (a[0] === 169 && a[1] === 254) {
        reason =  'Used for link-local addresses between two hosts on a single link when no IP address is otherwise specified, such as would have normally been retrieved from a DHCP server, as specified by RFC 3927.';
      }

      // test 172.16.0.0 - 172.31.255.255 (172.16.0.0/12)
      if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) {
        reason =  'Used for local communications within a private network as specified by RFC 1918.';
      }

      // test 192.0.0.0 - 192.0.0.255 (192.0.0.0/24)
      if (a[0] === 192 && a[1] === 0 && a[2] === 0) {
        reason =  'Used for the IANA IPv4 Special Purpose Address Registry as specified by RFC 5736.';
      }

      // test 192.0.2.0 - 192.0.2.255 (192.0.2.0/24)
      if (a[0] === 192 && a[1] === 0 && a[2] === 2) {
        reason =  'Assigned as "TEST-NET" in RFC 5737 for use solely in documentation and example source code and should not be used publicly.';
      }

      // test 192.88.99.0 - 192.88.99.255 (192.88.99.0/24)
      if (a[0] === 192 && a[1] === 88 && a[2] === 99) {
        reason =  'Used by 6to4 anycast relays as specified by RFC 3068.';
      }

      // test 192.168.0.0 - 192.168.255.255 (192.168.0.0/16)
      if (a[0] === 192 && a[1] === 168) {
        reason =  'Used for local communications within a private network as specified by RFC 1918.';
      }

      // test 198.18.0.0 - 198.19.255.255 (198.18.0.0/15)
      if (a[0] === 198 && a[1] >= 18 && a[1] <= 19) {
        reason =  'Used for testing of inter-network communications between two separate subnets as specified in RFC 2544.';
      }

      // test 198.51.100.0 - 198.51.100.255 (198.51.100.0/24)
      if (a[0] === 198 && a[1] === 51 && a[2] === 100) {
        reason =  'Assigned as "TEST-NET-2" in RFC 5737 for use solely in documentation and example source code and should not be used publicly.';
      }

      // test 203.0.113.0 - 203.0.113.255 (203.0.113.0/24)
      if (a[0] === 203 && a[1] === 0 && a[2] === 113) {
        reason =  'Assigned as "TEST-NET-3" in RFC 5737 for use solely in documentation and example source code and should not be used publicly.';
      }

      // test 224.0.0.0 - 239.255.255.255 (224.0.0.0/4)
      if (a[0] >= 224 && a[0] <= 239) {
        reason =  'Reserved for multicast assignments as specified in RFC 5771. 233.252.0.0/24 is assigned as "MCAST-TEST-NET" for use solely in documentation and example source code.';
      }

      // test 240.0.0.0 - 255.255.255.254 (240.0.0.0/4)
      if (a[0] >= 240 && a[0] <= 255 && a[3] <= 254) {
        reason =  'Reserved for future use, as specified by RFC 6890.';
      }

      // test 255.255.255.255 (255.255.255.255/32)
      if (a[0] === 255 && a[1] === 255 && a[2] === 255 && a[3] === 255) {
        reason =  'Reserved for the "limited broadcast" destination address, as specified by RFC 6890.';
      }

      //console.log(ipv4, 'is a reserved:', reason);
      return !reason;
    }

  });

  var Link = Backbone.Model.extend({

    defaults: {
      source: null,
      target: null,
      resolved: true
    },

    isResolved: function () {
      var src = this.get('source'), dst = this.get('target');
      var srcType = src.get('type'), dstType = dst.get('type');

      // Special case "VM-HOST <-> VM-HOST" always not resolved
      if (srcType === 'vm_host' && dstType === 'vm_host') {
        return false;
      }

      // Special case "VM <-> VM-HOST" always resolved
      if (((srcType === 'vm' || srcType === 'vm_vxlan') && dstType === 'vm_host') ||
          ((dstType === 'vm' || dstType === 'vm_vxlan') && srcType === 'vm_host')) {
        return true;
      }

      // Special case "any <-> external" always unresolved
      if (srcType === 'external' || dstType === 'external') {
        return false;
      }

      // IMPORTANT: commented due to wrong behavior. Should not be always resolved
      // Special case "any <-> phost" always resolved
      //if (srcType === 'phost' || dstType === 'phost') { return true; }

      // Special case "any <-> vtep" always resolved
      //if (srcType === 'vtep' || dstType === 'vtep') { return true; }

      return this.get('resolved');
    },

    calcPositions: function () {
      var r = 28;

      var nx1 = this.get('source').x;
      var ny1 = this.get('source').y;
      var nx2 = this.get('target').x;
      var ny2 = this.get('target').y;

      var dnx = nx2 - nx1;
      var dny = ny2 - ny1;

      if (dnx === 0 && dny === 0) {
        this.x1 = this.x2 = this.get('source').x;
        this.y1 = this.y2 = this.get('source').y;
      } else {

        var alfa = Math.atan(dny / dnx);

        if (dnx < 0) {
          alfa += Math.PI;
        }

        var beta = alfa - Math.PI;

        var delta = 0.08;
        //if (alfa < 0) delta = -delta;
        alfa += delta; beta += -delta;

        this.x1 = nx1 + r * Math.cos(alfa);
        this.y1 = ny1 + r * Math.sin(alfa);

        this.x2 = nx2 + r * Math.cos(beta);
        this.y2 = ny2 + r * Math.sin(beta);
      }
    }

  });

  var Path = Backbone.Model.extend({

    defaults: {
      nodes       : [],
      hops        : [],
      resolved    : true,
      backward    : false,
      src         : null,
      srcHost     : null,
      dst         : null,
      dstHost     : null
    },

    initialize: function (data) {

      if (!_.isBoolean(data.resolved)) {
        this.set('resolved', data.resolved === 'T');
      }

      if (!_.isBoolean(data.backward)) {
        this.set('backward', data.backward === 'backward');
      }

      this.set('nodes', []);
      this.set('hops', []);

    },

    appendNode: function (node, role) {
      //console.log('appendNode: ', node.get('name'), role);

      switch (role) {
        case 'src'      : this.set('src', node); break;
        case 'srcHost'  : this.set('srcHost', node); break;
        case 'dst'      : this.set('dst', node); break;
        case 'dstHost'  : this.set('dstHost', node); break;
      }


      if (!_.find(this.get('nodes'), function (m) { return m.get('name') === node.get('name'); })) {

        //console.log('welcome new node in path!');

        if (role === 'hop') {
          this.get('hops').push(node);
        }

        this.get('nodes').push(node);
      }
    },

    isSubset: function (targetPath) {
      // forward and backward should be analysed differently
      if (this.get('backward') !== targetPath.get('backward')) return false;

      //console.log('isSubset:', this, targetPath);

      // paths with different src or dst hosts should be different
      if (this.get('srcHost') &&
        (!targetPath.get('srcHost') || !_.isEqual(this.get('srcHost').toJSON(), targetPath.get('srcHost').toJSON())))
        return false;

      if (this.get('dstHost') &&
        (!targetPath.get('dstHost') || !_.isEqual(this.get('dstHost').toJSON(), targetPath.get('dstHost').toJSON())))
        return false;

      var result = true;
      var subset = this.get('hops');
      var target = targetPath.get('hops');

      for (var i = 0, len = subset.length; i < len; i++) {
        var check = subset[i];
        var index = _.indexOf(target, check);

        if (index < 0) {
          result = false;
          break;
        } else {

          //
          // Situation 1:
          // a b c
          // a b c d
          //
          // Situation 2:
          // a b c d e
          // e d c b a
          //
          // TODO: possible situation? is path resolved?
          // a b c d
          // a b c e d
          //
          // TODO: possible situation? is path resolved?
          // a b c d e
          // a b d c e
          //
          if (_.has(target, index - 1) && _.has(subset, i - 1)) {
            if (!_.isEqual(target[index - 1].toJSON(), subset[i - 1].toJSON())) {
              result = false;
              break;
            }
          }

          if (_.has(target, index + 1) && _.has(subset, i + 1)) {
            if (!_.isEqual(target[index + 1].toJSON(), subset[i + 1].toJSON())) {
              result = false;
              break;
            }
          }
        }
      }

      return result;
    },

    isPhysical: function () {
      var node, i = 0, nodes = this.get('nodes');
      while (node = nodes[i++]) {
        if (node.isPhysical()) {
          return true;
        }
      }
      return false;
    }

  });

  var PathsProxy =  Backbone.Model.extend({

    SEARCH_PATH_QUERY: '`netops_path_mono_directed("$src_ip$", "$dest_ip$", "$direction$")`',

    SEARCH_BI_DIRECTED_PATH_QUERY: '`netops_path_bi_directed("$src_ip$", "$dest_ip$")`',

    IP_OF_NOTHING: '255.255.255.255',

    getPathSearchManager: function () {
      if (!this._pathSearchManager) {
        this._pathSearchManager = new SearchManager({
          search: mvc.tokenSafe(this.SEARCH_PATH_QUERY),
          default: { "latest_time": "now", "earliest_time": "-60m@m" },
          autostart: false
        }, {
          tokens: true
        });
        this._pathSearchManager.on('search:start', this.onSearchStart, this);
        this._pathSearchManager.on('search:done', this.onSearchDone, this);
        this._pathSearchManager.data('results').on('data', this.parsePathData, this);
      }
      
      return this._pathSearchManager;
    },

    /**
     * Tokens:
     *  (standart timepicker) $earliest$ = -60m@m
     *  (standart timepicker) $latest$ = now
     *  $src_ip$
     *  $dest_ip$
     *
     * Direction possible values:
     *  forward | backward | bi-directed
     */
    searchPath: function (src, dest, direction) {
      this.criteria = {
        src_ip     : src,
        dest_ip    : dest,
        direction  : direction
      };

      var tokens = mvc.Components.getInstance('default');
      tokens.set('src_ip', (direction == 'backward' ? this.criteria.dest_ip : this.criteria.src_ip));
      tokens.set('dest_ip', (direction == 'backward' ? this.criteria.src_ip : this.criteria.dest_ip));
      tokens.set('direction', this.criteria.direction);

      var sm = this.getPathSearchManager();

      sm.set('earliest_time', tokens.get('earliest'));
      sm.set('latest_time', tokens.get('latest'));

      sm.unset('search');
      if (direction == 'bi-directed') {
        sm.set('search', mvc.tokenSafe(this.SEARCH_BI_DIRECTED_PATH_QUERY));
      } else {
        sm.set('search', mvc.tokenSafe(this.SEARCH_PATH_QUERY));
      }

      sm.startSearch();
    },

    onSearchStart: function () { this.trigger('search:start'); },

    onSearchDone: function (o) { this.trigger('search:done', o); },

    resetData: function () {
      this.paths = [];
      this.nodesCache = {};
      this.links = [];
      this.nodes = [];
      this.trafficAB = 0;
      this.trafficBA = 0;
    },

    parsePathData: function (data) {
      this.resetData();

      var c = data.collection();

      /*
      TEST CASE:

      var m1 = new Backbone.Model({"src_ip":"192.168.67.3","src_type":"phost","src_vhost_ip":"255.255.255.255","dest_ip":"192.168.66.66","dest_type":"phost","dest_vhost_ip":"255.255.255.255","nodes":"[{3232251700,device,192.168.63.52,14,13}]","resolved":"F","direction":"1","traffic":"432720"});
      var m2 = new Backbone.Model({"src_ip":"192.168.67.3","src_type":"vm","src_vhost_ip":"192.168.67.12","dest_ip":"192.168.66.66","dest_type":"vm","dest_vhost_ip":"192.168.66.11","nodes":"[{3232251700,device,192.168.63.52,14,13}]","resolved":"F","direction":"1","traffic":"38564760"});

      c = new Backbone.Collection([ m1, m2 ]);
      */

      c.each(function (m) {

        //console.log(JSON.stringify(m.toJSON()));

        //var o = m.toJSON();
        //console.log('M: ', o.src_ip, o.src_type, '(', o.src_vhost_ip, ')' , ' -> ', o.dest_ip, o.dest_type, '(', o.dest_vhost_ip, ')');

        var path = new Path({
          resolved  : m.get('resolved'),
          backward  : m.get('direction')
        });

        if (path.get('backward')) {
          this.trafficBA += parseInt(m.get('traffic'), 10);
        } else {
          this.trafficAB += parseInt(m.get('traffic'), 10);
        }

        // VM ->
        var src_title = (m.get('src_type') === 'vm' || m.get('src_type') === 'vm_vxlan') ? m.get('src_vm_name') : m.get('src_name');
        path.appendNode(this.createNode({ type: m.get('src_type'), name: m.get('src_ip'), title: src_title }), 'src');

        // -> VM-Host ->
        if (m.get('src_vhost_ip') !== this.IP_OF_NOTHING) {
          //console.log('append src_vhost_ip');
          path.appendNode(this.createNode({ type: 'vm_host', name: m.get('src_vhost_ip'), title: m.get('src_vhost_name') }), 'srcHost');
        }

        // -> firstHop -> secondHop -> ... -> lastHop ->
        //console.log(m.get('nodes'));
        var nodes = this.parseHops(m.get('nodes'));
        _.each(nodes, function (node) {
          path.appendNode(node, 'hop');
        }, this);

        // -> VM-Host ->
        if (m.get('dest_vhost_ip') !== this.IP_OF_NOTHING) { // m.get('src_vhost_ip') !== m.get('dest_vhost_ip')
          //console.log('append dest_vhost_ip');
          path.appendNode(this.createNode({ type: 'vm_host', name: m.get('dest_vhost_ip'), title: m.get('dest_vhost_name') }), 'dstHost');
        }

        // -> VM
        var dest_title = (m.get('dest_type') === 'vm' || m.get('dest_type') === 'vm_vxlan') ? m.get('dest_vm_name') : m.get('dest_name');
        path.appendNode(this.createNode({ type: m.get('dest_type'), name: m.get('dest_ip'), title: dest_title }), 'dst');

        //console.log('Register path', path);

        this.registerPath(path);

      }, this);

      this.removeVdsFromPaths();

      this.nodes = _.values(this.nodesCache);
      this.links = this.registerLinks();

      //console.log('Path OUT: ', { paths: this.paths, nodes: this.nodes, links: this.links });

      this.trigger('pathDataSync', {
        criteria: this.criteria,
        paths: this.paths,
        nodes: this.nodes,
        links: this.links,
        trafficAB: this.trafficAB,
        trafficBA: this.trafficBA
      });
    },

    parseHops: function (strHops) {
      var nodes = [];

      // strHops structure: [{...}{...}{...}]
      var hops = strHops.split('}{').reverse();

      _.each(hops, function (hop) {
        // { node_id, node_type, ip_address, in_snmp, out_snmp }
        var parts = hop.match(/\{?(\d+),(.+),([\.\d]+),(\d+),(\d+)\}?/);
        if (parts && parts.length == 6) {
          parts.shift();
          nodes.push(this.createNode({ parts: parts }));
        } else {
          console.error('Invalid record!');
        }
      }, this);

      return nodes;
    },

    registerPath: function (path) {
      var p, i = 0, isSubset = false, isExpansion = false;

      while (p = this.paths[i++]) {
        isExpansion = p.isSubset(path);
        isSubset = path.isSubset(p);

        if (isExpansion || isSubset) {
          break; // remember i
        }
      }

      if (isSubset) {
        // do nothing
        //console.log('subset!');
      } else
      if (isExpansion) {
        this.paths[--i] = path;
        //console.log('expansion!');
      } else {
        this.paths.push(path);
        //console.log('new path!');
      }
    },

    createNode: function (data) {
      if (data.parts) {
        data.node_id  = data.parts[0];
        data.type     = data.parts[1];
        data.name     = data.parts[2];
        data.if_in    = data.parts[3];
        data.if_out   = data.parts[4];
      }

      var node = new Node(data);
      var name = node.get('name');
      var type = node.get('type');

      if (this.nodesCache.hasOwnProperty(name)) {

        // Fix bug with different types for the same node:
        if (this.nodesCache[name].get('type') !== type) {
          // - VM was detected as pHost
          // - TOR firstly was detected as 'device'
          if (type === 'vm' || type === 'vm-vxlan') {
            this.nodesCache[name].set('type', type);
          }
          if (type === 'tor') {
            this.nodesCache[name].set('type', type);
          }
        }

        // register new interfaces
        var iface, i = 0, ifs = node.get('if_in');
        while (iface = ifs[i++]) {
          if (this.nodesCache[name].get('if_in').indexOf(iface) < 0)
            this.nodesCache[name].get('if_in').push(iface);
        }

        i = 0; ifs = node.get('if_out');
        while (iface = ifs[i++]) {
          if (this.nodesCache[name].get('if_out').indexOf(iface) < 0)
            this.nodesCache[name].get('if_out').push(iface);
        }

      } else {
        this.nodesCache[name] = node;
      }

      return this.nodesCache[name];
    },

    removeVdsFromPaths: function () {
      var delayRemove = {};

      var path, i = 0;
      while (path = this.paths[i++]) {
        var isPathPhysical = path.isPhysical();
        var node, nodes = path.get('nodes'), j = 0;
        while (node = nodes[j++]) {
          if (node.get('type') === 'vds') {

            // Remove VDS if path has any physical device in nodes
            if (isPathPhysical) {

              // remove node from path
              nodes.splice(--j, 1);

              // safe delete node from nodesCache (to avoid deletion if node will be used in another path)
              if (!delayRemove.hasOwnProperty(node.get('name'))) {
                delayRemove[node.get('name')] = true;
              }

            } else {
              delayRemove[node.get('name')] = false;
            }

          }
        }
      }

      for (var key in delayRemove) {
        if (delayRemove.hasOwnProperty(key) && delayRemove[key]) {
          delete this.nodesCache[key];
        }
      }
    },

    registerLinks: function () {
      var links = [];

      var path, i = 0;
      while (path = this.paths[i++]) {

        var node, j = 0, nodes = path.get('nodes'), prevNode = null;
        while (node = nodes[j++]) {

          if (prevNode && !_.isEqual(prevNode.toJSON(), node.toJSON())) {
            var link = this.hasLink(links, prevNode, node);
            if (!link) {
              links.push(new Link({ source: prevNode, target: node, resolved: path.get('resolved') }));
            } else {
              // if detected resolved path - override 'resolved' flag in existed link
              if (path.get('resolved')) {
                link.set('resolved', path.get('resolved'));
              }
            }
          }

          prevNode = node;
        }

      }

      return links;
    },

    hasLink: function (links, from, to) {
      var link, i = 0;
      while (link = links[i++]) {
        if (link.get('source').get('name') === from.get('name') &&
            link.get('target').get('name') === to.get('name')) {
          return link;
        }
      }
      return false;
    }

  });

  var HealthProxy =  Backbone.Model.extend({

    TREND_DICT: {
      5 : { title: 'Ascending',    bonus: -20 },
      4 : { title: 'Improving',    bonus: -10 },
      3 : { title: 'Steady',       bonus:  -5 },
      2 : { title: 'Degrading',    bonus:  10 },
      1 : { title: 'Falling',      bonus:  20 },
      0 : { title: 'Undetermined', bonus:   0 }
    },

    getHealthSearchManager: function () {
      if (!this._healthSearchManager) {
        this._healthSearchManager = new SearchManager({
          search: '`netops_path_get_health("$x180_devices$")`',
          default: { "latest_time": "now", "earliest_time": "-60m@m" },
          autostart: false
        }, {
          tokens: true
        });
        this._healthSearchManager.data('preview', {count: 0, output_mode: 'json'})
          .on('data', this.parseHealthData, this);
      }
      return this._healthSearchManager;
    },

    /**
     * Tokens:
     *  (standart timepicker) $earliest$ = -60m@m
     *  (standart timepicker) $latest$ = now
     *  $x180_devices$
     */
    searchHealthData: function (x180_devices) {
      var tokens = mvc.Components.getInstance('default');
      tokens.set('x180_devices', x180_devices);

      var sm = this.getHealthSearchManager();
      sm.set('earliest_time', tokens.get('earliest'));
      sm.set('latest_time', tokens.get('latest'));

      sm.startSearch();
    },

    parseHealthData: function (data) {
      this.healthData = {};

      data.collection().each(function (m) {

        // device info
        this.healthData[m.get('device')] = this.healthData[m.get('device')] || m.toJSON();
        var dev = this.healthData[m.get('device')];

        // interface info
        dev.interfaces = dev.interfaces || {};
        dev.interfaces[m.get('snmp_index')] = m.toJSON();

      }, this);

      this.trigger('healthDataSync', this.healthData);
    }

    // Since 20180-20181 updates, the risk is already provided in syslog
    /*
    calculateRisk: function (H, T) {
      T = parseInt(T, 10);
      H = parseInt(H, 10);

      var B = this.getTrend(T).bonus;

      return Math.pow((-1 * H), 2) * B / 2500 + H * (B - 25) / 25 + 100;
    },

    getTrend: function (num) {
      if (this.TREND_DICT.hasOwnProperty(num)) {
        return this.TREND_DICT[num];
      } else {
        return this.TREND_DICT[0];
      }
    }
    */

  });

  return {
    PathsProxy: PathsProxy,
    HealthProxy: HealthProxy,
    Path: Path,
    Node: Node,
    Link: Link
  };

});