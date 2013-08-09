'use strict';

var log = process.env.DEBUG ? console.log : function() {};
var totalTime = 0;

var async = require( 'async' );
var Collection = require( 'collectioner' );
var Storage; // defined on init
var flexoValidator = require( './flexoValidator' );

var init;
var FlexoCollection, getSchemes;

var findCallback, brickTask, brickTaskFindCallback;

var SETTINGS = {
	ok: false,
	path: __dirname + '/../../test.schemes/',
	mock: false
};

var SYSTEM_PROPERTIES = [ '_id', 'tsCreate', 'tsUpdate' ];



FlexoCollection = function( options ) {
	// options = scheme, fields

	var scheme, name, joins, mutableProperties, allProperties = [], rootJoinProperties = [], storages = {}, types, calcNames;
	var final2group = {}, final2source = {};
	var i, j, keys, group, field, fields, finalName, join, depend;

	if ( !SETTINGS.ok ) { throw new Error( 'Flexo initialization required' ); }

	if ( !options ) { throw new Error( 'Options required' ); }
	if ( !options.scheme ) { throw new Error( 'Option `scheme` required' ); }
	if ( typeof options.scheme !== 'string' ) { throw new Error( 'Option `scheme` must be a string' ); }
	if ( !options.fields ) { throw new Error( 'Option `fields` required' ); }
	if ( !Array.isArray( options.fields ) ) { throw new Error( 'Option `fields` must be an array' ); }

	// scheme
	scheme = require( SETTINGS.path + options.scheme );

	// root
	name = scheme.name;
	storages[name] = new Storage.New( name, options.fields );

	// joins
	joins = (scheme.join) ? Object.keys( scheme.join ) : [];
	for ( i = 0; i < joins.length; i += 1 ) {
		storages[joins[i]] = new Storage.New( joins[i], scheme.join[joins[i]].fields.concat( SYSTEM_PROPERTIES ) );
	}

	// calc
	calcNames = (scheme.calc) ? Object.keys( scheme.calc ) : [];

	// prepare mutableProperties - root properties except SYSTEM_PROPERTIES
	mutableProperties = Object.keys( scheme.root );
	for ( i = SYSTEM_PROPERTIES.length - 1; i >= 0; i -= 1 ) {
		j = mutableProperties.indexOf( SYSTEM_PROPERTIES[i] );
		if ( j !== -1 ) {
			mutableProperties.splice( j, 1 );
		}
	}

	// find rootJoinProperties
	for ( i = 0; i < joins.length; i += 1 ) {
		depend = scheme.join[joins[i]].depend;
		if ( depend[0] === 'root' ) {
			if ( mutableProperties.indexOf( depend[1] ) !== -1 ) {
				rootJoinProperties.push( depend[1] );
			} else {
				throw new Error( 'Join `' + joins[i] + '` depends on immutable root property `' + depend[1] + '`' );
			}
		}
	}

	// build mapping finalName - sourceName
	// build mapping finalName - groupName
	for ( i = 0; i < joins.length; i += 1 ) {
		group = joins[i];
		for ( j = 0; j < scheme.join[group].fields.length; j += 1 ) {
			field = scheme.join[group].fields[j];
			finalName = group + '_' + field;

			if ( mutableProperties.indexOf( finalName ) !== -1 ) {
				throw new Error( 'Double final name `' + finalName + '` on groups `' + group + '` and `' + name + '`' );
			}

			if ( final2group[finalName] !== undefined || final2source[finalName] !== undefined ) {
				throw new Error( 'Double final name `' + finalName + '` on groups `' + group + '` and `' + final2group[finalName] + '`' );
			}

			final2group[finalName] = group;
			final2source[finalName] = field;
		}
	}

	// build allProperties
	keys = mutableProperties.concat( SYSTEM_PROPERTIES );
	for ( i = 0; i < joins.length; i += 1 ) {
		fields = scheme.join[joins[i]].fields.concat( ['_id'] ); // only `_id` auto-added to joins

		for ( j = 0; j < fields.length; j += 1 ) {
			keys.push( joins[i] + '_' + fields[j] );
		}
	}
	// filter duplicates if any
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( allProperties.indexOf( keys[i] ) === -1 ) {
			allProperties.push( keys[i] );
		}
	}

	// build types
	types = {_id: {type: 'id'}, tsCreate: {type: 'number'}, tsUpdate: {type: 'number'}};
	keys = Object.keys( scheme.root );
	for ( i = 0; i < keys.length; i += 1 ) {
		types[keys[i]] = scheme.root[keys[i]];
	}
	for ( i = 0; i < joins.length; i += 1 ) {
		join = require( SETTINGS.path + joins[i] );
		types[ joins[i] + '_' + '_id'] = {type: 'id'};
		for ( j = 0; j < scheme.join[joins[i]].fields; j += 1 ) {
			field = joins[i] + '_' + scheme.join[joins[i]].fields[j];
			types[field] = join.root[scheme.join[joins[i]].fields[j]];
		}
	}
	// force types
	keys = Object.keys( types );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( types[keys[i]].type === undefined ) {
			types[keys[i]].type = 'string';
		}
	}


	// parse scheme
	// prepare rules
	// prepare name maps
	// prepare events map
	// prepare methods

