'use strict';

var log = function() {};
if ( process.env.DEBUG ) { log = console.log; }



var argstype = require( 'f0.argstype' );
var async = require( 'async' );
var flexoValidator = require( './flexoValidator' );



var init;
var container = {};
var checks = {};
function myErr( text ) {
	return ( new Error( 'f0.flexo: ' + text ));
}



var INITIALIZED;
var STORAGE;
var SCHEMES;

var DOC_ID = '_id';
var DOC_CREATE = 'tsCreate';
var DOC_UPDATE = 'tsUpdate';



// Get documents by criteria or result length
checks.find = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
	['query', true, 'o', [ // единичный запрос; потому что на массив запросов невозможно быстро вернуть честный count
		['selector', true, 'a'], // поисковый запрос Mongo
		['options', false, 'o', [
			['sort', false, 'o'], // объект, правило сортировки Mongo
			['skip', false, 'n'], // смещение ограничения количества результатов поиска
			['limit', false, 'n'] // ограничение количества результатов поиска
		]]
	]],
	['options', true, 'o', [
		['count', false, 'b'] // запрос количества документов удовлетворяющих запросу
	]],
	['callback', true, 'f']
] );
container.find = function( name, fields, query, options, callback ) {
	var errType = checks.find( arguments );
	var i, types, reqFields = [DOC_ID, DOC_CREATE, DOC_UPDATE];
	var queryOptions;

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	types = SCHEMES[name].dict.types;
	queryOptions = query.options || {};

	// check types
	// работает только на равенствах
	// TODO: сделать работу на неравенствах и других сложных структурах
	for ( i = 0; i < query.selector; i += 2 ) {
		if ( !Array.isArray( query.selector[i + 1] ) && !flexoValidator.checkType[types[query.selector[i]].type]( query.selector[i + 1] ) ) {
			return process.nextTick( callback.bind( null, myErr( 'Property `' + query.selector[i] + '` must be type of `' + types[query.selector[i]].type + '`' ) ) );
		}
	}

	// prepare fields
	for ( i = 0; i < fields.length; i += 1 ) {
		if ( reqFields.indexOf( fields[i] ) === -1 ) {
			reqFields.push( fields[i] );
		}
	}

	return STORAGE.find( [
		name,
		query.selector,
		reqFields,
		[queryOptions.sort, queryOptions.limit, queryOptions.skip, options.count]
	], callback );
};



checks.aggregate = argstype.getChecker( myErr, [
	['name', true, 's'],
	['pipeline', true, 'a', 'o'],
	['callback', true, 'f']
] );
container.aggregate = function( name, pipeline, callback ) {
	var errType = checks.aggregate( arguments );
//	var i, pipe = [];

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

//	for ( i = 0; i < pipeline.length; i += 1 ) {
//		if ( pipeline[i].$match !== undefined ) {
//			pipe.push( selectorObjectToArray( pipeline[i] ) );
//		} else {
//			pipe.push( pipeline[i] );
//		}
//	}

	return STORAGE.aggregate( [ name, pipeline ], callback );
};



