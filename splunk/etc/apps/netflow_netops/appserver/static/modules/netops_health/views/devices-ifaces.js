define([
  'underscore',
  'jquery',
  'backbone',
  'splunkjs/mvc',
  'splunkjs/mvc/utils',
  'd3',
  'text!modules/netops_health/templates/info_device.xhtml',
  'text!modules/netops_health/templates/info_iface.xhtml'
], function(_, $, Backbone, mvc, utils, d3, infoDeviceTpl, infoIfaceTpl) {
  'use strict';

  // 800          - harcoded width of the tree. See "size([h, w])" below
  // 0.7%         - width of the main graph from the main page
  var padding = ($('.health-container').closest('.dashboard-cell').offset().left) * 2;
  var marginLeft = (($(window).width() * 0.7) - (790 + padding)) / 2;

  var m = [10, 20, 20, marginLeft],
      w = 1280 - m[1] - m[3],
      h = 607 - m[0] - m[2],
      i = 0,
      dsplOnPage = 8;
    
  return Backbone.View.extend({

    className: 'graph-splunk-view',
        
    diagonal: d3.svg.diagonal().projection(function(d) {
      return [d.y, d.x];
    }),
        
    vis: null,
    root: null,
    tree: null,

    events: {
      'click .link-to-path': 'goToPath'
    },

    currentNode: null, // used to prepare link from info-panel
    displayingNode: null,

    infoPanel: null,

    initialize: function(data) {
      var deviceGroup = 'All';

      this.root = {
        'name': deviceGroup,
        'type': 'd',
        'children': data,
        'x0': h/2,
        'y0': 0
      };
      
      //paginate All
      this.toggleAll(this.root);
      
      //Open ifaces of the first device
      this.toggleNodeTree(this.root.children[0]);
    },
    
    render: function() {
      this.tree = d3.layout.tree().size([h, w]);

      this.vis = d3.select(this.el).append('svg')
        .attr('width', w + m[1] + m[3])
        .attr('height', h + m[0] + m[2])
        .append('svg:g')
        .attr('transform', 'translate(' + m[3] + ',' + m[0] + ')');

      this.update(this.root);
      return this;
    },

      //Put event handlers here. Update the graph with this method.
    update: function(source) {
      var that = this;
      var duration = d3.event && d3.event.altKey ? 5000 : 500;
      var nodes = this.tree.nodes(this.root).reverse();

      nodes.forEach(function(d) {
        d.y = d.depth * 180;
      });

      var node = that.vis.selectAll('g.node')
        .data(nodes, function(d) {
          return d.id || (d.id = ++i);
        });

      //------------------------WHOLE NODE-----------------------
      var nodeEnter = node.enter().append('svg:g')
        .attr('class', 'node')
        .attr('transform', function(d) {
          return 'translate(' + source.y0 + ',' + source.x0 + ')';
        })
        .on('mouseover.info', function(d) {
          switch(d.depth) {
            case 0:
              return null;
              break;
            case 1:
              this.showInfoPanel(d);
              break;
            case 2:
              this.showInfoPanel(d);
              break;
          }
        }.bind(this))
        .on('mouseout.info', function() {
          this.hideInfoPanel();
        }.bind(this))
        .on('click.select', function (d) {
          that.selectNode(this, d);
        });

      //--------------------------CIRCLE-----------------------------------------------------------
      nodeEnter.append('svg:circle')
        .attr('r', 1e-6)
        .style('fill', '#fff');

      //--------------------------TEXT FOR THE CIRCLE--------------------------------------------
      nodeEnter.append('svg:text')
        .attr('class', 'node-title')
        .attr('x', function(d) {
          if(d.children || d._children) {
            switch(d.depth) {
              case 0: return -2; break;
              case 1: return -28; break;
              case 2: return 20; break;
            }
            return null;
          }
        })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) {
          switch(d.depth) {
            case 0: return "end"; break;
            case 1: return "end"; break;
            case 2: return "start"; break;
          }
          return null;
        })
        .text(function(d) {
          if(d.depth === 1) {
            return ( d.device_type_name ? d.device_type_name + ' ' : '' ) + d.exp_ip_name;
          } else {
            return ( d.name ? d.name : d.snmp_index );
          }
        }.bind(this))
        .style("fill-opacity", 1e-6)
        .style("text-decoration", 'none')
        .style("cursor", function (d) { if (d.depth === 2) return "pointer"; else return 'inherited'; });

      //-----------------------------PAGINATION--------------------------

      //FORWARD
      nodeEnter.append("svg:path")
        .attr("d", function(d) {
          if(d.parent) {
            var type = d.parent.type;
            if(d.parent[type+"Last"] && d.name === d.parent[type+"Last"].name && d.parent[type+"Stop"] < d.parent[type+"All"].length) {
              return "M 42 30 L 54 30 48 42 Z";
            }
          }
        })
        .attr("fill", "green")
        .style("cursor", "pointer")
        .on("click", function(d) { d3.event.stopPropagation(); that.forward(d); });

      //TEXT
      nodeEnter.append("svg:text")
        .html(function(d) {
          if(d.parent) {
            var type = d.parent.type;
            if(d.parent[type+"Last"] && d.name === d.parent[type+"Last"].name) {
              var pagesAll = Math.ceil(d.parent[type + "All"].length / dsplOnPage);
              var currPage = d.parent[type + "Stop"] / dsplOnPage;
              return currPage + "/" + pagesAll;
            }
          }
        })
        .attr("x", 22)
        .attr("y", 40)
        .attr("text-anchor", "start")
        .attr("fill", "gray");

      //BACKWARD
      nodeEnter.append("svg:path")
        .attr("d", function(d) {
          if(d.parent) {
            var type = d.parent.type;
            if(d.parent[type+"Last"] && d.name === d.parent[type+"Last"].name && d.parent[type+"Start"] > 0) {
              return "M 6 42 L 12 30 18 42 Z";
            }
          }
        })
        .attr("fill", "blue")
        .style("cursor", "pointer")
        .on("click", function(d) { d3.event.stopPropagation(); that.backward(d); });

      //--------------------------------ICONS------------------------------------
      nodeEnter.filter(function (d) { return d.depth > 0; }).append("svg:image")
        .attr('width', function(node) {
          if(node.depth === 1) {
            return 48;
          } else {
            return 24;
          }
        })
        .attr('height', function(node) {
          if(node.depth === 1) {
            return 48;
          } else {
            return 24;
          }
        })
        .attr('x', function(node) {
          if(node.depth === 1) {
            return "-23";
          } else {
            return "-12";
          }
        })
        .attr('y', function(node) {
          if(node.depth === 1) {
            return "-23";
          } else {
            return "-12";
          }
        })
        .attr('xlink:href', function(node) {
          if(node.depth === 1) {
            return '/static/app/netflow_netops/img/device.png';
          } else {
            return '/static/app/netflow_netops/img/port.png';
          }
        });

      var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + d.y + "," + d.x + ")";
        });

      nodeUpdate.select("circle")
        .attr("r", function (d) {
          switch (d.depth) {
            case 1: return 24;
            case 2: return 17;
            default: return 1e-6;
          }
        })
        .style("fill", function(d) {
          switch (d.depth) {
            case 1: return that.colorByHealth(d.dev_health_score);
            case 2: return that.colorByHealth(d.if_health_score);
            default: 'transparent';
          }
        });

      nodeUpdate.select("text")
        .style("fill-opacity", 1);

      var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) {
          return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

      nodeExit.select("circle")
        .attr("r", 1e-6);

      nodeExit.select("text")
        .style("fill-opacity", 1e-6);

      nodeExit.select('path')
        .style("fill-opacity", 1e-6);

      var link = that.vis.selectAll("path.link")
        .data(this.tree.links(nodes), function(d) {
          return d.target.id;
        });

      link.enter().insert("svg:path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
          var o = {x: source.x0, y: source.y0};
          return that.diagonal({source: o, target: o});
        })
        .transition()
        .duration(duration)
        .attr("d", that.diagonal);

      link.transition()
        .duration(duration)
        .attr("d", that.diagonal);

      link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
          var o = {x: source.x, y: source.y};
          return that.diagonal({source: o, target: o});
        })
        .remove();

      nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    },

    toggleAll: function(d) {
      var that = this;

      //Paginate devices
      if(d.type === 'd') {
        if(d.children.length > dsplOnPage) {
          this.paginate(d);
        }
        $.each(d.children, function(i, v) { that.toggleAll(v); });
      }

      //Paginate ifaces
      if(d.type === 'i') {
        if(d.children) {
          if(d.children.length > dsplOnPage) {
            this.paginate(d);
          }
          $.each(d.children, function(i, v) { that.toggleAll(v); });
        }
      }

      //Move all ifaces from CHILDREN to _CHILDREN
      if(d.type === null || d.type !== 'd') {
        if(d.children) {
          $.each(d.children, function(i, v) { that.toggleAll(v); });
          this.toggleNodeTree(d);
        }
      }
    },

    toggleNodeTree: function(d) {
      if(d.children) {
        this.collapseNodeTree(d);
      } else {
        this.expandNodeTree(d);
      }
    },

    collapseNodeTree: function (d) {
      d._children = d.children;
      d.children = null;
    },

    expandNodeTree: function (d) {
      d.children = d._children;
      d._children = null;
    },

    goToPath: function (event) {
      event.preventDefault();

      var tokens = mvc.Components.getInstance('default');
      var d = this.currentNode;

      var params = {
        dev_ip: d.depth === 1 ? d.name : d.depth === 2 ? d.parent.name : '',
        dev_iface: d.depth === 2 ? d.snmp_index : '',
        dev_iface_name: d.depth === 2 ? d.name : '',
        earliest: tokens.get('earliest'),
        latest: tokens.get('latest'),
        'form.filter_ip': '*'
      };

      utils.redirect("netops_paths?" + $.param(params));
    },

    // additional info panel to display device/iface details
    showInfoPanel: function(data) {
      if (!_.isEqual(this.displayingNode, data)) {
        if (!this.currentNode || _.isEqual(data, this.currentNode)) {
          this.displayingNode = data;
          var popup = this.getInfoPanel();
          var tpl = data.depth === 1 ? infoDeviceTpl : infoIfaceTpl;
          popup.stop().hide().html(_.template(tpl, data)).fadeIn();
        }
      }
    },

    hideInfoPanel: function() {
      if (!this.currentNode) {
        this.getInfoPanel().stop().hide();
        this.displayingNode = null;
      }
    },

    getInfoPanel: function() {
      if(!this.infoPanel) {
        this.infoPanel = $('<div class="netops_health_info_panel" style="display:none;"></div>');
        this.$el.append(this.infoPanel);
      }
      return this.infoPanel;
    },

    selectNode: function (el, d) {
      // unselect all nodes
      d3.selectAll('.node').classed('selected', false);

      if (d.depth > 0 && !_.isEqual(this.currentNode, d)) {
        d3.select(el).classed('selected', true);
        this.currentNode = d;
        this.showInfoPanel(d);

        if (d.depth === 1 && !d.children) {
          this.expandNodeTree(d);
          this.update(d);
        }

      } else {
        this.currentNode = null;

        if (d.depth === 1) {
          this.toggleNodeTree(d);
          this.update(d);
        }
      }

      if(d.depth === 2) {
        var tokens = mvc.Components.get('default');
        tokens.set('Exporter/Interface', d.parent.exp_ip_name + '/' + d.name);
        //tokens.trigger('change:Exporter/Interface');
      }
    },

    forward: function(d) {
      var type = d.parent.type;
      var that = this;

      d.parent[type+"Start"] = d.parent[type+"Stop"];
      d.parent[type+"Stop"] = d.parent[type+"Stop"] + dsplOnPage;

      this.paginate(d.parent, type);
      $.each(d.parent.children, function(i, v) { that.toggleAll(v); });
      this.update(d);
    },

    backward: function(d) {
      var type = d.parent.type;
      var that = this;

      d.parent[type+"Start"] = d.parent[type+"Start"] - dsplOnPage;
      d.parent[type+"Stop"] = d.parent[type+"Stop"] - dsplOnPage;

      this.paginate(d.parent, type);
      $.each(d.parent.children, function(i, v) { that.toggleAll(v); });
      this.update(d);
    },

    paginate: function(d) {
      var type = d.type;

      d[type+"First"] = "none";
      d[type+"Last"]  = "none";
      if(d[type+"All"] == null) { d[type+"All"] = d.children; }

      if(d[type+"Start"] == null && d[type+"Stop"] == null) {
        d[type+"Start"] = 0;
        d[type+"Stop"] = dsplOnPage;
      }

      d.children = d[type+"All"].slice(d[type+"Start"], d[type+"Stop"]);

      if(d[type+"Start"] > 0)                   { d[type+"First"] = d.children[0]; }
      if(d[type+"Stop"] < d[type+"All"].length) { d[type+"Last"] = d.children[Object.keys(d.children).length - 1]; }
      if(d[type+"Stop"]>=d[type+"All"].length)  { d[type+"Last"] = d.children[Object.keys(d.children).length - 1]; }

      //return;
    },

    //Color functions
    colorByHealth: function(health) {
      health = parseInt(health, 10);

      var color = "#ccdd82";
      if (health < 66) { color = '#fedc81'; }
      if (health < 36) { color = '#f8696b'; }
      if (isNaN(health)) { color = '#cccccc'; }

      return color;
    }

  });

});
