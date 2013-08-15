'use strict';

/*
 Перед запуском провести установку зависимостей `npm install`
 Для работы требует `collectioner` и `rabbit`, которые надо поместить в `node_modules` на уровне package.json
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 
 Для тестов с настоящим `rabbit`, надо ниже в переменной `flexoConfig` заменить значение mock на `false`
 Тест запускать через `node test/index.js`
 */

var mock = true;
//process.env.DEBUG = true;

var log = function() {};
if ( process.env.DEBUG ) { log = console.log; }



var flexoConfig = {
	storage: undefined,
	schemes: {
		test: {
			scheme: require( '../test.schemes/test' ),
			dict: {
				all: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_name', 'test_join_inn', 'test_join_comment'],
				mutable: ['name', 'inn', 'comment', 'join_id', 'array_of_id'],
				joinProperties: ['join_id'],
				joins: ['test_join'],
				types: {
					_id: {type: 'id'},
					tsCreate: {type: 'number'},
					tsUpdate: {type: 'number'},
					name: { type: 'string', validation: {len: [0, 20]}, messages: {} },
					inn: { type: 'string' },
					comment: { type: 'string' },
					join_id: { type: 'id' },
					array_of_id: { type: 'array', of: 'id', scheme: 'test_join' },
					test_join__id: {type: 'id'},
					test_join_name: { type: 'string' },
					test_join_inn: { type: 'string' },
					test_join_comment: { type: 'string' }
				}
			}
		},
		test_join: {
			scheme: require( '../test.schemes/test_join' ),
			dict: {
				all: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'array_of_id'],
				mutable: ['name', 'inn', 'comment', 'array_of_id'],
				joinProperties: [],
				joins: [],
				types: {
					_id: {type: 'id'},
					tsCreate: {type: 'number'},
					tsUpdate: {type: 'number'},
					name: { type: 'string' },
					inn: { type: 'string' },
					comment: { type: 'string' },
					array_of_id: { type: 'array', of: 'id', scheme: 'test_join' }
				}
			}
		}
	}
};

flexo_1 = { scheme: 'test', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_tsCreate', 'test_join_tsUpdate', 'test_join_name', 'test_join_inn', 'test_join_comment'] };
flexo_2 = { scheme: 'test_join', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'array_of_id'] };


var async = require( 'async' );
var Flexo = require( '../' );
var flexo_1, flexo_2;
var f1_ins, f2_ins;

function rnd() {
	return (Math.random() * 10000).toString( 10 );
}

