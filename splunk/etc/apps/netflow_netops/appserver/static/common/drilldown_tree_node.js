/**
 * Copyright (C) 2014-2017 NetFlow Logic
 * All rights reserved.
 *
 * These coded instructions and statements contain unpublished trade
 * secrets and proprietary information. They are protected by federal
 * copyright law and by trade secret law, and may not be disclosed to
 * third parties or used, copied, reverse engineered, decompiled, or
 * duplicated in any form, in whole or in part, without the prior
 * written consent of NetFlow Logic.
 */

define([
  'jquery',
  'underscore',
  'splunkjs/mvc'
], function($, _, mvc) {

  var DrilldownTreeNode = function(description) {
    /**
     * description = {
       *     'id': the element ID (required)
       *     'children': array of children DrilldownTreeNode objects (optional, defaults to [])
       *     'token': the search token used (optional, defaults to "")
       *     'field': the search token will get the value of this field (optional, defaults to the token)
       * }
     **/

    this.id       = description.id;
    this.children = description.children || [];
    this.token    = description.token    || "";
    this.field    = description.field    || this.token;

    var component = mvc.Components.get(this.id);
    var tokens = mvc.Components.get('default');

    this.hide = function() {
      component.$el.parents('.dashboard-panel').hide();
    };
    this.show = function() {
      component.$el.parents('.dashboard-panel').show();
    };
    this.showChildren = function() {
      _.each(this.children, function(child) {
        child.show();
      });
    };
    this.hideSubtree = function() {
      _.each(this.children, function(child) {
        child.hideSubtree();
        child.hide();
      });
    };

    if(this.token === "") { return; }

    this.hideSubtree();

    var that = this;
    tokens.on('change:' + that.token, function() { that.showChildren(); });
  };

  return DrilldownTreeNode;

});

