'use strict';

var reopcode = require( './re-opcode' );
var sanitize = require( 'validator' ).sanitize;

var TYPES = {};
var ARRAYS = {};

function quoteRegExp( str ) {
	return str.replace( /([.?*+^$[\]\\(){}|-])/g, "\\$1" );
}



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function processToBase( data, type ) {
	if ( !toBase[type] ) { return [ 'нет такого типа данных', data ]; }
	return toBase[type]( data );
}

var toBase = {};
toBase.str = function( elem ) {
	return [ false, sanitize( elem.toString().trim() ).xss() ];
};
ARRAYS['words'] = true;
toBase.words = toBase.str;
toBase.int = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return ['не удалось преобразовать к типу `int`', str[1]]; }
	var int = parseInt( str[1] );
	if ( str[1] !== int.toString() ) { return [ 'значение не соответствует типу `int`', str[1] ]; }
	return [ false, int ];
};
toBase.float = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `float`', str[1] ]; }
	var flt = parseFloat( str[1] );
	if ( str[1] !== flt.toString() ) { return [ 'значение не соответствует типу `float`', str[1] ]; }
	return [ false, flt ];
};
toBase.bool = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `bool`', str[1] ]; }

	var falses = /^(|0|false)$/;
	if ( falses.test( str[1] ) ) { return [ false, false ]; }

	var trues = /^(.*|1|true)$/;
	if ( trues.test( str[1] ) ) { return [ false, true ]; }

	return [ 'не удалось преобразовать к типу `bool`', str[1] ];
};
ARRAYS['array'] = true;
toBase.array = function( elem ) {
	if ( Array.isArray( elem ) ) {
		return [ false, elem ];
	} else {
		return [ false, [ elem ] ];
	}
};
toBase.id = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `id`', str[1] ]; }
	var reg = /^\w{2}[\da-z]+$/;
	return [ !reg.test( str[1] ), str[1] ];
};
ARRAYS['ids'] = true;
toBase.ids = function( elem ) {
	var arr = toBase.array( elem );
	if ( arr[0] ) { return [ 'не удалось преобразовать к типу `ids`', arr[1] ]; }
	for ( var i = 0; i < arr[1].length; i += 1 ) {
		var el = toBase.id( arr[1][i] );
		if ( el[0] ) { return [ 'элемент `' + i + '` не соответствует типу `id`', arr[1] ]; }
	}
	return [ false, arr[1] ];
};
ARRAYS['idpath'] = true;
toBase.idpath = toBase.ids;
toBase.money = function( elem ) {
	var flt = toBase.float( elem );
	if ( flt[0] ) { return [ 'не удалось преобразовать к типу `money`', flt[1] ]; }
	var int = toBase.int( flt[1] * 100 );
	if ( int[0] ) { return [ 'не удалось преобразовать к типу `money`', flt[1] ]; }
	return [ false, int ];
};
toBase.numeric = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `numeric`', elem ]; }
	var reg = /^\d+$/;
	return [ !reg.test( str[1] ), str[1] ];
};
toBase.phone = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `phone`', elem ]; }
	var reg = /^\(\d{3}\)\d{3}\-\d{2}\-\d{2}$/;
	return [ !reg.test( str[1] ), str[1] ];
};



// приведение типа возвращает результат трансформации
function processToUser( data, type ) {
	if ( !toUser[type] ) { return data; }
	return toUser[type]( data );
}

var toUser = {};
toUser.money = function( elem ) {
	return elem / 100;
};



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function processToQuery( data, type ) {
	if ( !toQuery[type] ) { return [ 'нет такого типа данных', data ]; }
	return toQuery[type]( data );
}

var toQuery = {};
toQuery.str = function( query ) {
	var res = reopcode.split( query.toString() );
	var cmd = res[0];
	var str = processToBase( res[1], 'str' );
	if ( str[0] ) { return 'ошибка в параметре запроса'; }
	str = str[1];

	if ( cmd['^'] && cmd['$'] && !cmd['i'] ) {
		return [ false, str ];
	} else {
		return [false, new RegExp(
			(cmd['^'] ? '^' : '') + quoteRegExp( str ) + (cmd['$'] ? '$' : ''),
			(cmd['i'] ? 'i' : '')
		)];
	}
};
toQuery.words = function( query ) {
	var res = reopcode.split( query.toString() );
	var cmd = res[0];
	var wrds = processToBase( res[1], 'words' );
	if ( wrds[0] ) { return 'ошибка в параметре запроса'; }
	wrds = wrds[1].split( ' ' );

	var out = [];
	for ( var i = 0; i < wrds.length; i += 1 ) {
		if ( wrds[i].length > 0 ) {
			if ( cmd['^'] && cmd['$'] && !cmd['i'] ) {
				out.push( wrds[i] );
			} else {
				out.push( new RegExp(
					(cmd['^'] ? '^' : '') + quoteRegExp( wrds[i] ) + (cmd['$'] ? '$' : ''),
					(cmd['i'] ? 'i' : '')
				) );
			}
		}
	}

	return [false, out];
};
toQuery.int = toBase.int;
toQuery.float = toBase.float;
toQuery.bool = toBase.bool;
toQuery.array = function( query ) {
	var arr = toBase.array( [ query ] );
	if ( arr[0] ) { return ['ошибка в параметре запроса', query]; }
	return [ false, arr[1][0] ];
};
toQuery.id = toBase.id;
toQuery.ids = function( query ) {
	var ids = toBase.ids( [query] );
	if ( ids[0] ) { return ['ошибка в параметре запроса', query]; }
	return [ false, ids[1][0] ];
};
toQuery.idpath = toQuery.ids;
toQuery.money = toBase.money;
toQuery.numeric = toBase.numeric;
toQuery.phone = toBase.phone;



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
	arrays: ARRAYS
};
