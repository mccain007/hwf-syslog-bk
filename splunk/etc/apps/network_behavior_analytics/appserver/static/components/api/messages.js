define([
    'underscore',
    'jquery',
    'backbone'
], function(_, $, Backbone) {
    return Backbone.View.extend({
        LEVELS: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        },

        initialize: function (options) {
            _.extend(this, _.pick(options, "restService"));
            this.msgs = [];
            this.timer = setInterval(this.refresh.bind(this), 5000);
        },

        addMessage: function(level, body) {
            this.msgs.push({level: level, body: body});
            this.render();
        },

        refresh: function() {
            this.restService.get('/network_behavior_analytics/api/messages', {}, function(err, response) {
                if (err) {
                    this.msgs = [{
                        level: this.LEVELS.ERROR,
                        body: "Unable to connect to the Splunk REST API. " +
                        "Please contact support@alphasoc.com for assistance."
                    }];
                } else {
                    this.msgs = response.data.messages;
                }
                this.render();
            }.bind(this));

            return this;
        },

        render: function () {
            var body = "";

            for (var i = 0; i < this.msgs.length; i++) {
                var item = this.msgs[i];
                var msgClass;

                switch (item.level) {
                    case this.LEVELS.DEBUG:
                        console.log(item.body);
                        continue;
                    case this.LEVELS.INFO:
                        msgClass = 'warningbox-info';
                        break;
                    case this.LEVELS.WARN:
                        msgClass = 'warningbox-warning';
                        break;
                    default:
                        msgClass = 'warningbox-error';
                }

                body += '<div class="dashboard-warningbox ' + msgClass + '">' + $('<div>').text(item.body).html() + '</div>';
            }
            this.$el.html(body);

            return this;
        }
    });
});
