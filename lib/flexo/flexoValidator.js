'use strict';

var Validator = require( 'validator' ).Validator;

Validator.prototype.lenIn = function( str, lenArr ) {
	var i;
	for ( i = 0; i < lenArr.length; i += 1 ) {
		if ( str.length === lenArr[i] ) {
			return true;
		}
	}
	return false;
};
Validator.prototype.numeric = function( str ) {
	return str.match( /^[0-9]+$/ );
};
Validator.prototype.phone = function( str ) {
	return str.match( /^\(\d{3}\)\d{3}\-\d{2}\-\d{2}$/ );
};


var validatorError = function( msg ) {
	this._errors.push( msg );
	return this;
};

var validatorGetErrors = function() {
	return this._errors;
};



var validate = function( element, scheme ) {
	var i, elem, type;
	var k, keys, check;
	var rules, messages;
	var v;

	v = new Validator();
	v.error = validatorError;
	v.getErrors = validatorGetErrors;
	v._errors = [];
	rules = scheme.validation || {};
	messages = scheme.message || {};

	if ( scheme.type === 'array' ) {
		elem = element;
		type = scheme.of;
	} else {
		elem = [ element ];
		type = scheme.type;
	}

	if ( !Array.isArray( elem ) ) {
		return [ (new Error( 'Must be an array' )) ];
	}

	if ( rules.notEmpty !== undefined && elem.length === 0 ) {
		return [ (new Error( 'Must have at least 1 element' )) ];
	}

	keys = Object.keys( rules );

	for ( i = 0; i < elem.length; i += 1 ) {
		if ( !checkType[type]( elem[i] ) ) {
			return [ (new Error( 'Wrong type, must be `' + type + '`' )) ];
		}
		check = v.check( elem[i], messages );

		for ( k = 0; k < keys.length; k += 1 ) {
			check = check[keys[i]].apply( check, (rules[keys[i]] || []) );
		}
	}

	return v.getErrors();
};



var checkType = {
	'id': function( element ) {
		return (typeof element === 'string');
	},
	'array': function( element, of ) {
//		var i;
		if ( Array.isArray( element ) || checkType[of]( element ) ) { return true; }
//		for ( i = 0; i < element.length; i += 1 ) {
//			if ( !checkType[of]( element[i] ) ) { return false; }
//		}
		return false;
	},
	'string': function( element ) {
		return (typeof element === 'string');
	},
	'number': function( element ) {
		return (typeof element === 'number');
	},
	'boolean': function( element ) {
		return (typeof element === 'boolean');
	}
};



module.exports = {
	validate: validate,
	checkType: checkType
};
