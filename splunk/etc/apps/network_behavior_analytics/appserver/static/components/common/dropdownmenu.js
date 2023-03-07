define([
    'jquery',
    'underscore',
    'backbone',
], function($, _, Backbone) {
    return Backbone.View.extend({
        DEFAULT_CLASS: "asoc-dropdown",
        DEFAULT_WIDTH: 240,

        ARROW_MARGIN: 24,

        events: {
            'click .dropdown-toggle': 'toggleMenu',
            'click .dropdown-menu li a': 'itemClicked',
        },

        initialize: function(options) {
            this.dropdownClass = options.dropdownClass || this.DEFAULT_CLASS;
            this.width = options.width || this.DEFAULT_WIDTH;

            this.icon = options.icon;
            this.position = options.position;

            this.items = options.items;
        },

        menuSelector: function() {
            return '.asoc-dropdown-box .' + this.dropdownClass;
        },

        eventNamespace: function(type) {
            return type + '.asocdropdown-' + this.dropdownClass;
        },

        toggleMenu: function(event) {
            if (event) {
                event.preventDefault();
            }

            const menu = this.$(this.menuSelector());
            if (!menu || menu.length <= 0) {
                this.closeAll();
                this.renderMenu();
            } else {
                this.closeAll();
            }
        },

        closeAll: function() {
            $(window).off(this.eventNamespace("resize"));
            $(document).off(this.eventNamespace("click"));
            $(this.menuSelector()).remove();
        },

        closeOutsideClick: function(event) {
            if (!$(event.target).closest('.asoc-dropdown-box').length) {
                this.closeAll();
            }
        },

        itemClicked: function(event) {
            if (!event || !event.target) {
                return
            }
            event.preventDefault();

            this.trigger('itemClicked', event.target.getAttribute("data-value"));
            this.closeAll();
        },

        renderMenu: function() {
            this.$('.asoc-dropdown-box').append(this._templateMenu({
                dropdownClass: this.dropdownClass,
                items: this.items,
                arrow: this.position !== 'top',
            }));

            $(window).on(this.eventNamespace("resize"), this.updatePosition.bind(this));
            $(document).on(this.eventNamespace("click"), this.closeOutsideClick.bind(this));

            this.updatePosition();
            this.$(this.menuSelector()).addClass("open");
        },

        updatePosition: function() {
            const menu = this.$(this.menuSelector());
            const position = this.calcMenuPosition();

            menu.css({
                "width": this.width,
                "top": position.top,
                "left": position.left,
                "margin-left": position.margin,
            });

            this.$(".arrow").css("margin-left", position.arrowMargin);
        },

        calcMenuPosition: function() {
            const label = this.$('.dropdown-label');
            const position = label.position();

            const menu = this.$('.asoc-dropdown-box .dropdown-menu');
            if (this.position === 'top') {
                return {
                    "top": -1 * menu.height() - label.height() / 2 - 5,
                    "left": position.left + label.width(),
                    "margin": -this.width - 2,
                    "arrowMargin": (this.width / 2) - this.ARROW_MARGIN,
                }
            } else {
                return {
                    "top": position.top + label.height() - 2,
                    "left": position.left + label.width(),
                    "margin": -this.width + (this.ARROW_MARGIN*0.5) - 2,
                    "arrowMargin": (this.width / 2) - this.ARROW_MARGIN,
                }
            }
        },

        render: function() {
            if (this.icon) {
                this.$el.html(this._templateIcon({
                    icon: this.icon,
                }));
            } else {
                this.$el.html(this._templateLabel);
            }

            this.delegateEvents();
            return this;
        },

        _templateIcon: _.template(
            '<div class="asoc-dropdown-box">' +
                '<div class="dropdown-label btn-group">' +
                    '<a href="#" class="btn btn-default dropdown-toggle">' +
                        '<span class="<%= icon %>" style="font-size: 18px"></span>' +
                    '</a>' +
                '</div>' +
            '</div>'
        ),

        _templateLabel: _.template(
            '<div class="asoc-dropdown-box">' +
                '<div class="dropdown-label btn-group pull-right">' +
                    '<a class="dropdown-toggle" href="#">' +
                        '<span class="caret"></span>' +
                    '</a>' +
                '</div>' +
            '</div>'
        ),

        _templateMenu: _.template(
            '<div class="dropdown-menu <%= dropdownClass %>">' +
                '<% if (arrow) { %> ' +
                    '<div class="arrow"></div>' +
                '<% } %>' +
                '<ul>' +
                    '<% _.each(items, function(item, index) { %>' +
                        '<li>' +
                            '<a href="#" data-value="<%= item.value %>" data-item-index="<%= index %>">' +
                                '<%= item.label %>' +
                            '</a>' +
                        '</li>' +
                    '<% }); %>' +
                '</ul>' +
            '</div>'
        )
    });
});
