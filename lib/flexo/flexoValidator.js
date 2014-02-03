'use strict';



var Validator = function( types ) {
	this.types = types;
	this.boundToBase = this.toBase.bind( this );
	this.boundToUser = this.toUser.bind( this );
};

// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
Validator.prototype.toBase = function( data, type, subtype ) {
	var result, subresult;
	if ( !this.types[type] ) { return [ 'нет такого типа данных', data ]; }
	if ( !this.types[type].save ) { return [ false, data ]; }

	try {
		result = this.types[type].save( data, subtype, this.boundToBase );
	} catch ( err ) {
		return [ 'не удалось провести проверку значения', data ];
	}

	if ( subtype ) {
		for ( var i = 0; i < result[1].length; i += 1 ) {
			subresult = this.createSubdoc( Object.keys( subtype ), subtype, result[1][i] );
			if ( subresult[0] ) { return [subresult[0], result[1]]; }
			result[1][i] = subresult[1];
		}
	}

	return result;
};

Validator.prototype.createSubdoc = function( fields, types, data ) {
	var i, out, res;
	var dataFields = Object.keys( data );

	for ( i = 0; i < dataFields.length; i += 1 ) {
		if ( fields.indexOf( dataFields[i] ) === -1 ) { return [ dataFields[i] + ' - недопустимое поле', data ]; }
	}

	out = {};
	for ( i = 0; i < fields.length; i += 1 ) {
		if ( data[ fields[i] ] === undefined ) {
			out[ fields[i] ] = this.types[ types[ fields[i] ].type ].default();
		} else {
			res = this.toBase( data[ fields[i] ], types[ fields[i] ].type );
			if ( res[0] ) { return [ fields[i] + '.' + res[0], data ]; }
			out[ fields[i] ] = res[1];
		}
	}

	return [ false, out ];
};



// приведение типа возвращает массив, где в 0 - ошибка, в 1 - результат трансформации
Validator.prototype.toUser = function( data, type, subtype ) {
	var result, obj, keys, subresult;
	if ( !this.types[type] ) { return [ 'нет такого типа данных', data ]; }
	if ( !this.types[ type ].read ) { return [ false, data ]; }

	try {
		result = this.types[ type ].read( data, subtype, this.boundToUser );
	} catch ( err ) {
		return [ 'не удалось провести преобразование значения', data ];
	}

	if ( subtype ) {
		if ( result[1].length ) {
			keys = Object.keys( result[1][0] );
		}

		for ( var i = 0; i < result[1].length; i += 1 ) {
			obj = {};
			for ( var j = 0; j < keys.length; j += 1 ) {
				if ( !subtype[ keys[j] ] ) { return ['недоступное вложенное поле `' + keys[j] + '`', result[1]]; }

				subresult = this.toUser( result[1][i][ keys[j] ], subtype[ keys[j] ].type, subtype[ keys[j] ].subtype );
				if ( subresult[0] ) { return [subresult[0], result[1]]; }

				obj[ keys[j] ] = subresult[1];
			}
			result[1][i] = obj;
		}
	}

	return result;
};



// проверка возвращает массив, где в 0 - ошибка, в 1 - результат приведения типа
Validator.prototype.checkQuery = function( data, type ) {
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
Validator.prototype.toQuery = function( data, type ) {
	var check, keys, el, i, t;
	var res = {};
	var queue = [
		[data, 'data', res]
	];

	while ( queue.length ) {
		el = queue.shift();

		if ( el[0] === null || typeof el[0] !== 'object' ) {
			check = this.checkQuery( el[0], type );
			if ( check[0] ) { return ['ошибка в параметре запроса', data]; }
			t = check[1];
		} else {
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
		}

		el[2][el[1]] = t;
	}

	return [false, res.data];
};



module.exports = exports = Validator;
