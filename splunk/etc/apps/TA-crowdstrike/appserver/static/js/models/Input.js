/*global define*/
define([
		'underscore',
		'app/models/Base.Model',
		'app/config/ContextMap'
	], function (
		_,
		BaseModel,
		ContextMap) {
	return BaseModel.extend({
		url: [
			ContextMap.restRoot,
			ContextMap.input
		].join('/'),

		initialize: function (attributes, options) {
			options = options || {};
			this.collection = options.collection;
			BaseModel.prototype.initialize.call(this, attributes, options);
			this.addValidation('account', this.nonEmptyString);
			this.addValidation('start_offset', this.validStartOffset);
			this.addValidation('index', this.nonEmptyString);
			this.addValidation('interval', this.validInterval);
			this.addValidation('start_date', this.validStartDate)
		},

		validStartOffset: function (attr) {
			var start_offset = this.entry.content.get(attr);
			if (start_offset) {
				start_offset = Number(start_offset);
				if (isNaN(start_offset) || start_offset != parseInt(start_offset, 10)) {
					return _('Field "Start Offset" is not valid').t();
				} else if (start_offset < 0) {
					return _('Field "Start Offset" should not be negative.').t();
				}
			}
		},

		validStartDate: function (attr) {
			var start_date = this.entry.content.get(attr);
			var leastDate = new Date("1970-01-01T00:00:00Z").getTime()/1000;
			var now = Math.round(new Date().getTime()/1000);
			var startDate = new Date(start_date).getTime()/1000;
			var matchReg = "^[123][0-9]{3}\-([0][0-9]|[1][012])\-([012][0-9]|[3][01])T([01][0-9]|[2][0123])\:([0-5][0-9]|[6][0])\:([0-5][0-9]|[6][0])Z$"
			if (start_date) {
				if (!start_date.match(matchReg)) {
					return _('Field "Start Date" is not valid.It should be in "YYYY-MM-DDThh:mm:ssZ" UTC format.').t();
				} else if (startDate < leastDate || startDate > now) {
					return _('Field "Start Date" should not be in future.').t();
				}
			}
		},

		validInterval: function (attr) {
			var interval = this.entry.content.get(attr);
			if (interval) {
				interval = Number(interval);
				if (isNaN(interval) || interval != parseInt(interval, 10)) {
					return _('Field "Interval" is not valid').t();
				} else if (interval <= 0) {
					return _('Field "Interval" should be positive number').t();
				}
			} else {
				return _('Field "Interval" is required').t();
			}
		},

		nameValidator: function (attr) {
			var value;
			value = this.entry.content.attributes[attr];
			if (value && value.indexOf('/') > -1) {
				return _('Field "' + this._getAttrLabel(attr) + '" can not contain "/".').t();
			}
			return BaseModel.prototype.nameValidator.call(this, attr);
		}
	});
});