// Create new document
checks.insert = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
	['documents', true, 'a', 'o'], // массив новых документов
	['options' , true, 'o'],
	['callback', true, 'f']
] );
container.insert = function( name, fields, documents, options, callback ) {
	var errType = checks.insert( arguments );
	var valid, depend, task;
	var i, j, doc, keys, key;
	var tasks = {};
	var docs = [];
	var scheme, dict;
	var reqFields = [DOC_ID, DOC_CREATE, DOC_UPDATE];

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	scheme = SCHEMES[name].scheme;
	dict = SCHEMES[name].dict;

	// prepare fields
	for ( i = 0; i < fields.length; i += 1 ) {
		if ( reqFields.indexOf( fields[i] ) === -1 ) {
			reqFields.push( fields[i] );
		}
	}

	// loop over docs to check and clone them
	for ( i = 0; i < documents.length; i += 1 ) {
		doc = documents[i];

		docs[i] = {};
		keys = Object.keys( doc );

		// check required root join properties
		for ( j = 0; j < dict.joinProperties.length; j += 1 ) {
			if ( keys.indexOf( dict.joinProperties[j] ) === -1 ) {
				return process.nextTick( callback.bind( null, myErr( 'No join property `' + dict.joinProperties[j] + '` in root of document: ' + doc ) ) );
			}
		}

		for ( j = 0; j < keys.length; j += 1 ) {
			key = keys[j];

			// check for mutation of immutable properties
			if ( dict.mutable.indexOf( key ) === -1 ) {
				return process.nextTick( callback.bind( null, myErr( 'Mutating immutable property `' + key + '` in document: ' + JSON.stringify( doc ) ) ) );
			}

			// check types, validate
			valid = flexoValidator.validate( doc[key], scheme.root[key] );
			if ( valid.length !== 0 ) {
				return process.nextTick( callback.bind( null, myErr( 'ошибка данных в поле `' + key + '` - ' + JSON.stringify( valid ) ) ) );
			}

			// clone properties;
			docs[i][key] = doc[key];
		}
	}
	// looks like properties are fine

	// let's prepare brick-joining tasks
	// every task requests data for documents via `OR` statement
	// so here we loop over joining bricks to create these tasks

	for ( i = 0; i < dict.joins.length; i += 1 ) {
		depend = scheme.join[dict.joins[i]].depend;

		// get brick dependency
		task = (depend[0] === 'root') ? [] : [ depend[0] ];

		// join task function
		task.push( brickTask.bind( { brickName: dict.joins[i], brick: scheme.join[dict.joins[i]], documents: docs } ) );

		tasks[dict.joins[i]] = task;
	}

	return async.auto( tasks, function( err, results ) {
		var i, now;
		if ( err ) {
			return callback( err );
		}

		now = Date.now();
		for ( i = 0; i < docs.length; i += 1 ) {
			docs[i][DOC_CREATE] = now;
			docs[i][DOC_UPDATE] = now;
		}

		// finally store documents
		return STORAGE.insert( name, docs, function( err, result ) {
			var documents = [];
			var i, doc;

			if ( err ) {
				return callback( err );
			}

			// fetch required fields
			for ( i = 0; i < result.length; i += 1 ) {
				doc = {};
				for ( j = 0; j < reqFields.length; j += 1 ) {
					doc[reqFields[j]] = result[i][reqFields[j]];
				}
				documents.push( doc );
			}

			// finally return stored documents
			return callback( err, documents );
		} );
	} );
};



// block-retrieving surrogate task
checks.brickTask = argstype.getChecker( myErr, [
	['callback', true, 'f']
] );
function brickTask( callback ) {
	// this.brickName
	// this.brick.depend
	// this.brick.fields
	// this.documents
	var errType = checks.brickTask( arguments );
	var i;
	var selector = [ DOC_ID, [ '$in' ]];

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	// bind callback
	this.callback = callback;

	// loop over documents to prepare request for another brick
	// make request
	// loop over result to join required fields to document

	// loop over documents
	for ( i = 0; i < this.documents.length; i += 1 ) {
		selector[1].push( this.documents[i][this.brick.depend[1]] );
	}

	// async request joins
	return STORAGE.find( [
		this.brickName,
		selector,
		this.brick.fields
	], brickTaskCallback.bind( this ) );
}

checks.brickTaskCallback = argstype.getChecker( myErr, [
	['err', true, 'o'],
	['results', false, 'a', [
		'*', false, 'o'
	]]
] );
function brickTaskCallback( err, results ) {
	// this.brickName
	// this.documents
	// this.callback
	// this.brick.depend
	// this.brick.fields
	var errType = checks.brickTaskCallback( arguments );
	var i, j, element;
	var dict = {};

	if ( errType ) {
		return this.callback( errType );
	}

	if ( err ) {
		return this.callback( err );
	}

	for ( i = 0; i < results.length; i += 1 ) {
		dict[results[i][DOC_ID]] = results[i];
	}

	// TODO: what if I put all results into Collectioner and make a find() in it?
	// loop over documents
	for ( i = 0; i < this.documents.length; i += 1 ) {
		if ( dict[this.documents[i][this.brick.depend[1]]] !== undefined ) {
			element = dict[this.documents[i][this.brick.depend[1]]];
			for ( j = 0; j < this.brick.fields.length; j += 1 ) {
				this.documents[i][(this.brickName + '_' + this.brick.fields[j])] = element[this.brick.fields[j]];
			}
		} else {
			return this.callback( myErr( 'Can\'t get join for document: ' + JSON.stringify( this.documents[i] ) ) );
		}
	}

	return this.callback( err, true );
}



