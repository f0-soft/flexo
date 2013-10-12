'use strict';

// TODO: сделать функцию проверки селектора, функцию проверки значений

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
function next( callback ) {
	return process.nextTick( Function.bind.apply( callback, arguments ) );
}



var INITIALIZED;
var STORAGE;
var SCHEMES;

var DOC_ID = '_id';
var DOC_CREATE = 'tsCreate';
var DOC_UPDATE = 'tsUpdate';



// Get documents by criteria or result length
checks.find = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['name', true, 's'], // название схемы
		['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
		['query', true, 'o'], // единичный поисковый запрос Mongo; потому что на массив запросов невозможно быстро вернуть честный count
		['options', true, 'o', [
			['sort', false, 'o'], // объект, правило сортировки Mongo
			['skip', false, 'n'], // смещение ограничения количества результатов поиска
			['limit', false, 'n'], // ограничение количества результатов поиска
			['count', false, 'b'] // запрос количества документов удовлетворяющих запросу
		]]
	]],
	['callback', true, 'f']
] );
container.find = function( request, callback ) {
	var errType = checks.find( arguments );
	var i, types, reqFields = [DOC_ID, DOC_CREATE, DOC_UPDATE];

	if ( errType ) { return next( callback, errType ); }

	types = SCHEMES[request.name].dict.types;

	// подготовка набора полей
	for ( i = 0; i < request.fields.length; i += 1 ) {
		if ( SCHEMES[request.name].dict.all.indexOf( request.fields[i] ) === -1 ) {
			return next( callback, myErr( 'find, схема `' + request.name + '`, fields - поле `' + request.fields[i] + '` не существует' ) );
		}
		reqFields.push( request.fields[i] );
	}

	// проверка типов
	// работает только на равенствах
	// TODO: сделать работу на неравенствах и других сложных структурах
	var keys = Object.keys( request.query );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( typeof request.query[keys[i]] !== 'object' && !flexoValidator.checkType[types[keys[i]].type]( request.query[keys[i]], types[keys[i]].of ) ) {
			return next( callback, myErr( 'find, схема `' + request.name + '`, query - свойсво `' + keys[i] + '` должно быть типа `' + types[keys[i]].type + '`' ) );
		}
	}

	var options = request.options;
	if ( options.sort ) {
		if ( options.sort[0] === request.name ) {
			options.sort = options.sort[2];
		} else {
			keys = Object.keys( options.sort[2] );
			options.sortExt = {
				collnameExt: options.sort[0],
				field: options.sort[1],
				fieldExt: keys[0],
				sortExt: options.sort[2][keys[0]]
			};
			delete options.sort;
		}
	}

	return STORAGE.find( { collname: request.name, selector: request.query, fields: reqFields, options: request.options}, callback );
};



checks.aggregate = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['name', true, 's'],
		['pipeline', true, 'a', 'o']
	]],
	['callback', true, 'f']
] );
container.aggregate = function( request, callback ) {
	var errType = checks.aggregate( arguments );

	if ( errType ) { return next( callback, errType ); }

	return STORAGE.aggregate( { collname: request.name, pipeline: request.pipeline }, callback );
};



