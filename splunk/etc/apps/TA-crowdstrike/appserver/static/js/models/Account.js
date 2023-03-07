/*global define*/
define([
    'app/models/Base.Model',
    'app/config/ContextMap',
    'underscore',
], function (
    BaseModel,
    ContextMap,
    _
) {
    return BaseModel.extend({
        url: [
            ContextMap.restRoot,
            ContextMap.account
        ].join('/'),

        initialize: function (attributes, options) {
            options = options || {};
            this.collection = options.collection;
            BaseModel.prototype.initialize.call(this, attributes, options);
            this.addValidation('api_uuid', this.nonEmptyString);
            this.addValidation('api_key', this.nonEmptyString);
        },

        nameValidator: function (attr) {
            var value;
            value = this.entry.content.attributes[attr];
            if(value && value.indexOf('\\')>-1){
                return _('Field "' + this._getAttrLabel(attr) + '" can not contain "\\".').t();
            }
            return BaseModel.prototype.nameValidator.call(this, attr);
        }
    });
});