var tasks = {
	'Init storage': function( callback ) {
		var storage;
		console.log( 'Init storage' );

		storage = mock ? require( '../mock/storage' ) : require( 'rabbit' );
		storage.init( {}, function( error, result ) {
			if ( error ) {
				callback( error );
				return;
			}

			flexoConfig.storage = result;
			callback( null, result );
		} );
	},
	'Init Flexo': function( callback ) {
		console.log( 'Init Flexo' );

		try {
			Flexo.init( flexoConfig, function( error ) {
				if ( error ) {
					callback( error );
					return;
				}

				callback( null, Flexo );
			} );
		} catch ( e ) {
			callback( e );
		}
	},

	'Check `test` is empty': function( callback ) {
		console.log( 'Check `test` is empty' );

		Flexo.Collection.find( flexo_1.scheme, flexo_1.fields, { selector: {}, options: {} }, {count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 0 ) { throw new Error( 'Empty DB before test' ); }
			if ( count !== 0 ) { throw new Error( 'Returned count is not equal 0' ); }

			callback( null, { data: data, count: count } );
		} );
	},

	'Check `test_join` is empty': function( callback ) {
		console.log( 'Check `test_join` is empty' );

		Flexo.Collection.find( flexo_2.scheme, flexo_2.fields, { selector: {} }, {count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 0 ) { throw new Error( 'Empty DB before test' ); }
			if ( count !== 0 ) { throw new Error( 'Returned count is not equal 0' ); }

			callback( null, { data: data, count: count } );
		} );
	},

	'Insert documents into `test_join`': function( callback ) {
		console.log( 'Insert documents into `test_join`' );

		Flexo.Collection.insert( flexo_2.scheme, flexo_2.fields, [
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd()]}
		], function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 3 ) {
				callback( new Error( 'Documents insertion didn\'t return result' ) );
				return;
			}

			if ( data[0]._id === undefined || data[1]._id === undefined || data[2]._id === undefined ) {
				callback( new Error( 'Documents have no _id' ) );
			}

			f2_ins = [
				{_id: data[0]._id, tsUpdate: data[0].tsUpdate},
				{_id: data[1]._id, tsUpdate: data[1].tsUpdate},
				{_id: data[2]._id, tsUpdate: data[2].tsUpdate}
			];

			callback( null, data );
		} );
	},

	'Find insertions into `test_join`': function( callback ) {
		var i, ids = [];
		console.log( 'Find insertions into `test_join`' );

		for ( i = 0; i < f2_ins.length; i += 1 ) {
			ids.push( f2_ins[i]._id );
		}

		Flexo.Collection.find( flexo_2.scheme, flexo_2.fields, {selector: {_id: {$in: ids}}}, {count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 3 ) {
				callback( new Error( 'Documents aren\'t saved' ) );
				return;
			}
			if ( count !== 3 ) {
				callback( new Error( 'Wrong count' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Insert documents into `test`': function( callback ) {
		console.log( 'Insert documents into `test`' );

		Flexo.Collection.insert( flexo_1.scheme, flexo_1.fields, [
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[2]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id, f2_ins[0]._id]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[1]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[0]._id, array_of_id: [f2_ins[2]._id]}
		], function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 3 ) {
				callback( new Error( 'Documents insertion didn\'t return result' ) );
				return;
			}

			if ( data[0]._id === undefined || data[1]._id === undefined || data[2]._id === undefined ) {
				callback( new Error( 'Documents have no _id' ) );
			}

			f1_ins = [
				{_id: data[0]._id, tsUpdate: data[0].tsUpdate},
				{_id: data[1]._id, tsUpdate: data[1].tsUpdate},
				{_id: data[2]._id, tsUpdate: data[2].tsUpdate}
			];

			callback( null, data );
		} );
	},

	'Find insertions into `test`': function( callback ) {
		var i, ids = [];
		console.log( 'Find insertions into `test`' );

		for ( i = 0; i < f1_ins.length; i += 1 ) {
			ids.push( f1_ins[i]._id );
		}

		Flexo.Collection.find( flexo_1.scheme, flexo_1.fields, {selector: {_id: {$in: ids}}}, {count: true}, function( error, data, count ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 3 || count !== 3 ) {
				callback( new Error( 'Documents aren\'t saved' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Modify `test` document': function( callback ) {
		console.log( 'Modify `test` document' );

		Flexo.Collection.modify( flexo_1.scheme, {selector: f1_ins[0], properties: {join_id: f2_ins[0]._id}}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 1 ) {
				callback( new Error( 'Document wasn\'t modified' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Check `test` document modification': function( callback ) {
		console.log( 'Check `test` document modification' );

		Flexo.Collection.find( flexo_1.scheme, flexo_1.fields, {selector: {_id: f1_ins[0]._id}}, {}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length === 0 ) {
				callback( new Error( 'Can\'t find modified document' ) );
				return;
			}
			if ( data[0]._id !== f1_ins[0]._id ) {
				callback( new Error( 'Find returned wrong document' ) );
				return;
			}
			if ( data[0].join_id !== f2_ins[0]._id ) {
				callback( new Error( 'Document wasn\'t modified' ) );
				return;
			}
			if ( data[0].test_join__id === undefined || data[0].test_join__id !== f2_ins[0]._id ) {
				callback( new Error( 'Join wasn\'t joined on modification' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Delete `test` document': function( callback ) {
		console.log( 'Delete `test` document' );

		Flexo.Collection.delete( flexo_1.scheme, {selector: f1_ins[1]}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 1 ) {
				callback( new Error( 'Document wasn\'t found' ) );
				return;
			}
			if ( data[0]._id !== f1_ins[1]._id ) {
				callback( new Error( 'Deleted _id not equal requested _id' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Check `test` document deletion': function( callback ) {
		console.log( 'Check `test` document deletion' );

		Flexo.Collection.find( flexo_1.scheme, flexo_1.fields, {selector: {}}, {count: true, all: true}, function( error, data, count ) {
			var i;
			if ( error ) {
				callback( error );
				return;
			}

			if ( count !== 2 ) {
				callback( new Error( 'Excessive documents in `test`' ) );
				return;
			}
			for ( i = 0; i < data.length; i += 1 ) {
				if ( data[i]._id === f1_ins[1]._id ) {
					callback( new Error( 'Document wasn\'t deleted' ) );
					return;
				}
			}

			callback( null, {data: data, count: count} );
		} );
	}
};

async.series( tasks, function( error, results ) {

	if ( error ) {
		console.log( '\nРезультаты:', results );
		console.log( '\nОшибка:', error, '\n' );
	} else {
		console.log( '\nТест пройден\n' );
	}

	process.kill();
} );
