define(function(require, exports, module) {
    return function(err) {
        var message;

        if (!err) {
            message = "Error message not found in REST response";
        } else if (err.data.error) {
            message = err.data.error;
        } else {
            try {
                message = err.data.messages[0].text;
            } catch (e) {
                if (typeof err.data === "string") {
                    message = "Server error: " + err.data.substr(0, 200);
                } else {
                    message = "Unexpected error while processing REST response";
                }
            }
            console.log(err);
        }

        return message;
    };
});
