define([
    'underscore',
    'jquery',
    'splunkjs/mvc/tableview',
], function(_, $, TableView) {
    return TableView.BaseCellRenderer.extend({
        canRender: function (cell) {
            return cell.field === 'Flags';
        },

        render: function ($td, cell) {
            var body = this.parseCellValue(cell.value);
            if (body.length == 0) {
                $td.html("-");
            } else {
                $td.html(body);
            }
        },

        parseCellValue: function(values) {
            var details = this.parseDetails(values[1]);
            var labels = this.parseLabels(values[2]);
            return this.createBody(values[0], details, labels);
        },

        parseDetails: function(detailValues) {
            if (!detailValues) {
                return {};
            }
            var values = detailValues.split(";&&");

            var details = {};
            for (var i = 0; i < values.length; i++) {
                var flagDesc = values[i].split(";||");
                if (flagDesc.length == 2) {
                    details[flagDesc[0]] = flagDesc[1];
                }
            }

            return details;
        },

        parseLabels: function(labelsValues) {
            if (!labelsValues) {
                return {};
            }
            var values = labelsValues.split(";&&");

            var labels = {};
            for (var i = 0; i < values.length; i++) {
                var flagIdLabel = values[i];
                if (!flagIdLabel) {
                    continue;
                }
                var flagSepIndex = flagIdLabel.indexOf(':')
                if (flagSepIndex < 0) {
                    continue;
                }

                var flagId = flagIdLabel.substring(0, flagSepIndex)
                var flagLabel = flagIdLabel.substring(flagSepIndex+1)
                if (flagId && flagLabel) {
                    if (labels[flagId]) {
                        labels[flagId].push(flagLabel)
                    } else {
                        labels[flagId] = [flagLabel];
                    }
                }
            }

            return labels ? labels : {};
        },

        createBody: function(valuesCsv, details, labels) {
            var values = valuesCsv.split(",");
            var body = "";

            for (var i = 0; i < values.length; i++) {
                var value = values[i];
                var flagLabels = labels[value] || null;
                var desc = details[value] || '';
                var tooltipClass = desc !== '' ? 'alert-flag-tooltip' : '';

                if (flagLabels) {
                    for (var j = 0; j < flagLabels.length; j++) {
                        label = flagLabels[j]
                        if (label) {
                            body += '<div title="' + desc + '" class="alert-flag alert-kv-flags ' + tooltipClass + '">' + value + ' | ' + label + '</div>';
                        }
                    }
                } else if (value) {
                    body += '<div title="' + desc + '" class="alert-flag alert-kv-flags ' + tooltipClass + '">' + value + '</div>';
                }
            }

            return body;
        },
    });
});