// Import and save updates
checks.modify = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['query', true, 'a', [
		'*', true, 'o', [
			['selector', true, 'o', [ // поисковый запрос Mongo
				[DOC_ID, true, 's'],
				[DOC_UPDATE, true, 'n']
			]],
			['properties', true, 'o'] // новые значения документа
		]
	]],
	['options', true, 'o'],
	['callback', true, 'f']
] );
container.modify = function( name, query, options, callback ) {
	// loop over values to check all properties are mutableProperties
	// on rootJoinsProperties change - act like insert, otherwise just update

	var errType = checks.modify( arguments );
	var valid;
	var storageQuery = [
		[], // simple query
		[], // complex query
		[]  // super-complex query
	];
	var tasks;
	var i, j, keys, complexity;
	var scheme, dict;

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	scheme = SCHEMES[name].scheme;
	dict = SCHEMES[name].dict;

	// loop over queries to check and clone them
	for ( i = 0; i < query.length; i += 1 ) {
		complexity = 0;

		// check properties
		keys = Object.keys( query[i].properties );
		for ( j = 0; j < keys.length; j += 1 ) {

			// check for mutation of immutable properties
			if ( dict.mutable.indexOf( keys[j] ) === -1 ) {
				return process.nextTick( callback.bind( null, myErr( 'Mutating immutable property `' + keys[j] + '` in query: ' + JSON.stringify( query[i] ) ) ) );
			}

			// check types, validate
			valid = flexoValidator.validate( query[i].properties[keys[j]], scheme.root[keys[j]] );
			if ( valid.length !== 0 ) {
				return process.nextTick( callback.bind( null, valid ) );
			}

			// sort queries for simple and complex
			if ( dict.joinProperties.indexOf( keys[j] ) !== -1 && complexity < 1 ) {
				complexity = 1;
			}
		}

		// do only tasks with non-empty properties
		if ( keys.length > 0 ) {
			storageQuery[complexity].push( query[i] );
		}
	}
	// looks like properties are fine


	// if no join-fields change - simple query - pass to Storage
	// if all dependent joins (and their subjoins) depend only on changed fields - complex query - request join, pass to Storage
	// else - complex join query - find all documents, join-up, pass to Storage

	// complexJoinQuery
	// find documents
	// join-up bricks
	// save

	// prepare modification tasks
	tasks = [];

	tasks.push( function( callback ) {
		// simple
		callback( null, storageQuery[0] );
	} );

	tasks.push( function( callback ) {
		// complex
		// super-complex
		var task, tasks = [];
		var depend, i;

		var query = storageQuery[1].concat( storageQuery[2] );
		var documents = [];

		if ( query.length === 0 ) {
			return process.nextTick( callback.bind( null, null, query ) );
		}

		for ( i = 0; i < query.length; i += 1 ) {
			documents[i] = query[i].properties;
		}

		// prepare join-up tasks
		for ( i = 0; i < dict.joins.length; i += 1 ) {
			depend = scheme.join[dict.joins[i]].depend;

			// get brick dependency
			task = (depend[0] === 'root') ? [] : [ depend[0] ];

			// join task function
			task.push( brickTask.bind( { brickName: dict.joins[i], brick: scheme.join[dict.joins[i]], documents: documents } ) );

			tasks[dict.joins[i]] = task;
		}

		return async.auto( tasks, function( err ) {
			if ( err ) {
				return callback( err );
			}

			// return tasks
			return callback( null, query );
		} );
	} );

	// run tasks
	return async.parallel( tasks, function( err, data ) {
		var now, i, query = [];

		if ( err ) {
			return callback( err );
		}

		now = Date.now();
		for ( i = 0; i < data.length; i += 1 ) {
			for ( j = 0; j < data[i].length; j += 1 ) {
				// set new tsUpdate
				data[i][j].properties[DOC_UPDATE] = now;
			}
			query = query.concat( data[i] );
		}

		return STORAGE.modify( name, query, callback );
	} );
};