// Create new document
checks.insert = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['name', true, 's'], // название схемы
		['fields', true, 'a', 's'], // названия полей, с которыми надо вернуть документы
		['documents', true, 'a', 'o'], // массив новых документов
		['options' , true, 'o']
	]],
	['callback', true, 'f']
] );
container.insert = function( request, callback ) {
	var errType = checks.insert( arguments );
	var valid, depend, task;
	var i, j, doc, keys, key;
	var tasks = {};
	var docs = [];
	var scheme, dict;
	var reqFields = [DOC_ID, DOC_CREATE, DOC_UPDATE];

	if ( errType ) { return next( callback, errType ); }

	scheme = SCHEMES[request.name].scheme;
	dict = SCHEMES[request.name].dict;

	// подготовка списка полей
	for ( i = 0; i < request.fields.length; i += 1 ) {
		if ( dict.all.indexOf( request.fields[i] ) === -1 ) { return next( callback, myErr( 'insert, схема `' + request.name + '`, fields - поле `' + request.fields[i] + '` не существует' ) ); }
		reqFields.push( request.fields[i] );
	}

	// проверка свойств документов
	for ( i = 0; i < request.documents.length; i += 1 ) {
		doc = request.documents[i];

		docs[i] = {};
		keys = Object.keys( doc );

		// check required root join properties
		for ( j = 0; j < dict.joinProperties.length; j += 1 ) {
			if ( keys.indexOf( dict.joinProperties[j] ) === -1 ) {
				return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - из-за джойна требуется поле `' + dict.joinProperties[j] + '`. Документ: ' + JSON.stringify( doc ) ) );
			}
		}

		for ( j = 0; j < keys.length; j += 1 ) {
			key = keys[j];

			// check for mutation of immutable properties
			if ( dict.mutable.indexOf( key ) === -1 ) {
				return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - указано значение неизменяемого поля `' + key + '`. Документ: ' + JSON.stringify( doc ) ) );
			}

			// force array
			if ( dict.types[key].type === 'array' && !Array.isArray( doc[key] ) ) {
				doc[key] = [ doc[key] ];
			}

			// check types, validate
			valid = flexoValidator.validate( doc[key], dict.types[key] );
			if ( valid.length !== 0 ) {
				return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - ошибка данных в поле `' + key + '` - ' + JSON.stringify( valid ) ) );
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
		var hooks = [];
		if ( err ) { return callback( err ); }

		now = Date.now();
		for ( i = 0; i < docs.length; i += 1 ) {
			docs[i][DOC_CREATE] = now;
			docs[i][DOC_UPDATE] = now;
		}

		if ( scheme.before && scheme.before.insert ) { hooks = scheme.before.insert; }

		return runHooks( hooks, { schemes: SCHEMES, db: container, request: request }, function( err ) {
			// finally store documents
			if ( err ) { return callback( err ); }

			return STORAGE.insert( request.name, docs, function( err, result ) {
				var hooks = [];

				if ( err ) { return callback( err ); }

				if ( scheme.after && scheme.after.insert ) { hooks = scheme.after.insert; }

				return runHooks( hooks, { schemes: SCHEMES, db: container, request: request, result: result }, function( err ) {
					var documents = [];
					var i, doc;

					if ( err ) { return callback( err ); }

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
	var selector = {};
	selector[DOC_ID] = {$in: []};

	if ( errType ) { return next( callback, errType ); }

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
	return STORAGE.find( {
		collname: this.brickName,
		selector: selector,
		fields: this.brick.fields
	}, brickTaskCallback.bind( this ) );
}

checks.brickTaskCallback = argstype.getChecker( myErr, [
	['err', true, 'o'],
	['data', true, 'o', [
		['result', false, 'a', [
			'*', false, 'o'
		]]
	]]
] );
function brickTaskCallback( err, data ) {
	// this.brickName
	// this.documents
	// this.callback
	// this.brick.depend
	// this.brick.fields
	var errType = checks.brickTaskCallback( arguments );
	var i, j, element;
	var dict = {};

	if ( errType ) { return this.callback( errType ); }
	if ( err ) { return this.callback( err ); }

	for ( i = 0; i < data.result.length; i += 1 ) {
		dict[data.result[i][DOC_ID]] = data.result[i];
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
			return next( this.callback, myErr( 'не удается найти джойн для документа: ' + JSON.stringify( this.documents[i] ) ) );
		}
	}

	return this.callback( err, true );
}



// Import and save updates
checks.modify = argstype.getChecker( myErr, [
	['request', true, 'o', [
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
		['options', true, 'o']
	]],
	['callback', true, 'f']
] );
container.modify = function( request, callback ) {
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

	if ( errType ) { return next( callback, errType ); }

	scheme = SCHEMES[request.name].scheme;
	dict = SCHEMES[request.name].dict;

	// loop over queries to check and clone them
	for ( i = 0; i < request.query.length; i += 1 ) {
		complexity = 0;

		// check properties
		keys = Object.keys( request.query[i].properties );
		for ( j = 0; j < keys.length; j += 1 ) {

			// check for mutation of immutable properties
			if ( dict.mutable.indexOf( keys[j] ) === -1 ) {
				return next( callback, myErr( 'Mutating immutable property `' + keys[j] + '` in query: ' + JSON.stringify( request.query[i] ) ) );
			}

			// force array
			if ( dict.types[keys[j]].type === 'array' && !Array.isArray( request.query[i].properties[keys[j]] ) ) {
				request.query[i].properties[keys[j]] = [ request.query[i].properties[keys[j]] ];
			}

			// check types, validate
			valid = flexoValidator.validate( request.query[i].properties[keys[j]], dict.types[keys[j]] );
			if ( valid.length !== 0 ) {
				return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - ошибка данных в поле `' + keys[j] + '` - ' + JSON.stringify( valid ) ) );
			}

			// sort queries for simple and complex
			if ( dict.joinProperties.indexOf( keys[j] ) !== -1 && complexity < 1 ) {
				complexity = 1;
			}
		}

		// do only tasks with non-empty properties
		if ( keys.length > 0 ) {
			storageQuery[complexity].push( request.query[i] );
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
			return next( callback, null, query );
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
			if ( err ) { return callback( err ); }

			// return tasks
			return callback( null, query );
		} );
	} );

	// run tasks
	return async.parallel( tasks, function( err, data ) {
		var now, i;
		var query = [], hooks = [];

		if ( err ) { return callback( err ); }

		now = Date.now();
		for ( i = 0; i < data.length; i += 1 ) {
			for ( j = 0; j < data[i].length; j += 1 ) {
				// set new tsUpdate
				data[i][j].properties[DOC_UPDATE] = now;
			}
			query = query.concat( data[i] );
		}

		if ( scheme.before && scheme.before.modify ) { hooks = scheme.before.modify; }

		return runHooks( hooks, { schemes: SCHEMES, db: container, request: request }, function( err ) {
			if ( err ) { return callback( err ); }

			return STORAGE.modify( request.name, query, function( err, result ) {
				var hooks = [];

				if ( err ) { return callback( err ); }

				if ( scheme.after && scheme.after.modify ) { hooks = scheme.after.modify; }

				return runHooks( hooks, { schemes: SCHEMES, db: container, request: request, result: result }, function( err ) {
					if ( err ) { return callback( err ); }

					return callback( null, result );
				} );
			} );
		} );
	} );
};



// Mark documents as deleted
checks.delete = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['name', true, 's'], // название схемы
		['query', true, 'a', [
			'*', true, 'o', [ // поисковый запрос Mongo
				[DOC_ID, true, 's'],
				[DOC_UPDATE, true, 'n']
			]
		]],
		['options', true, 'o']
	]],
	['callback', true, 'f']
] );
container.delete = function( request, callback ) {
	var errType = checks.delete( arguments );

	if ( errType ) { return next( callback, errType ); }

	// delete documents
	return STORAGE.delete( request.name, request.query, callback );
};



checks.runHooks = argstype.getChecker( myErr, [
	['hooks', true, 'a', [
		'*', false, 'f'
	]],
	['self', true, 'o'],
	['callback', true, 'f']
] );
function runHooks( hooks, self, callback ) {
	var errType = checks.runHooks( arguments );
	var i, j, _self, keys = Object.keys( self ), tasks = [];

	if ( errType ) { return next( callback, errType ); }

	for ( i = 0; i < hooks.length; i += 1 ) {
		// клонирование контейнера
		_self = {};
		for ( j = 0; j < keys.length; j += 1 ) { _self[keys[j]] = self[keys[j]]; }

		// постановка в очередь
		tasks.push( hooks[i].bind( _self ) );
	}

	return async.parallel( tasks, callback );
}



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

	if ( errType ) { return next( callback, errType ); }
	if ( INITIALIZED ) { return next( callback, myErr( 'повторная инициализация запрещена' ) ); }

	SCHEMES = options.schemes;
	STORAGE = options.storage;
	INITIALIZED = true;

	return next( callback, null, container );
};



module.exports = {
	init: init
};
