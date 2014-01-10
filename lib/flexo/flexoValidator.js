'use strict';



var Validator = function( types ) {
	this.types = types;
	this.boundToBase = this.toBase.bind( this );
	this.boundToUser = this.toUser.bind( this );
};

// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
Validator.toBase = function( data, type, subtype ) {
	var result;
	if ( !this.types[type] ) { return [ 'нет такого типа данных', data ]; }
	if ( !this.types[type].save ) { return [ false, data ]; }
	try {
		result = this.types[type].save( data, subtype, this.boundToBase );
	} catch ( err ) {
		return [ 'не удалось провести проверку значения', data ];
	}
	return result;
};



// приведение типа возвращает массив, где в 0 - ошибка, в 1 - результат трансформации
Validator.toUser = function( data, type, subtype ) {
	var result;
	if ( !this.types[type] ) { return [ 'нет такого типа данных', data ]; }
	if ( !this.types[ type ].read ) { return [ false, data ]; }
	try {
		result = this.types[ type ].read( data, subtype, this.boundToUser );
	} catch ( err ) {
		return [ 'не удалось провести преобразование значения', data ];
	}
	return result;
};



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
Validator.checkQuery = function( data, type ) {
	var result;
	if ( !this.types[type] ) { return [ 'нет такого типа данных', data ]; }
	if ( !this.types[ type ].find ) { return [ false, data ]; }
	try {
		result = this.types[ type ].find( data );
	} catch ( err ) {
		return [ 'не удалось провести проверку запроса', data ];
	}
	return result;
};



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
Validator.toQuery = function( data, type ) {
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
			check = this.checkQuery( el[0], type );
			if ( check[0] ) { return ['ошибка в параметре запроса', data]; }
			t = check[1];
		}

		el[2][el[1]] = t;
	}

	return [false, res.data];
};



module.exports = exports = Validator;
