'use strict';

var log = process.env.DEBUG ? console.log : function() {};

var async = require( 'async' );
var flexoValidator = require( './flexoValidator' );

var init;
var FlexoCollection;

var brickTask, brickTaskFindCallback;

var INITIALIZED;
var STORAGE;
var SCHEMES;


// Container
FlexoCollection = {};



// Get documents by criteria or result length
FlexoCollection.find = function( scheme, fields, query, options, callback ) {
// scheme - строка, содержит название схемы
// fields - массив, содержит названия полей, с которыми надо вернуть документы
// query - объект, потому что на массив запросов невозможно быстро вернуть честный count
// query.selector - объект, поисковый запрос Mongo
// query.[options] - объект
// query.options.[limit] - число, ограничение количества результатов поиска
// query.options.[skip] - число, смещение ограничения количества результатов поиска
// query.options.[sort] - объект, правило сортировки Mongo
// query.options.[hint] - объект, содержит указание по выбору индекса Mongo
// [options] - объект
// options.[count] - логическое, опция запроса количества документов удовлетворяющих запросу
// callback( error, documents, [count] ) - функция
// callback.documents - массив, содержит объекты документов
// callback.[count] - число, общее количество удовлетворяющих запросу документов

	var i, keys, types;

	if ( !INITIALIZED ) { throw new Error( 'Flexo initialization required' ); }

	if ( typeof scheme !== 'string' ) { throw new Error( 'Scheme name required' );}
	if ( !Array.isArray( fields ) ) { throw new Error( 'Fields array required' );}
	if ( typeof query !== 'object' ) { throw new Error( 'Query required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	if ( typeof query.selector !== 'object' ) {
		callback( new Error( 'Selector required: ' + JSON.stringify( query ) ) );
		return;
	}

	types = SCHEMES[scheme].dict.types;

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
	fields = fields.concat( ['_id', 'tsCreate', 'tsUpdate'] );

	STORAGE.find( scheme, {
		query: query,
		fields: fields
	}, options, callback );
};



// Create new document
FlexoCollection.insert = function( scheme, fields, document, options, callback ) {
// scheme - строка, содержит название схемы
// fields - массив, содержит названия полей, с которыми надо вернуть документы
// document - объект или массив объектов document, содержит поля нового документа
// [options] - объект
// callback( error, documents ) - функция
// callback.documents - массив, содержит объекты сохраненных документов

	var valid;
	var depend;
	var task;
	var i, j, doc, keys, key;
	var tasks = {};
	var docs = [];
	var joins;

	if ( !INITIALIZED ) { throw new Error( 'Flexo initialization required' ); }

	if ( typeof scheme !== 'string' ) { throw new Error( 'Scheme name required' );}
	if ( !Array.isArray( fields ) ) { throw new Error( 'Fields array required' );}
	if ( typeof document !== 'object' && !Array.isArray( document ) ) { throw new Error( 'Document or array of documents required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	joins = SCHEMES[scheme].dict.joins;

	fields = fields.concat( ['_id', 'tsCreate', 'tsUpdate'] );

	document = Array.isArray( document ) ? document : [document];

	// loop over docs to check and clone them
	for ( i = 0; i < document.length; i += 1 ) {
		doc = document[i];

		docs[i] = {};
		keys = Object.keys( doc );

		// check required root join properties
		for ( j = 0; j < SCHEMES[scheme].dict.joinProperties.length; j += 1 ) {
			if ( keys.indexOf( SCHEMES[scheme].dict.joinProperties[j] ) === -1 ) {
				callback( new Error( 'No join property `' + SCHEMES[scheme].dict.joinProperties[j] + '` in root of document: ' + doc ) );
				return;
			}
		}

		for ( j = 0; j < keys.length; j += 1 ) {
			key = keys[j];

			// check for mutation of immutable properties
			if ( SCHEMES[scheme].dict.mutable.indexOf( key ) === -1 ) {
				callback( new Error( 'Mutating immutable property `' + key + '` in document: ' + JSON.stringify( doc ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( doc[key], SCHEMES[scheme].scheme.root[key] );
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

	for ( i = 0; i < joins.length; i += 1 ) {
		depend = SCHEMES[scheme].scheme.join[joins[i]].depend;

		// get brick dependency
		task = (depend[0] === 'root') ? [] : [ depend[0] ];

		// join task function
		task.push( brickTask.bind( { brickName: joins[i], brick: SCHEMES[scheme].scheme.join[joins[i]], documents: docs } ) );

		tasks[joins[i]] = task;
	}

	async.auto( tasks, function( error, results ) {
		var i, now;
		if ( error ) {
			callback( error );
			return;
		}

		now = Date.now();
		for ( i = 0; i < docs.length; i += 1 ) {
			docs[i].tsCreate = now;
			docs[i].tsUpdate = now;
		}

		// finally store documents
		STORAGE.insert( scheme, docs, function( error, result ) {
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
brickTask = function( callback ) {
	var brickName = this.brickName;
	var brick = this.brick;
	var documents = this.documents;
	var depend = brick.depend;
	var selector = { '_id': { '$in': [] } };
	var d;

	// loop over documents to prepare request for another brick
	// make request
	// loop over result to join required fields to document

	// loop over documents
	for ( d = 0; d < documents.length; d += 1 ) {
		selector._id.$in.push( documents[d][depend[1]] );
	}

	// async request joins
	STORAGE.find( brickName, { query: { selector: selector }, fields: brick.fields }, {}, brickTaskFindCallback.bind( {
		brickName: brickName,
		brick: brick,
		documents: documents,
		callback: callback
	} ) );
};



brickTaskFindCallback = function( error, data ) {
	var brickName = this.brickName;
	var documents = this.documents;
	var callback = this.callback;
	var depend = this.brick.depend;
	var brickProperties = this.brick.fields.concat( ['_id'] );
	var document;
	var nice;
	var d, i, k;

	if ( error ) {
		callback( error );
		return;
	}

	// TODO: what if I put all data into Collectioner and make a find() in it?
	// loop over documents
	for ( d = 0; d < documents.length; d += 1 ) {
		// loop over data
		for ( i = 0; i < data.length; i += 1 ) {
			nice = false;

			if ( data[i]._id === documents[d][depend[1]] ) {
				// join properties from dataItem
				for ( k = 0; k < brickProperties.length; k += 1 ) {
					documents[d][(brickName + '_' + brickProperties[k])] = data[i][brickProperties[k]];
				}

				nice = true;
				break;
			}
		}

		if ( nice === false ) {
			callback( new Error( 'Can\'t get join for document: ' + JSON.stringify( documents[d] ) ) );
			return;
		}
	}

	callback( error, true );
};



// Import and save updates
FlexoCollection.modify = function( scheme, query, options, callback ) {
// scheme - строка, содержит название схемы
// query - объект или массив объектов query
// query.selector - объект, поисковый запрос Mongo, обязательно должен содержать поля _id и tsUpdate
// query.properties - объект новых значений
// [options] - объект
// callback( error, documents ) - функция
// callback.documents - массив, содержит объекты документов, сокращенных до _id, tsUpdate

	// loop over values to check all properties are mutableProperties
	// on rootJoinsProperties change - act like insert, otherwise just update

	var valid;
	var storageQuery = [
		[], // simple query
		[], // complex query
		[]  // super-complex query
	];
	var tasks;
	var tsUpdate;
	var i, j, keys, complexity;

	if ( !INITIALIZED ) { throw new Error( 'Flexo initialization required' ); }

	if ( typeof scheme !== 'string' ) { throw new Error( 'Scheme name required' );}
	if ( typeof query !== 'object' && !Array.isArray( query ) ) { throw new Error( 'Query required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	query = Array.isArray( query ) ? query : [ query ];

	// loop over queries to check and clone them
	for ( i = 0; i < query.length; i += 1 ) {
		complexity = 0;

		if ( typeof query[i].selector !== 'object' ) {
			callback( new Error( 'Selector required in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		if ( !flexoValidator.checkType[SCHEMES[scheme].dict.types._id.type]( query[i].selector._id ) ) {
			callback( new Error( 'Property `_id` must be a string in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		if ( !flexoValidator.checkType[SCHEMES[scheme].dict.types.tsUpdate.type]( query[i].selector.tsUpdate ) ) {
			callback( new Error( 'Property `tsUpdate` must be a number in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		// check properties
		keys = Object.keys( query[i].properties );
		for ( j = 0; j < keys.length; j += 1 ) {

			// check for mutation of immutable properties
			if ( SCHEMES[scheme].dict.mutable.indexOf( keys[j] ) === -1 ) {
				callback( new Error( 'Mutating immutable property `' + keys[j] + '` in query: ' + JSON.stringify( query[i] ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( query[i].properties[keys[j]], SCHEMES[scheme].scheme.root[keys[j]] );
			if ( valid.length !== 0 ) {
				callback( valid );
				return;
			}

			// sort queries for simple and complex
			if ( SCHEMES[scheme].dict.joinProperties.indexOf( keys[j] ) !== -1 && complexity < 1 ) {
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
		var joins = SCHEMES[scheme].dict.joins;

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
		for ( i = 0; i < joins.length; i += 1 ) {
			depend = SCHEMES[scheme].scheme.join[joins[i]].depend;

			// get brick dependency
			task = (depend[0] === 'root') ? [] : [ depend[0] ];

			// join task function
			task.push( brickTask.bind( { brickName: joins[i], brick: SCHEMES[scheme].scheme.join[joins[i]], documents: documents } ) );

			tasks[joins[i]] = task;
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
				data[i][j].properties.tsUpdate = now;
			}
			query = query.concat( data[i] );
		}

		STORAGE.modify( scheme, query, callback );
	} );
};



// Mark documents as deleted
FlexoCollection.delete = function( scheme, query, options, callback ) {
// scheme - строка, содержит название схемы
// query - объект или массив объектов query
// query.selector - объект, поисковый запрос Mongo, обязательно должен содержать поля _id и tsUpdate
// [options] - объект
// callback( error, documents ) - функция
// callback.documents - массив, содержит объекты удаленных документов, сокращенных до _id

	var i;

	if ( !INITIALIZED ) { throw new Error( 'Flexo initialization required' ); }

	if ( typeof scheme !== 'string' ) { throw new Error( 'Scheme name required' );}
	if ( typeof query !== 'object' && !Array.isArray( query ) ) { throw new Error( 'Query required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	query = Array.isArray( query ) ? query : [ query ];

	for ( i = 0; i < query.length; i += 1 ) {
		if ( typeof query[i].selector !== 'object' ) {
			callback( new Error( 'Selector required in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		if ( !flexoValidator.checkType[SCHEMES[scheme].dict.types._id.type]( query[i].selector._id ) ) {
			callback( new Error( 'Property `_id` must be a string in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		if ( !flexoValidator.checkType[SCHEMES[scheme].dict.types.tsUpdate.type]( query[i].selector.tsUpdate ) ) {
			callback( new Error( 'Property `tsUpdate` must be a number in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

	}

	// delete documents
	STORAGE.delete( scheme, query, callback );
};



// set constants, precache schemes
init = function( options, callback ) {
	// options - объект
	// options.storage - объект, содержит функции работы с хранилищем (find, insert, modify, delete)
	// options.schemes - объект, содержит доступные схемы со справочниками
	// callback( error ) - функция, получает ошибку если что-то пошло не так

	if ( typeof options !== 'object' ) { throw new Error( 'Options required' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	if ( INITIALIZED ) { callback( new Error( 'Flexo reinitialization prohibited' ) ); }

	if ( typeof options.schemes !== 'object' ) { throw new Error( 'Schemes required' ); }
	if ( typeof options.storage !== 'object' ) { throw new Error( 'Storage required' ); }

	SCHEMES = options.schemes;
	STORAGE = options.storage;
	INITIALIZED = true;

	callback( null, FlexoCollection );
};



module.exports = {
	init: init,
	Collection: FlexoCollection
};
