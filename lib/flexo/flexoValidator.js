'use strict';

var reopcode = require( './re-opcode' );
var sanitize = require( 'validator' ).sanitize;

var TYPES = {};
var ARRAYS = {};
var DEFAULTS = {
	str: function() { return ''; },
	words: function() { return ''; },
	strs: function() { return []; },
	int: function() { return 0; },
	float: function() { return 0; },
	bool: function() { return false; },
	array: function() { return []; },
	id: function() { return []; },
	money: function() { return 0; },
	numeric: function() { return ''; },
	phone: function() { return ''; }
};

function quoteRegExp( str ) {
	return str.replace( /([.?*+^$[\]\\(){}|-])/g, "\\$1" );
}



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
function processToBase( data, type ) {
	var result;
	if ( !toBase[type] ) { return [ 'нет такого типа данных', data ]; }
	try {
		result = toBase[type]( data );
	} catch ( err ) {
		return [ 'не удалось провести проверку значения', data ];
	}
	return result;
}

var toBase = {};
toBase.str = function( elem ) {
	if ( elem === undefined || elem === null ) { return [ true, DEFAULTS.str() ]; } // default value
	return [ false, ( '' + elem ).trim() ];
};
toBase.words = toBase.str;
toBase.int = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return ['не удалось преобразовать к типу `int`', str[1]]; }
	if ( !str[1].length ) { return [ false, DEFAULTS.int() ]; } // default value
	var int = parseInt( str[1] );
	if ( str[1] !== int.toString() ) { return [ 'значение не соответствует типу `int`', str[1] ]; }
	return [ false, int ];
};
toBase.float = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `float`', str[1] ]; }
	if ( !str[1].length ) { return [ false, DEFAULTS.float() ]; } // default value
	var flt = parseFloat( str[1] );
	if ( str[1] !== flt.toString() ) { return [ 'значение не соответствует типу `float`', str[1] ]; }
	return [ false, flt ];
};
toBase.bool = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `bool`', str[1] ]; }
	if ( !str[1].length ) { return [ false, DEFAULTS.bool() ]; } // default value

	var falses = /^(|0|false)$/;
	if ( falses.test( str[1] ) ) { return [ false, false ]; }

	var trues = /^(.*|1|true)$/;
	if ( trues.test( str[1] ) ) { return [ false, true ]; }

	return [ 'не удалось преобразовать к типу `bool`', str[1] ];
};
ARRAYS['array'] = true;
toBase.array = function( elem ) {
	if ( Array.isArray( elem ) ) { return [ false, elem ]; }
	var str = toBase.str( elem );
	if ( str[0] ) { return str; }
	if ( !str[1].length ) { return [ false, DEFAULTS.array() ]; } // default value
	return [ false, [ str[1] ] ];
};
ARRAYS['strs'] = true;
toBase.strs = function( elem ) {
	var arr = toBase.array( elem );
	if ( arr[0] ) { return [ 'не удалось преобразовать к типу `strs`', arr[1] ]; }
	if ( !arr[1].length ) { return [ false, DEFAULTS.strs() ]; } // default value
	for ( var i = 0; i < arr[1].length; i += 1 ) {
		var el = toBase.str( arr[1][i] );
		if ( el[0] ) { return [ 'элемент `' + i + '` не соответствует типу `strs`', arr[1] ]; }
	}
	return [ false, arr[1] ];
};
toBase._id = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `_id`', str[1] ]; }
	var reg = /^\w{2}[\da-z]+$/;
	return [ !reg.test( str[1] ), str[1] ];
};
ARRAYS['id'] = true;
toBase.id = function( elem ) {
	var arr = toBase.array( elem );
	if ( arr[0] ) { return [ 'не удалось преобразовать к типу `id`', arr[1] ]; }
	if ( !arr[1].length ) { return [ false, DEFAULTS.id() ]; } // default value
	for ( var i = 0; i < arr[1].length; i += 1 ) {
		var el = toBase._id( arr[1][i] );
		if ( el[0] ) { return [ 'элемент `' + i + '` не соответствует типу `id`', arr[1] ]; }
	}
	return [ false, arr[1] ];
};
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
	if ( !str[1].length ) { return [ false, DEFAULTS.numeric() ]; } // default value
	var reg = /^\d+$/;
	return [ !reg.test( str[1] ), str[1] ];
};
toBase.phone = function( elem ) {
	var str = toBase.str( elem );
	if ( str[0] ) { return [ 'не удалось преобразовать к типу `phone`', elem ]; }
	if ( !str[1].length ) { return [ false, DEFAULTS.phone() ]; } // default value
	var regIn = /^\(\d{3}\)\d{3}\-\d{2}\-\d{2}$/;
	var regOut = /\d/g;
	return [ !regIn.test( str[1] ), '7' + (str[1].match( regOut ) || []).join( '' ) ];
};



