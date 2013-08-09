'use strict';

var log = process.env.DEBUG ? console.log : function() {};

var Container = {};
var Counter = 0;

// Constructor
var Storage = function( scheme, fields ) {
	Container[scheme] = Container[scheme] || [];
	this.scheme = scheme;
};

// Производит поиск документов соответствующих запросу
// Возвращает количество подходящих документов или документы, иначе ошибку
// request = {
//     query: [{
//         selector: {},
//         options: {
//             limit: 10,
//             skip: 0,
//             sort: [{ name: 1 }]
//             hint: {}
//         }
//     }],
//     fields: [],
//     count
// }
Storage.prototype.find = function( request, count, callback ) {
	var timeout = parseInt( Math.random() * 100, 10 );
	var scheme = this.scheme;
	var ids, i, j;
	var res = [];

	if ( request && request.query && request.query.selector && request.query.selector._id !== undefined ) {
		if ( typeof request.query.selector._id === 'object' ) {
			ids = request.query.selector._id.$in;
		} else {
			ids = request.query.selector._id;
		}

		i = 0;
		while ( i <= ids.length ) {
			j = ids.indexOf( ids[i], i + 1 );
			while ( j !== -1 ) {
				ids.splice( j, 1 );
				j = ids.indexOf( ids[i], i + 1 );
			}
			i += 1;
		}

		for ( j = 0; j < ids.length; j += 1 ) {
			for ( i = 0; i < Container[scheme].length; i += 1 ) {
				if ( Container[scheme][i]._id === ids[j] ) {
					res.push( Container[scheme][i] );
					break;
				}
			}
		}
	} else {
		res = Container[scheme];
	}

	setTimeout( function() {
		callback( null, res, (count ? res.length : undefined) );
	}, timeout );
};

// Сохраняет документы как новые
// Возвращает ОК, иначе несохраненные документы
Storage.prototype.insert = function( docs, callback ) {
	var timeout = parseInt( Math.random() * 100, 10 );
	var scheme = this.scheme;

	setTimeout( function() {
		var i, j, k, keys;
		var now = Date.now();
		var res = [];

		for ( i = 0, j = Container[scheme].length; i < docs.length; i += 1, j += 1, Counter += 1 ) {
			Container[scheme][j] = {};

			keys = Object.keys( docs[i] );
			for ( k = 0; k < keys.length; k += 1 ) {
				if ( Array.isArray( Container[scheme][j][keys[k]] ) ) {
					Container[scheme][j][keys[k]] = docs[i][keys[k]].concat();
				} else {
					Container[scheme][j][keys[k]] = docs[i][keys[k]];
				}
			}

			Container[scheme][j]._id = Counter.toString( 36 );
			Container[scheme][j].tsCreate = now;
			Container[scheme][j].tsUpdate = now;

			res.push( Container[scheme][j] );
		}

		callback( null, res );
	}, timeout );
};

// Изменяет документы соответствующие запросу
// Возвращает измененные и/или исходные документы или количество измененных документов, иначе ошибку
// request = {
//     query: [{
//         selector: {},
//         properties: {},
//         options: {
//             limit: 10,
//             skip: 0,
//             sort: [{ name: 1 }],
//             hint: {}
//         }
//     }],
//     fields: [],
//     count
// }
Storage.prototype.modify = function( query, callback ) {
	// для каждого документа выполняет mongo.findAndModify( request.selector, {_id: 1}, request.properties)
	var timeout = parseInt( Math.random() * 100, 10 );
	var scheme = this.scheme;

	setTimeout( function() {
		var i, j, k, keys;
		var now = Date.now();
		var out = [];

		for ( i = 0; i < query.length; i += 1 ) {
			for ( j = 0; j < Container[scheme].length; j += 1 ) {
				if ( Container[scheme][j]._id === query[i].selector._id ) {
					keys = Object.keys( query[i].properties );
					for ( k = 0; k < keys.length; k += 1 ) {
						if ( Array.isArray( query[i].properties[keys[k]] ) ) {
							Container[scheme][j][keys[k]] = query[i].properties[keys[k]].concat();
						} else {
							Container[scheme][j][keys[k]] = query[i].properties[keys[k]];
						}
					}
					Container[scheme][j].tsUpdate = now;

					out.push( {_id: Container[scheme][j]._id, tsUpdate: now} );

					break;
				}
			}
		}

		callback( null, out );
	}, timeout );
};

// Удаляет все документы соответствующие запросу
// Возвращает массив _id удаленных документов или количество удаленных документов, иначе ошибку
Storage.prototype.delete = function( query, callback ) {
	var timeout = parseInt( Math.random() * 100, 10 );
	var scheme = this.scheme;

	setTimeout( function() {
		var i, j;
		var out = [];

		for ( i = 0; i < query.length; i += 1 ) {
			for ( j = 0; j < Container[scheme].length; j += 1 ) {
				if ( Container[scheme][j]._id === query[i].selector._id ) {

					out.push( {_id: Container[scheme][j]._id} );

					Container[scheme].splice( j, 1 );

					break;
				}
			}
		}

		callback( null, out );
	}, timeout );
};



module.exports = {
	New: Storage,
	init: function( options, callback ) { callback(); },
	status: function() { return 'conneted'; }
};
