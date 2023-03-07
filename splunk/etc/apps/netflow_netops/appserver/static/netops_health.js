require.config({
  paths: {
    app: '../../app/netflow_netops/',
    modules: '../../app/netflow_netops/modules',
    common: '../../app/netflow_netops/common',
    d3: '../../app/netflow_netops/vendor/d3.min',
    text: '../../app/netflow_netops/vendor/text'
  }
});

require([
  'jquery',
  'underscore',
  'backbone',

  'modules/netops_health/views/main'

], function($, _, Backbone, MainView) {
  'use strict';

  require(['splunkjs/ready!', 'splunkjs/mvc/simplexml/ready!'], function () {
    main();
  });

  function main() {
    var $container = $('.health-container');
    $container.closest('.dashboard-cell').css('width', '70%');

    //Formatting width on fly
    var secondaryPanels = ['#chart_2_1', '#chart_2_2', '#chart_2_3'];

    setInterval(function() {
      if($(secondaryPanels[0]).closest('.dashboard-cell').css('width') !== '30%') {
        $.each(secondaryPanels, function(index, elemID) {
          $(elemID).closest('.dashboard-cell').css('width', '30%');
        });
      }
    }, 100);

    //Adding views
    $container.html(new MainView().render().el);
  }

});
