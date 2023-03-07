define(function(require, exports, module) {
    var TableView = require('splunkjs/mvc/tableview');
    var urgencyNames = require('nba/components/common/urgencynames');

    var RiskCellRenderer = TableView.BaseCellRenderer.extend({
        canRender: function (cell) {
            return cell.field === 'Urgency' || cell.field === 'Risk';
        },

        render: function ($td, cell) {
            var value = Math.min(parseInt(cell.value), 5);
            $td.html('<div class="riskscore riskscore-' + value + '">&nbsp;</div> ' + urgencyNames(cell.value));
        }
    });

    return RiskCellRenderer;
});
