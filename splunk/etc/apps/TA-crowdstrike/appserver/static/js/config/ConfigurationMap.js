/*global define*/
define([], function (
) {
    return {
        "configuration": {
            "header": {
                title: "Configuration",
                description: "Configure your CrowdStrike account, proxy and logging level.",
                enableButton: false,
                enableHr: false
            },
            "allTabs": [
                {
                   title: "CrowdStrike Account",
                   order: 0,
                   active: true
                },
                {
                    title: "Proxy",
                    order: 1
                },
                {
                    title: "Logging",
                    order: 2
                }
            ]
        }
    };
});