// Mark documents as deleted
checks.delete = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['query', true, 'a', [
		'*', true, 'o', [
			['selector', true, 'o', [ // поисковый запрос Mongo
				[DOC_ID, true, 's'],
				[DOC_UPDATE, true, 'n']
			]]
		]
	]],
	['options', true, 'o'],
	['callback', true, 'f']
] );
container.delete = function( name, query, options, callback ) {
	var errType = checks.delete( arguments );
	var i;

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	// delete documents
	return STORAGE.delete( name, query, callback );
};



function selectorObjectToArray( selector ) {
	var i, j, keys, node;
	var res = [];
	var queue = [];

	queue.push( {elem: selector, out: res} );
	while ( queue.length > 0 ) {
		node = queue.shift();

		keys = Object.keys( node.elem );

		for ( i = 0; i < keys.length; i += 1 ) {
			// key
			if ( keys[i] === '$elemMatch' ) {
				node.out.push( '$em' );
			} else {
				node.out.push( keys[i] );
			}

			// value
			if ( keys[i] === '$in' ) {
				for ( j = 0; j < node.elem[keys[i]].length; j += 1 ) {
					node.out.push( node.elem[keys[i]][j] );
				}
				continue;
			}

			if ( Array.isArray( node.elem[keys[i]] ) ) {
				node.out.push( [] );
				for ( j = 0; j < node.elem[keys[i]].length; j += 1 ) {
					queue.push( { elem: node.elem[keys[i]][j], out: node.out[node.out.length - 1]} );
				}
			} else if ( typeof node.elem[keys[i]] === 'object' ) {
				node.out.push( [] );
				queue.push( { elem: node.elem[keys[i]], out: node.out[node.out.length - 1]} );
			} else {
				node.out.push( node.elem[keys[i]] );
			}
		}
	}

	return res;
}



// set constants, precache schemes
checks.init = argstype.getChecker( myErr, [
	['options', true, 'o', [
		['storage', true, 'o', [ // функции работы с хранилищем
			['find', true, 'f'],
			['insert', true, 'f'],
			['modify', true, 'f'],
			['delete', true, 'f']
		]],
		['schemes', true, 'o', [ // доступные схемы со справочниками
			'*', false, 'o', [
				['scheme', true, 'o', [ // валидация схем
					['name', true, 's'],
					['root', true, 'o', [
						'*', true, 'o', [
							['type', false, 's'],
							['of', false, 's'],
							['from', false, 's'],
							['link', false, 's']
						]
					]],
					['join', false, 'o', [
						'*', false, 'o', [
							['fields', true, 'a', 's'],
							['depend', true, 'a', [
								['scheme', true, 's'],
								['root-field', true, 's']
							]]
						]
					]]
				]],
				['dict', true, 'o', [ // валидация справочников
					['all', true, 'a', 's'],
					['mutable', true, 'a', 's'],
					['joinProperties', true, 'a', [
						'*', false, 's'
					]],
					['joins', true, 'a', [
						'*', false, 's'
					]],
					['types', true, 'o', [
						'*', true, 'o', [
							['type', true, 's'],
							['of', false, 's'],
							['from', false, 's'],
							['link', false, 's']
						]
					]]
				]]
			]
		]]
	]],
	['callback', true, 'f']
] );
init = function( options, callback ) {
	// options - объект
	// options.storage - объект, содержит 
	// options.schemes - объект, содержит 
	// callback( err ) - функция, получает ошибку если что-то пошло не так
	var errType = checks.init( arguments );

	if ( errType ) {
		return process.nextTick( callback.bind( null, errType ) );
	}

	if ( INITIALIZED ) { callback( myErr( 'Flexo reinitialization prohibited' ) ); }

	SCHEMES = options.schemes;
	STORAGE = options.storage;
	INITIALIZED = true;

	return process.nextTick( callback.bind( null, null, container ) );
};



module.exports = {
	init: init
};
