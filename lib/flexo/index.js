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
var DOC_PATH = '_path';



// Get documents by criteria or result length
checks.find = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
	['query', true, 'o', [ // единичный запрос; потому что на массив запросов невозможно быстро вернуть честный count
		['selector', true, 'o'], // поисковый запрос Mongo
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
	var argErr = checks.find( arguments );
	var i, keys, types;

	if ( argErr ) {
		callback( argErr );
		return;
	}

	types = SCHEMES[name].dict.types;

	// check types
	// работает только на равенствах
	keys = Object.keys( query.selector );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( typeof query.selector[keys[i]] !== 'object' && !flexoValidator.checkType[types[keys[i]].type]( query.selector[keys[i]] ) ) {
			callback( new Error( 'Property `' + keys[i] + '` must be type of `' + types[keys[i]].type + '`' ) );
			return;
		}
	}

	// prepare fields
	fields = fields.concat( [DOC_ID, DOC_CREATE, DOC_UPDATE] );

	STORAGE.find( name, {
		query: query,
		fields: fields
	}, options, callback );
};



// Create new document
checks.insert = argstype.getChecker( myErr, [
	['name', true, 's'], // название схемы
	['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
	['document', true, 'a', 'o'], // массив новых документов
	['options' , true, 'o'],
	['callback', true, 'f']
] );
container.insert = function( name, fields, document, options, callback ) {
	var argErr = checks.insert( arguments );
	var valid, depend, task;
	var i, j, doc, keys, key;
	var tasks = {};
	var docs = [];
	var scheme, dict;

	if ( argErr ) {
		callback( argErr );
		return;
	}

	scheme = SCHEMES[name].scheme;
	dict = SCHEMES[name].dict;

	fields = fields.concat( [DOC_ID, DOC_CREATE, DOC_UPDATE] );

	document = Array.isArray( document ) ? document : [document];

	// loop over docs to check and clone them
	for ( i = 0; i < document.length; i += 1 ) {
		doc = document[i];

		docs[i] = {};
		keys = Object.keys( doc );

		// check required root join properties
		for ( j = 0; j < dict.joinProperties.length; j += 1 ) {
			if ( keys.indexOf( dict.joinProperties[j] ) === -1 ) {
				callback( new Error( 'No join property `' + dict.joinProperties[j] + '` in root of document: ' + doc ) );
				return;
			}
		}

		for ( j = 0; j < keys.length; j += 1 ) {
			key = keys[j];

			// check for mutation of immutable properties
			if ( dict.mutable.indexOf( key ) === -1 ) {
				callback( new Error( 'Mutating immutable property `' + key + '` in document: ' + JSON.stringify( doc ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( doc[key], scheme.root[key] );
			if ( valid.length !== 0 ) {
				callback( [key, valid] );
				return;
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

	async.auto( tasks, function( error, results ) {
		var i, now;
		if ( error ) {
			callback( error );
			return;
		}

		now = Date.now();
		for ( i = 0; i < docs.length; i += 1 ) {
			docs[i][DOC_CREATE] = now;
			docs[i][DOC_UPDATE] = now;
		}

		// finally store documents
		STORAGE.insert( name, docs, function( error, result ) {
			var documents = [];
			var i, doc;

			if ( error ) {
				callback( error );
				return;
			}

			// fetch required fields
			for ( i = 0; i < result.length; i += 1 ) {
				doc = {};
				for ( j = 0; j < fields.length; j += 1 ) {
					doc[fields[j]] = result[i][fields[j]];
				}
				documents.push( doc );
			}

			// finally return stored documents
			callback( error, documents );
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
	var argErr = checks.brickTask( arguments );
	var i;
	var selector = {};
	selector[DOC_ID] = { '$in': [] };

	if ( argErr ) {
		callback( argErr );
		return;
	}

	// bind callback
	this.callback = callback;

	// loop over documents to prepare request for another brick
	// make request
	// loop over result to join required fields to document

	// loop over documents
	for ( i = 0; i < this.documents.length; i += 1 ) {
		selector[DOC_ID].$in.push( this.documents[i][this.brick.depend[1]] );
	}

	// async request joins
	STORAGE.find( this.brickName, { query: { selector: selector }, fields: this.brick.fields }, {}, brickTaskCallback.bind( this ) );
}

checks.brickTaskCallback = argstype.getChecker( myErr, [
	['error', true, 'o'],
	['results', false, 'a', [
		'*', false, 'o'
	]]
] );
function brickTaskCallback( error, results ) {
	// this.brickName
	// this.documents
	// this.callback
	// this.brick.depend
	// this.brick.fields
	var argErr = checks.brickTaskCallback( arguments );
	var i, j, element;
	var dict = {};

	if ( argErr ) {
		this.callback( argErr );
		return;
	}

	if ( error ) {
		this.callback( error );
		return;
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
			this.callback( new Error( 'Can\'t get join for document: ' + JSON.stringify( this.documents[i] ) ) );
			return;
		}
	}

	this.callback( error, true );
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

	var argErr = checks.modify( arguments );
	var valid;
	var storageQuery = [
		[], // simple query
		[], // complex query
		[]  // super-complex query
	];
	var tasks;
	var i, j, keys, complexity;
	var scheme, dict;

	if ( argErr ) {
		callback( argErr );
		return;
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
				callback( new Error( 'Mutating immutable property `' + keys[j] + '` in query: ' + JSON.stringify( query[i] ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( query[i].properties[keys[j]], scheme.root[keys[j]] );
			if ( valid.length !== 0 ) {
				callback( valid );
				return;
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
			callback( null, query );
			return;
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

		async.auto( tasks, function( error ) {
			if ( error ) {
				callback( error );
				return;
			}

			// return tasks
			callback( error, query );
		} );
	} );

	// run tasks
	async.parallel( tasks, function( error, data ) {
		var now, i, query = [];

		if ( error ) {
			callback( error );
			return;
		}

		now = Date.now();
		for ( i = 0; i < data.length; i += 1 ) {
			for ( j = 0; j < data[i].length; j += 1 ) {
				// set new tsUpdate
				data[i][j].properties[DOC_UPDATE] = now;
			}
			query = query.concat( data[i] );
		}

		STORAGE.modify( name, query, callback );
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
	var argErr = checks.delete( arguments );
	var i;

	if ( argErr ) {
		callback( argErr );
		return;
	}

	// delete documents
	STORAGE.delete( name, query, callback );
};



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
							['inline', false, 's']
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
	// callback( error ) - функция, получает ошибку если что-то пошло не так
	var argErr = checks.init( arguments );

	if ( argErr ) {
		callback( argErr );
		return;
	}

	if ( INITIALIZED ) { callback( new Error( 'Flexo reinitialization prohibited' ) ); }

	SCHEMES = options.schemes;
	STORAGE = options.storage;
	INITIALIZED = true;

	callback( null, container );
};



module.exports = {
	init: init
};