//	this.currentDocs = new Collection( { scheme: 'parsed scheme' } ); // current aka this
//	this.changeDocs = new Collection( { scheme: { _id: 0, properties: 0 } } ); // diff - uuid:values
//	this.deleteDocs = new Collection( { scheme: { _id: 0 } } ); // IDs
//	this.createDocs = new Collection( { scheme: { _id: 0 } } ); // IDs
//	this.initDocs = new Collection( { scheme: 'parsed scheme' } ); // initial

	this.scheme = scheme;
	this.name = name;
	this.joins = joins;
	this.fields = options.fields;
	this.defaultFields = SYSTEM_PROPERTIES;
	this.mutableProperties = mutableProperties;
	this.allProperties = allProperties;
	this.rootJoinProperties = rootJoinProperties;
	this.final2group = final2group;
	this.final2source = final2source;
	this.types = types;

	this.transmittedDocs = new Collection( { scheme: { _id: 0, tsUpdate: 0 } } ); // IDs
	this.storages = storages;
};



// Get documents by criteria or result length
FlexoCollection.prototype.find = function( query, options, callback ) {
// query - объект, потому что на массив запросов невозможно быстро вернуть честный count
// query.selector - объект, поисковый запрос Mongo
// query.[options] - объект
// query.options.[limit] - число, ограничение количества результатов поиска
// query.options.[skip] - число, смещение ограничения количества результатов поиска
// query.options.[sort] - объект, правило сортировки Mongo
// query.options.[hint] - объект, содержит указание по выбору индекса Mongo
// [options] - объект
// options.[count] - логическое, опция запроса количества документов удовлетворяющих запросу
// options.[all] - логическое, возврат всех документов без учета ранее переданных ( прозрачный запрос )
// options.[nocache] - логическое, предотвращает сохранение учет документов как ранее переданных
// options.[fields] - массив, содержит названия полей, с которыми надо вернуть документы
// callback( error, documents, count ) - функция, получает массив документов или число документов

	var i, keys;
	var count, all, nocache, fields;
	var self = this;

	if ( typeof query !== 'object' ) { throw new Error( 'Query required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	count = options.count || false;
	all = options.all || false;
	nocache = options.nocache || false;
	fields = (options.fields || this.fields).concat( ['_id', 'tsCreate', 'tsUpdate'] );

	if ( typeof query.selector !== 'object' ) {
		callback( new Error( 'Selector required: ' + JSON.stringify( query ) ) );
		return;
	}

	// check types
	// работает только на равенствах
	keys = Object.keys( query.selector );
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( typeof query.selector[keys[i]] !== 'object' && !flexoValidator.checkType[this.types[keys[i]].type]( query.selector[keys[i]] ) ) {
			callback( new Error( 'Property `' + keys[i] + '` must be type of `' + this.types[keys[i]].type + '`' ) );
			return;
		}
	}

	if ( all ) {
		self.storages[self.name].find( {
			query: query,
			fields: fields
		}, { count: count }, findCallback.bind( {self: this, nocache: nocache, callback: callback} ) );
		return;
	}

	// request IDs
	self.storages[self.name].find( {
		query: query,
		fields: [ '_id', 'tsUpdate' ]
	}, { count: count }, function( error, documents, countResult ) {
		// data = [ {}, ... ]
		var i, nice;
		var id, ids = [];

		if ( error ) {
			callback( error );
			return;
		}
		log( 'data length: ' + documents.length );

		log( 'old transmittedDocs size: ' + self.transmittedDocs.size() );

		// in data find new documents and newer than transmitted
		for ( i = 0; i < documents.length; i += 1 ) {
			nice = true;

			id = self.transmittedDocs.find( {
				_id: documents[i]._id,
				tsUpdate: {$gte: documents[i].tsUpdate}
			}, {}, 1, true );

			if ( id.length === 0 ) {
				ids.push( documents[i]._id );
			}
		}

		if ( ids.length === 0 ) {
			callback( error, [], countResult );
			return;
		}

		// request data
		self.storages[self.name].find( {
			query: {
				selector: {
					_id: { $in: ids }
				}
			},
			fields: fields
		}, {}, findCallback.bind( {self: self, nocache: nocache, callback: callback, count: countResult} ) );
	} );
};

findCallback = function( error, documents, count ) {
	var self = this.self;
	var nocache = this.nocache;
	var callback = this.callback;
	var i;

	if ( error ) {
		callback( error );
		return;
	}

	count = (typeof count === 'number') ? count : (typeof this.count === 'number') ? this.count : -1;

	if ( !nocache ) {
		// save transmitted IDs
//			self.transmittedDocs.add( documents );
		for ( i = 0; i < documents.length; i += 1 ) {
			if ( !self.transmittedDocs.set( {_id: documents[i]._id}, 'tsUpdate', documents[i].tsUpdate ) ) {
				self.transmittedDocs.add( documents[i] );
			}
		}
	}
	log( 'new transmittedDocs size: ' + self.transmittedDocs.size() );

	log( 'res length: ' + documents.length );

	// return new and updated documents
	callback( error, documents, count );
};



// Create new document
FlexoCollection.prototype.insert = function( document, options, callback ) {
	// document - объект или массив объектов document, содержит поля нового документа
	// [options] - объект
	// options.[fields] - массив, содержит названия полей, с которыми надо вернуть документы
	// callback( error, documents ) - функция, получает массив сохраненных документов

	var valid;
	var depend;
	var fields;
	var start = Date.now();
	var task;
	var i, j, doc, keys, key;
	var tasks = {};
	var documents = [];
	var self = this;
	var joins = self.joins;


	if ( typeof document !== 'object' && !Array.isArray( document ) ) { throw new Error( 'Document or array of documents required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	fields = (options.fields || this.fields).concat( ['_id', 'tsCreate', 'tsUpdate'] );

	document = Array.isArray( document ) ? document : [document];

	// loop over docs to check and clone them
	for ( i = 0; i < document.length; i += 1 ) {
		doc = document[i];

		documents[i] = {};
		keys = Object.keys( doc );

		// check required root join properties
		for ( j = 0; j < this.rootJoinProperties.length; j += 1 ) {
			if ( keys.indexOf( this.rootJoinProperties[j] ) === -1 ) {
				callback( new Error( 'No join property `' + this.rootJoinProperties[j] + '` in root of document: ' + doc ) );
				return;
			}
		}

		for ( j = 0; j < keys.length; j += 1 ) {
			key = keys[j];

			// check for mutation of immutable properties
			if ( this.mutableProperties.indexOf( key ) === -1 ) {
				callback( new Error( 'Mutating immutable property `' + key + '` in document: ' + JSON.stringify( doc ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( doc[key], this.scheme.root[key] );
			if ( valid.length !== 0 ) {
				callback( [key, valid] );
				return;
			}

			// clone properties;
			documents[i][key] = doc[key];
		}
	}
	// looks like properties are fine


	// let's prepare brick-joining tasks
	// every task requests data for documents via `OR` statement
	// so here we loop over joining bricks to create these tasks

	for ( i = 0; i < joins.length; i += 1 ) {
		depend = self.scheme.join[joins[i]].depend;

		// get brick dependency
		task = (depend[0] === 'root') ? [] : [ depend[0] ];

		// join task function
		task.push( brickTask.bind( { self: self, brickName: joins[i], documents: documents } ) );

		tasks[joins[i]] = task;
	}

	log( 'Build tasks: ' + (Date.now() - start) );
	totalTime += (Date.now() - start);
	async.auto( tasks, function( error, results ) {
		var i, now;
		if ( error ) {
			callback( error );
			return;
		}

//		log( '\ndocuments with all joins:' );
//		log( documents );

		now = Date.now();
		for ( i = 0; i < documents.length; i += 1 ) {
			documents[i].tsCreate = now;
			documents[i].tsUpdate = now;
		}

		// finally store documents
		self.storages[self.name].insert( documents, function( error, result ) {
			var start = Date.now();
			var documents = [];
			var i, doc;

			if ( error ) {
				callback( error );
				return;
			}
//			log( '\ndocuments after insert:' );
//			log( result );

			// save transmitted IDs
			self.transmittedDocs.add( result );

			// fetch required fields
			for ( i = 0; i < result.length; i += 1 ) {
				doc = {};
				for ( j = 0; j < fields.length; j += 1 ) {
					doc[fields[j]] = result[i][fields[j]];
				}
				documents.push( doc );
			}

			totalTime += (Date.now() - start);
			log( 'Fetch fields, save transmitted IDs: ' + (Date.now() - start) );
			log( 'Count: ' + documents.length + ' Total time: ' + totalTime );

			// finally return stored documents
			callback( error, documents );
		} );
	} );
};



// block-retrieving surrogate task
brickTask = function( cb ) {
	var start = Date.now();
	var self = this.self;
	var brickName = this.brickName;
	var documents = this.documents;
	var depend = self.scheme.join[brickName].depend;
	var selector = { '_id': { '$in': [] } };

	var d;

	// loop over documents to prepare request for another brick
	// make request
	// loop over result to join required fields to document

	// loop over documents
	for ( d = 0; d < documents.length; d += 1 ) {
		selector._id.$in.push( documents[d][depend[1]] );
	}

//	log( '\nquery `' + brickName + '`:' );
//	log( query );

	totalTime += (Date.now() - start);
	log( 'Build request for brick: ' + (Date.now() - start) );
	// async request joins
	self.storages[brickName].find( { query: { selector: selector } }, {}, brickTaskFindCallback.bind( {
		self: self,
		brickName: brickName,
		documents: documents,
		cb: cb
	} ) );
};



brickTaskFindCallback = function( error, data ) {
	var start = Date.now(), compareTime = 0, assignTime = 0;
	var self = this.self;
	var brickName = this.brickName;
	var documents = this.documents;
	var cb = this.cb;
	var depend = self.scheme.join[brickName].depend;
	var document;
	var brickProperties = self.scheme.join[brickName].fields.concat( ['_id'] );
	var nice;
	var d, i, k;

	if ( error ) {
		cb( error );
		return;
	}

	// TODO: what if I put all data into Collectioner and make a find() in it?
	// loop over documents
	for ( d = 0; d < documents.length; d += 1 ) {
		// loop over data
		for ( i = 0; i < data.length; i += 1 ) {
			nice = false;

			if ( data[i]._id === documents[d][depend[1]] ) {
//				assignTime -= Date.now();
				// join properties from dataItem
				for ( k = 0; k < brickProperties.length; k += 1 ) {
					documents[d][(brickName + '_' + brickProperties[k])] = data[i][brickProperties[k]];
				}
//				assignTime += Date.now();

				nice = true;
				break;
			}
		}

		if ( nice === false ) {
			cb( new Error( 'Can\'t get join for document: ' + JSON.stringify( documents[d] ) ) );
		}
	}

	totalTime += (Date.now() - start);
//	log( 'Compare time: ' + compareTime );
//	log( 'Assign time: ' + assignTime );
	log( 'Join brick properties: ' + (Date.now() - start) );
	cb( error, true );
};



// Import and save updates
FlexoCollection.prototype.modify = function( query, options, callback ) {
	// query - объект или массив объектов query
	// query.selector - объект, поисковый запрос Mongo
	// query.properties - объект новых значений
	// [options] - объект
	// callback( error, documents ) - функция, получает массив измененных документов, сокращенных до _id, tsUpdate

	// loop over values to check all properties are mutableProperties
	// on rootJoinsProperties change - act like insert, otherwise just update

	var valid;
	var self = this;
	var storageQuery = [
		[], // simple query
		[], // complex query
		[]  // super-complex query
	];
	var tasks;
	var tsUpdate;
	var i, j, keys, complexity;

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
		if ( !flexoValidator.checkType[this.types._id.type]( query[i].selector._id ) ) {
			callback( new Error( 'Property `_id` must be a string in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		// add tsUpdate to prevent deletion of updated document
		tsUpdate = self.transmittedDocs.get( { _id: query[i].selector._id }, 'tsUpdate' );
		if ( tsUpdate.length === 0 ) {
			callback( new Error( 'Document with id `' + query[i].selector._id + '` wasn\'t transmitted to client before' ) );
			return;
		}

		// check properties
		keys = Object.keys( query[i].properties );
		for ( j = 0; j < keys.length; j += 1 ) {

			// check for mutation of immutable properties
			if ( this.mutableProperties.indexOf( keys[j] ) === -1 ) {
				callback( new Error( 'Mutating immutable property `' + keys[j] + '` in query: ' + JSON.stringify( query[i] ) ) );
				return;
			}

			// check types, validate
			valid = flexoValidator.validate( query[i].properties[keys[j]], this.scheme.root[keys[j]] );
			if ( valid.length !== 0 ) {
				callback( valid );
				return;
			}

			// sort queries for simple and complex
			if ( this.rootJoinProperties.indexOf( keys[j] ) !== -1 && complexity < 1 ) {
				complexity = 1;
			}
		}

		// do only tasks with non-empty properties
		if ( keys.length > 0 ) {
			storageQuery[complexity].push( {
				selector: {
					_id: query[i].selector._id,
					tsUpdate: tsUpdate[0]
				},
				properties: query[i].properties
			} );
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
		var depend, i, j, k, keys;
		var joins = self.joins;

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
			depend = self.scheme.join[joins[i]].depend;

			// get brick dependency
			task = (depend[0] === 'root') ? [] : [ depend[0] ];

			// join task function
			task.push( brickTask.bind( { self: self, brickName: joins[i], documents: documents } ) );

			tasks[joins[i]] = task;
		}

		async.auto( tasks, function( error ) {
			if ( error ) {
				callback( error );
				return;
			}

//				log( '\ndocuments with all joins:' );
//				log( query );

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

		self.storages[self.name].modify( query, function( error, documents ) {
			// result - array of documents: { _id, tsUpdate }
			var i;
			var start = Date.now();

			if ( error ) {
				callback( error );
				return;
			}
//			log( '\ndocuments after insert:' );
//			log( documents );

			// save transmitted IDs
//			self.transmittedDocs.add( documents );
			for ( i = 0; i < documents.length; i += 1 ) {
				// update transmitted tsUpdate
				self.transmittedDocs.set( { _id: documents[i]._id }, 'tsUpdate', documents[i].tsUpdate );
			}

			totalTime += (Date.now() - start);
			log( 'Fetch fields, Save transmitted IDs: ' + (Date.now() - start) );
			log( 'Count: ' + documents.length + ' Total time: ' + totalTime );
			// finally return stored documents
			callback( error, documents );
		} );
	} );
};



// Mark documents as deleted
FlexoCollection.prototype.delete = function( query, options, callback ) {
	// query - объект или массив объектов query
	// query.selector - объект, поисковый запрос Mongo
	// [options] - объект
	// callback( error, documents ) - функция, получает массив _id удаленных документов

	// query may be an array of single requests
	// act like find

	var self = this;
	var tsUpdate, storageQuery, i;

	if ( typeof query !== 'object' && !Array.isArray( query ) ) { throw new Error( 'Query required' ); }
	if ( typeof options === 'function' && callback === undefined ) {
		callback = options;
		options = {};
	}
	if ( typeof options !== 'object' ) { throw new Error( 'Options must be an object' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	query = Array.isArray( query ) ? query : [ query ];

	storageQuery = [];
	for ( i = 0; i < query.length; i += 1 ) {
		if ( typeof query[i].selector !== 'object' ) {
			callback( new Error( 'Selector required in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}
		if ( !flexoValidator.checkType[this.types._id.type]( query[i].selector._id ) ) {
			callback( new Error( 'Property `_id` must be a string in query: ' + JSON.stringify( query[i] ) ) );
			return;
		}

		// add tsUpdate to prevent deletion of updated document
		tsUpdate = self.transmittedDocs.get( { _id: query[i].selector._id }, 'tsUpdate' );
		if ( tsUpdate.length === 0 ) {
			callback( new Error( 'Document with id `' + query[i].selector._id + '` wasn\'t transmitted to client before' ) );
			return;
		}

		storageQuery.push( { selector: {
			_id: query[i].selector._id,
			tsUpdate: tsUpdate[0]
		}} );
	}

	// delete documents
	this.storages[this.name].delete( storageQuery, function( error, documents ) {
		if ( error ) {
			callback( error );
			return;
		}
		// documents - array of removed IDs

		// remove saved IDs
		self.transmittedDocs.remove( {
			_id: { $in: documents }
		} );

		callback( error, documents );
	} );
};



// Get array of available scheme names
getSchemes = function() {
	if ( !SETTINGS.ok ) { throw new Error( 'Flexo initialization required' ); }
};



// set constants, precache schemes
init = function( options, callback ) {
	// options - объект
	// options.[mock] - логическое, приводит к использованию имитации rabbit
	// options.[path] - строка, путь к схемам flexo
	// callback( error ) - функция, получает ошибку если что-то пошло не так

	var storagePath;

	if ( typeof options !== 'object' ) { throw new Error( 'Options required' ); }
	if ( typeof callback !== 'function' ) { throw new Error( 'Callback required' ); }

	if ( SETTINGS.ok ) { callback( new Error( 'Flexo reinitialization prohibited' ) ); }


	// set options
	if ( options.path !== undefined ) {
		SETTINGS.path = options.path;
		if ( SETTINGS.path[SETTINGS.path.length - 1] !== '/' ) {
			SETTINGS.path += '/';
		}
	}
	if ( options.mock !== undefined ) { SETTINGS.mock = options.mock; }

	// preread schemes
	// prebuild schemes

	storagePath = SETTINGS.mock ? __dirname + '/../../mock/storage' : 'rabbit';
	Storage = require( storagePath );

	SETTINGS.ok = true;

	Storage.init( {}, callback );
//	callback( null );
};



module.exports = {
	init: init,
	getSchemes: getSchemes,
	Collection: FlexoCollection
};
