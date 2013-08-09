'use strict';

/*
 Перед запуском провести установку зависимостей `npm install`
 Для работы требует `collectioner` и `rabbit`, которые надо поместить в `node_modules` на уровне package.json
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 
 Для тестов с настоящим `rabbit`, надо ниже в переменной `flexoConfig` заменить значение mock на `false`
 Тест запускать через `node test/index.js`
 */

var flexoConfig = { mock: true };



//process.env.DEBUG = true;

var log = process.env.DEBUG ? console.log : function() {};


var async = require( 'async' );

var Flexo = require( '../' );
var flexo_1, flexo_2;
var f1_ins, f2_ins;

function rnd() {
	return (Math.random() * 10000).toString( 10 );
}

var tasks = {
	'Init': function( callback ) {
		console.log( 'Init' );

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

	'New Flexo': function( callback ) {
		console.log( 'New Flexo' );

		try {
			flexo_1 = new Flexo.Collection( { scheme: 'test', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_tsCreate', 'test_join_tsUpdate', 'test_join_name', 'test_join_inn', 'test_join_comment'] } );
			flexo_2 = new Flexo.Collection( { scheme: 'test_join', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'array_of_id'] } );
		} catch ( error ) {
			callback( error );
			return;
		}

		callback( null, { flexo_1: flexo_1, flexo_2: flexo_2} );
	},

	'Check `test` is empty': function( callback ) {
		console.log( 'Check `test` is empty' );

		flexo_1.find( { selector: {}, options: {} }, {count: true, all: true}, function( error, data, count ) {
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

		flexo_2.find( { selector: {} }, {count: true, all: true}, function( error, data, count ) {
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

		flexo_2.insert( [
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

			f2_ins = [data[0]._id, data[1]._id, data[2]._id];

			callback( null, data );
		} );
	},

	'Find insertions into `test_join`': function( callback ) {
		console.log( 'Find insertions into `test_join`' );

		flexo_2.find( {selector: {_id: {$in: f2_ins}}}, {count: true, all: true}, function( error, data, count ) {
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

		flexo_1.insert( [
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[2], array_of_id: [f2_ins[2], f2_ins[1], f2_ins[0]]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[1], array_of_id: [f2_ins[2], f2_ins[1]]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[0], array_of_id: [f2_ins[2]]}
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

			f1_ins = [data[0]._id, data[1]._id, data[2]._id];

			callback( null, data );
		} );
	},

	'Find insertions into `test`': function( callback ) {
		console.log( 'Find insertions into `test`' );

		flexo_1.find( {selector: {_id: {$in: f1_ins}}}, {count: true, all: true}, function( error, data, count ) {
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

		flexo_1.modify( {selector: {_id: f1_ins[0]}, properties: {join_id: f2_ins[0]}}, function( error, data ) {
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

		flexo_1.find( {selector: {_id: f1_ins[0]}}, {all: true}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length === 0 ) {
				callback( new Error( 'Can\'t find modified document' ) );
				return;
			}
			if ( data[0]._id !== f1_ins[0] ) {
				callback( new Error( 'Find returned wrong document' ) );
				return;
			}
			if ( data[0].join_id !== f2_ins[0] ) {
				callback( new Error( 'Document wasn\'t modified' ) );
				return;
			}
			if ( data[0].test_join__id === undefined || data[0].test_join__id !== f2_ins[0] ) {
				callback( new Error( 'Join wasn\'t joined on modification' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Delete `test` document': function( callback ) {
		console.log( 'Delete `test` document' );

		flexo_1.delete( {selector: {_id: f1_ins[1]}}, function( error, data ) {
			if ( error ) {
				callback( error );
				return;
			}

			if ( data.length !== 1 ) {
				callback( new Error( 'Document wasn\'t found' ) );
				return;
			}
			if ( data[0]._id !== f1_ins[1] ) {
				callback( new Error( 'Deleted _id not equal requested _id' ) );
				return;
			}

			callback( null, data );
		} );
	},

	'Check `test` document deletion': function( callback ) {
		console.log( 'Check `test` document deletion' );

		flexo_1.find( {selector: {}}, {count: true, all: true}, function( error, data, count ) {
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
				if ( data[i]._id === f1_ins[1] ) {
					callback( new Error( 'Document wasn\'t deleted' ) );
					return;
				}
			}

			callback( null, {data: data, count: count} );
		} );
	}
};

async.series( tasks, function( error, results ) {
	var i;

	console.log( 'Результаты:', results );

	if ( error ) {
		console.log( 'Ошибка:', error );
	} else {
		console.log( 'Тест пройден' );
	}

	process.kill();
} );
