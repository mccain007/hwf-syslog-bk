require([
    'jquery',
    'splunkjs/mvc', 
    'splunkjs/mvc/simplexml/ready!'
], function($, mvc){

    var BaseCellRenderer = require('views/shared/results_table/renderers/BaseCellRenderer');
    var table_ids = [ "table_1_1", "table_2_1" ];
    // by default the strings in all the cells in the table holding numeric values are formated based on local settings
    // in case of en-US the thousand separator is the comma character ( example 123456 -> 12,345 )
    // for some columns this behaviour might be not desirable, those are listed in the blacklisted_columns array
    // example Source VXLAN_ID = 5000 , it should not be converted to 5,000
    var blacklisted_columns = [
        "Source VXLAN ID",
        "Destination VXLAN ID"
    ];
    var table_cell_renderer = BaseCellRenderer.extend({
        canRender: function() {
            return true;
        },
        render: function($td, cell) {
            if (cell.value) {
                if (isNaN(cell.value) || ( $.inArray(cell.field, blacklisted_columns) >= 0 )) {
                    $td.html(cell.value);
                } else {
                    $td.addClass('numeric');
                    var num = parseFloat(cell.value, 10);
                    $td.html(num.toLocaleString());
                }
            } else {
                $td.html('');
            }
        }
    });
    $.each(table_ids, function( index, value ) {
        var formattedTable = mvc.Components.get(String(value));
        if (!$.isEmptyObject(formattedTable)){
            formattedTable.getVisualization(function(tableView){
                tableView.table.addCellRenderer(new table_cell_renderer());
                tableView.table.render();
            });
        }
    });

});