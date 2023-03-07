define(function(require, exports, module) {
    return function(score) {
        var urgencyNames = {
            0: "None",
            1: "Informational",
            2: "Low",
            3: "Medium",
            4: "High",
            5: "Critical"
        };

        return urgencyNames[score] || score.toString();
    };
});
