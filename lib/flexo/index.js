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
var HOOK_TIMEOUT = 60000;

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
	var i, keys, types, newQuery, options, reqFields = [DOC_ID, DOC_CREATE, DOC_UPDATE];

	if ( errType ) { return next( callback, errType ); }

	types = SCHEMES[request.name].dict.types;

	// подготовка набора полей
	for ( i = 0; i < request.fields.length; i += 1 ) {
		if ( SCHEMES[request.name].dict.all.indexOf( request.fields[i] ) === -1 ) {
			return next( callback, myErr( 'find, схема `' + request.name + '`, fields - поле `' + request.fields[i] + '` не существует' ) );
		}
		reqFields.push( request.fields[i] );
	}

	// проверка и приведение типов
	newQuery = processQuery( request.query, types );
	if ( newQuery[0] ) { return next( callback, myErr( newQuery[0] ) ); }

	var arrays = 0;
	for ( i = 0; i < newQuery[2].length; i += 1 ) {
		if ( flexoValidator.arrays[newQuery[2][i]] ) {
			arrays += 1;
		}
	}

	// TODO: создавать новый объект опций
	options = request.options;
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



	var cbBind = findCallback.bind( { name: request.name, fields: reqFields, cb: callback } );

	if ( arrays < 2 ) {
		return STORAGE.find( {
			collname: request.name,
			selector: newQuery[1],
			fields: reqFields,
			options: request.options
		}, cbBind );
	} else {
		return next( callback, myErr( 'поиск по 2 и более массивам не поддерживается' ) );

		var pipeline = [
			{$match: {/* запрос с or по полям-массивам */}},
			{$group: {_id: '$_id', count: 1}},
			{$match: {count: arrays}}
		];

		return STORAGE.aggregate( {
			collname: request.name,
			pipeline: pipeline
		}, function( err, res ) {
			var ids = [];
			for ( var i = 0; i < res.length; i += 1 ) {ids.push( res[i]._id );}

			return STORAGE.find( {
				collname: this.name,
				selector: {_id: {$in: ids}},
				fields: this.fields,
				options: this.options
			}, cbBind );
		}.bind( {name: request.name, fields: reqFields, options: options, cb: callback} ) );
	}
};
function findCallback( err, data ) {
	if ( err ) { return this.cb( err ); }

	data.result = processResponse( data.result, this.fields, SCHEMES[this.name].dict.types );
	return this.cb( null, data );
}

// возвращает массив, где 0 - ошибка, 1 - результат приведения запроса, 2 - массив встретившихся полей
function processQuery( query, types ) {
	var i, j, ix, val;
	var out = {}, keys = Object.keys( query );
	var subs = ['$and', '$or', '$nor'];
	var fields = [];
	for ( i = 0; i < keys.length; i += 1 ) {
		ix = subs.indexOf( keys[i] );

		if ( ix !== -1 ) {
			out[subs[ix]] = [];
			for ( j = 0; j < query[subs[ix]].length; j += 1 ) {
				val = processQuery( query[subs[ix]][j], types );
				if ( val[0] ) { return [ (keys[i] + '[' + j + ']' + ' - ' + val[0]), out ]; }
				out[subs[ix]][j] = val[1];
				fields = fields.concat( val[2] );
			}
		} else {
			val = flexoValidator.toQuery( query[keys[i]], types[keys[i]].type );
			if ( val[0] ) { return [ (keys[i] + ' - ' + val[0]), out ]; }
			out[keys[i]] = val[1];

			if ( flexoValidator.arrays[keys[i]] ) {
				fields.push( keys[i] );
			}
		}
	}

	var fds = [];
	for ( i = 0; i < fields.length; i += 1 ) {
		if ( fds.indexOf( fields[i] ) === -1 ) {
			fds.push( fields[i] );
		}
	}
	return [ false, out, fds ];
}

