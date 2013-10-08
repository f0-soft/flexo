'use strict';

var log = function() {};
if ( process.env.DEBUG ) { log = console.log;}

var Container = {};
var Counter = 0;

// Constructor
var Storage = function( scheme, fields ) {
	Container[scheme] = Container[scheme] || [];
	this.scheme = scheme;
};

Storage = {};

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
Storage.find = function( query, callback ) {
	var timeout = parseInt( Math.random() * 10, 10 );
	var ids, ids_out, i, j;
	var res = [];

	Container[query.collname] = Container[query.collname] || [];

	if ( query.selector._id !== undefined ) {

		if ( Array.isArray( query.selector._id ) ) {
			ids = query.selector._id;
		} else {
			ids = [ query.selector._id ];
		}

		ids_out = [];
		for ( i = 0; i < ids.length; i += 1 ) {
			if ( ids_out.indexOf( ids[i] ) === -1 ) {
				ids_out.push( ids[i] );
			}
		}

		for ( j = 0; j < ids_out.length; j += 1 ) {
			for ( i = 0; i < Container[query.collname].length; i += 1 ) {
				if ( Container[query.collname][i]._id === ids_out[j] ) {
					res.push( Container[query.collname][i] );
					break;
				}
			}
		}
	} else {
		res = Container[query.collname];
	}

	return setTimeout( callback.bind( null, null, {result: res, count: ( (query.options && query.options.count) ? res.length : undefined )} ), timeout );
};

// Сохраняет документы как новые
// Возвращает ОК, иначе несохраненные документы
Storage.insert = function( collection, docs, callback ) {
	var timeout = parseInt( Math.random() * 10, 10 );

	Container[collection] = Container[collection] || [];

	setTimeout( function() {
		var i, j, k, keys;
		var now = Date.now();
		var res = [];

		for ( i = 0, j = Container[collection].length; i < docs.length; i += 1, j += 1, Counter += 1 ) {
			Container[collection][j] = {};

			keys = Object.keys( docs[i] );
			for ( k = 0; k < keys.length; k += 1 ) {
				if ( Array.isArray( Container[collection][j][keys[k]] ) ) {
					Container[collection][j][keys[k]] = docs[i][keys[k]].concat();
				} else {
					Container[collection][j][keys[k]] = docs[i][keys[k]];
				}
			}

			Container[collection][j]._id = Counter.toString( 36 );
			Container[collection][j].tsCreate = now;
			Container[collection][j].tsUpdate = now;

			res.push( Container[collection][j] );
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
Storage.modify = function( collection, query, callback ) {
	// для каждого документа выполняет mongo.findAndModify( request.selector, {_id: 1}, request.properties)
	var timeout = parseInt( Math.random() * 10, 10 );

	Container[collection] = Container[collection] || [];

	setTimeout( function() {
		var i, j, k, keys;
		var now = Date.now();
		var out = [];

		for ( i = 0; i < query.length; i += 1 ) {
			for ( j = 0; j < Container[collection].length; j += 1 ) {
				if ( Container[collection][j]._id === query[i].selector._id ) {
					keys = Object.keys( query[i].properties );
					for ( k = 0; k < keys.length; k += 1 ) {
						if ( Array.isArray( query[i].properties[keys[k]] ) ) {
							Container[collection][j][keys[k]] = query[i].properties[keys[k]].concat();
						} else {
							Container[collection][j][keys[k]] = query[i].properties[keys[k]];
						}
					}
					Container[collection][j].tsUpdate = now;

					out.push( {_id: Container[collection][j]._id, tsUpdate: now} );

					break;
				}
			}
		}

		callback( null, out );
	}, timeout );
};

// Удаляет все документы соответствующие запросу
// Возвращает массив _id удаленных документов или количество удаленных документов, иначе ошибку
Storage.delete = function( collection, query, callback ) {
	var timeout = parseInt( Math.random() * 10, 10 );

	Container[collection] = Container[collection] || [];

	setTimeout( function() {
		var i, j;
		var out = [];

		for ( i = 0; i < query.length; i += 1 ) {
			for ( j = 0; j < Container[collection].length; j += 1 ) {
				if ( Container[collection][j]._id === query[i]._id ) {

					out.push( {_id: Container[collection][j]._id} );

					Container[collection].splice( j, 1 );

					break;
				}
			}
		}

		callback( null, out );
	}, timeout );
};



module.exports = {
	init: function( options, callback ) { callback( null, Storage ); },
	status: function() { return 'conneted'; },
	find: Storage.find,
	insert: Storage.insert,
	modify: Storage.modify,
	delete: Storage.delete
};
