'use strict';

var reopcode = require( './re-opcode' );
var sanitize = require( 'validator' ).sanitize;

var TYPES = {};
var ARRAYS = {};
var DEFAULTS = {
};




// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function processToBase( data, type, subtype ) {
	var result;
	if ( !toBase[type] ) { return [ 'нет такого типа данных', data ]; }
	try {
		result = toBase[type]( data, subtype );
	} catch ( err ) {
		return [ 'не удалось провести проверку значения', data ];
	}
	return result;
}

var toBase = {};



// приведение типа возвращает массив, где в 0 - ошибка, в 1 - результат трансформации
function processToUser( data, type, subtype ) {
	var result;
	if ( !toUser[type] ) { return [false, data]; }
	try {
		result = toUser[ type ]( data, subtype );
	} catch ( err ) {
		return [ 'не удалось провести преобразование значения', data ];
	}
	return result;
}

var toUser = {};




// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function processToQuery( data, type ) {
	var result;
	if ( !toQuery[type] ) { return [ 'нет такого типа данных', data ]; }
	try {
		result = toQuery[ type ]( data );
	} catch ( err ) {
		return [ 'не удалось провести проверку значения', data ];
	}
	return result;
}

var toQuery = {};




// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function drillToValue( data, type ) {
	var check, keys, el, i, t;
	var res = {};
	var queue = [
		[data, 'data', res]
	];

	while ( queue.length ) {
		el = queue.shift();

		if ( typeof el[0] === 'object' ) {
			if ( Array.isArray( el[0] ) ) {
				t = [];
				for ( i = 0; i < el[0].length; i += 1 ) {
					queue.push( [el[0][i], i, t] );
				}
			} else {
				t = {};
				keys = Object.keys( el[0] );
				for ( i = 0; i < keys.length; i += 1 ) {
					queue.push( [el[0][keys[i]], keys[i], t] );
				}
			}
		} else {
			check = processToQuery( el[0], type );
			if ( check[0] ) { return ['ошибка в параметре запроса', data]; }
			t = check[1];
		}

		el[2][el[1]] = t;
	}

	return [false, res.data];
}



// nest types
(function() {
	var i, keys = Object.keys( toBase );
	for ( i = 0; i < keys.length; i += 1 ) {
		TYPES[keys[i]] = true;
	}
})();



module.exports = {
	toUser: processToUser,
	toBase: processToBase,
	toQuery: drillToValue,
	types: TYPES,
	arrays: ARRAYS,
	defaults: DEFAULTS
};