function processResponse( data, fields, types ) {
	var i, j, res = [];

	for ( i = 0; i < data.length; i += 1 ) {
		res[i] = {};
		for ( j = 0; j < fields.length; j += 1 ) {
			res[i][fields[j]] = flexoValidator.toUser( data[i][fields[j]], types[fields[j]].type )
		}
	}

	return res;
}



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
		['query', true, 'a', 'o'], // массив новых документов
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
	for ( i = 0; i < request.query.length; i += 1 ) {
		doc = request.query[i];

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

			// check types, force arrays, validate
			valid = flexoValidator.toBase( doc[key], dict.types[key].type );
			if ( valid[0] ) { return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - ошибка данных в поле `' + key + '` - ' + valid[0] ) ); }

			// clone properties;
			docs[i][key] = valid[1];
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

		return runHooks( hooks, { schemes: SCHEMES, db: container, query: docs }, function( err, res ) {
			// finally store documents
			if ( err ) { return callback( (typeof err === 'object') ? err : myErr( err ) ); }
			if ( !hooks.length ) { res = docs; }

			return STORAGE.insert( request.name, res, function( err, result ) {
				var hooks = [];

				if ( err ) { return callback( err ); }

				if ( scheme.after && scheme.after.insert ) { hooks = scheme.after.insert; }

				return runHooks( hooks, { schemes: SCHEMES, db: container, query: docs, result: result }, function( err ) {
					var documents;

					if ( err ) { return callback( (typeof err === 'object') ? err : myErr( err ) ); }

					documents = processResponse( result, reqFields, dict.types );

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

			// check types, force arrays, validate
			valid = flexoValidator.toBase( request.query[i].properties[keys[j]], dict.types[keys[j]].type );
			if ( valid[0] ) { return next( callback, myErr( 'insert, схема `' + request.name + '`, documents.' + i + ' - ошибка данных в поле `' + keys[j] + '` - ' + valid[1] ) ); }
			request.query[i].properties[keys[j]] = valid[1];


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

		return runHooks( hooks, { schemes: SCHEMES, db: container, query: query }, function( err, res ) {
			if ( err ) { return callback( (typeof err === 'object') ? err : myErr( err ) ); }
			if ( !hooks.length ) { res = query;}

			return STORAGE.modify( request.name, res, function( err, result ) {
				var hooks = [];

				if ( err ) { return callback( err ); }

				if ( scheme.after && scheme.after.modify ) { hooks = scheme.after.modify; }

				return runHooks( hooks, { schemes: SCHEMES, db: container, query: query, result: result }, function( err ) {
					if ( err ) { return callback( (typeof err === 'object') ? err : myErr( err ) ); }

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

	if ( errType ) { return next( callback, errType ); }

	var tasks = [];
	for ( var i = 0; i < hooks.length; i += 1 ) {
		tasks.push( runOneHook.bind( null, self, hooks[i] ) );
	}

	return async.waterfall(
		tasks,
		function( err, res ) {
			callback( err, res );
		}
	);
}

function runOneHook( self, hook, query, callback ) {
	if ( typeof query === 'function' ) {
		callback = query;
		query = self.query;
	}

	var i, j, _self, tOut, tasks = [];
	var keys;

	keys = Object.keys( self );

	// клонирование контейнера
	for ( i = 0; i < query.length; i += 1 ) {
		_self = {};
		for ( j = 0; j < keys.length; j += 1 ) { _self[keys[j]] = self[keys[j]]; }

		if ( self.result ) { _self.result = self.result[i]; }
		_self.query = query[i];

		// постановка в очередь
		tasks.push( hook.bind( _self ) );
	}

	tOut = setTimeout( function() {
		tOut = null;
		return callback( myErr( 'истекло время ожидания выполнения серверных функций' ) );
	}, HOOK_TIMEOUT );

	return async.parallel( tasks, function( err, res ) {
		if ( tOut ) {
			clearTimeout( tOut );
			return callback( err, res );
		}
		return undefined;
	} );
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
		]],
		['hook_timeout', false, 'n']
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
	HOOK_TIMEOUT = options.hook_timeout * 1000 || HOOK_TIMEOUT;
	INITIALIZED = true;

	return next( callback, null, container );
};



module.exports = {
	init: init,
	types: flexoValidator.types,
	arrays: flexoValidator.arrays
};