// приведение типа возвращает массив, где в 0 - ошибка, в 1 - результат трансформации
function processToUser( data, type ) {
	var result;
	if ( !toUser[type] ) { return [false, data]; }
	try {
		result = toUser[ type ]( data );
	} catch ( err ) {
		return [ 'не удалось провести преобразование значения', data ];
	}
	return result;
}

var toUser = {};
toUser.money = function( elem ) {
	return [false, elem / 100];
};
toUser.array = function( elem ) {
	if ( !elem ) { return [false, []]; }
	return [false, elem];
};
toUser.id = toUser.array;
toUser.strs = toUser.array;
toUser.phone = function( elem ) {
	if ( !elem.length ) { return [false, elem]; }

	var regOut = /.(...)(...)(..)(..)/;
	if ( !regOut.test( elem ) ) { return [false, elem]; }

	var res = elem[1].match( regOut );
	return [
		false,
		'(' + res[1] + ')' + res[2] + '-' + res[3] + '-' + res[4]
	];
};



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
toQuery.str = function( query ) {
	var res = toBase.str( query );
	if ( res[0] ) { return [ true, query ]; }
	res = reopcode.split( res[1] );
	var cmd = res[0];
	var str = processToBase( res[1], 'str' );
	if ( str[0] ) { return 'ошибка в параметре запроса'; }
	str = str[1];

	if ( cmd['^'] && cmd['$'] && !cmd['i'] ) {
		return [ false, str ];
	} else {
		return [ false, new RegExp(
			(cmd['^'] ? '^' : '') + quoteRegExp( str ) + (cmd['$'] ? '$' : ''),
			(cmd['i'] ? 'i' : '')
		) ];
	}
};
toQuery.strs = toQuery.str;

var nonWordRegexp = /[^a-zA-Zа-яА-Я0-9]/gi;
toQuery.words = function( query ) {
	var wrds = processToBase( query, 'words' );
	if ( wrds[0] ) { return ['ошибка в параметре запроса', query]; }

	// если управляющий символ - регулярка
	if ( reopcode.hasOpcode( wrds[1] ) ) {
		wrds = wrds[1];
		return toQuery.str( wrds );
	}

	// к нижнему регистру
	wrds = wrds[1].toLowerCase();

	// заменить пунктуацию на пробелы
	wrds = wrds.replace( nonWordRegexp, ' ' );

	// разбить на слова по пробелам
	wrds = wrds.split( ' ' );

	// массив регулярок /^text/ через $in
	var out = [];
	for ( var i = 0; i < wrds.length; i += 1 ) {
		if ( wrds[i].length ) {
			out.push( new RegExp( '^' + wrds[i] ) );
		}
	}

	if ( !out.length ) { return ['запрос должен включать в себя буквенно-цифровые символы', query]; }

	return [ false, { $in: out } ];
};
toQuery.int = toBase.int;
toQuery.float = toBase.float;
toQuery.bool = toBase.bool;
toQuery.array = function( query ) {
	var arr = toBase.array( [ query ] );
	if ( arr[0] ) { return ['ошибка в параметре запроса', query]; }
	return [ false, arr[1][0] ];
};
toQuery._id = toBase._id;
toQuery.id = function( query ) {
	var ids = toBase.id( [query] );
	if ( ids[0] ) { return ['ошибка в параметре запроса', query]; }
	return [ false, ids[1][0] ];
};
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
	arrays: ARRAYS,
	defaults: DEFAULTS
};
