define([
  'jquery',
  'underscore',
  'backbone',

  'splunkjs/mvc',

  'text!modules/netops_paths/templates/vm_pairs.html',
  'modules/netops_paths/views/graph_path'

], function($, _, Backbone, mvc, vmPairsTpl, GraphPathView) {
  'use strict';

  return Backbone.View.extend({

    className: 'vm-pairs-form',

    template: vmPairsTpl,

    events: {
      'change .target-vm': 'selectVmPair',
      'change [name="direction"]': 'selectVmPair',
      'click .back-to-koleso': 'backToKoleso'
    },

    initialize: function (node, map) {
      //console.log('VM pairs data: ', node, map);
      this.node = node;
      this.map = map;
    },

    render: function () {

      this.$el.html(_.template(this.template, { node : this.node, map : this.map } ));

      if (this.node.targets) {
        this.$('.target-vm').val(this.node.targets[0]).change();
      }

      return this;
    },
    
    selectVmPair: function() {
      var source = this.node.name; // this.$('.source-vm').val();
      var target = this.$('.target-vm').val();
      if (source && target) {
        if (this.pathView) { this.pathView.remove(); }

        $('.graph-koleso-container').hide();

        this.pathView = new GraphPathView({
          src: source,
          dest: target,
          direction: this.$('[name="direction"]:checked').val()
        });
        
        this.$el.append(this.pathView.render().$el);
      }
    },

    backToKoleso: function (event) {
      event.preventDefault();

      //if (this.pathView) { this.pathView.$el.hide(); }
      //this.$el.hide();
      //$('.graph-koleso-container').fadeIn('slow');

      // restart search
      this.trigger('wheel:restartSearch');
    }

  });

});