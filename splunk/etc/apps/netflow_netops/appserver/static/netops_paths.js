require.config({
  paths: {
    modules: '../../app/netflow_netops/modules',
    d3: '../../app/netflow_netops/vendor/d3.min',
    text: '../../app/netflow_netops/vendor/text'
  }
});

require([
  'jquery',
  'underscore',
  'backbone',

  'modules/netops_paths/views/main'

], function($, _, Backbone, MainView) {
  'use strict';

  require(['splunkjs/ready!', 'splunkjs/mvc/simplexml/ready!'], function () {
    main();
  });

  function main() {
    $('.netops-paths-container').html(new MainView().render().el);
  }

});
