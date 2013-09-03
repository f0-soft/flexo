'use strict';

/*
 Для запуска требуется установка `nodeunit` через `npm -g i nodeunit`
 Перед запуском провести установку зависимостей `npm install` (требуется `f0.argstype` и `f0.rabbit`)
 Для тестов с настоящим `rabbit`, надо ниже закомментировать строку `mock = true;` 
 Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 

 Запуск теста:
 nodeunit test/index.js

 Очистка mongo и redis: 
 mongo --eval 'db.test.remove(); db.test_join.remove();' && redis-cli FLUSHALL
 */

var mock;
mock = true;

//process.env.DEBUG = true;
var log = function() { return arguments.length; };
if ( process.env.DEBUG ) { log = console.log; }

var Rabbit = mock ? require( '../mock/storage' ) : require( 'f0.rabbit' );
var Flexo = require( '../' );



var storageConfig = {};
var flexo, flexoConfig = {
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

var flexo_1 = { scheme: 'test', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_tsCreate', 'test_join_tsUpdate', 'test_join_name', 'test_join_inn', 'test_join_comment'] };
var flexo_2 = { scheme: 'test_join', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'array_of_id'] };
var f1_ins, f2_ins;

function rnd() {
	return (Math.random() * 10000).toString( 10 );
}



module.exports = {
	'Init storage': function( t ) {
		t.expect( 5 );

		Rabbit.init( storageConfig, function( err, result ) {
			t.ifError( err );

			t.ok( Rabbit.find );
			t.ok( Rabbit.insert );
			t.ok( Rabbit.modify );
			t.ok( Rabbit.delete );

			flexoConfig.storage = {
				find: Rabbit.find,
				insert: Rabbit.insert,
				modify: Rabbit.modify,
				delete: Rabbit.delete
			};

			t.done();
		} );
	},

	'Init Flexo': function( t ) {
		t.expect( 2 );

		Flexo.init( flexoConfig, function( err, container ) {
			t.ifError( err );

			t.ok( container );
			flexo = container;

			t.done();
		} );
	},

	'Check `test` is empty': function( t ) {
		t.expect( 4 );

		flexo.find( flexo_1.scheme, flexo_1.fields, { selector: {}, options: {} }, {count: true}, function( err, data, count ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 0, 'Empty DB before test' );
			t.deepEqual( count, 0, 'Returned count is not equal 0' );

			t.done();
		} );
	},

	'Check `test_join` is empty': function( t ) {
		t.expect( 4 );

		flexo.find( flexo_2.scheme, flexo_2.fields, { selector: {} }, {count: true}, function( err, data, count ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 0, 'Empty DB before test' );
			t.deepEqual( count, 0, 'Returned count is not equal 0' );

			t.done();
		} );
	},

	'Insert documents into `test_join`': function( t ) {
		t.expect( 9 );

		flexo.insert( flexo_2.scheme, flexo_2.fields, [
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd(), rnd()]},
			{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: [rnd()]}
		], {}, function( err, data ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 3, 'Documents insertion didn\'t return result' );

			t.ok( data[0]._id, 'Document has no _id' );
			t.ok( data[1]._id, 'Document has no _id' );
			t.ok( data[2]._id, 'Document has no _id' );

			t.ok( data[0].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data[1].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data[2].tsUpdate, 'Document has no tsUpdate' );

			f2_ins = [
				{_id: data[0]._id, tsUpdate: data[0].tsUpdate},
				{_id: data[1]._id, tsUpdate: data[1].tsUpdate},
				{_id: data[2]._id, tsUpdate: data[2].tsUpdate}
			];

			t.done();
		} );
	},

	'Find insertions into `test_join`': function( t ) {
		var i, ids = [];
		t.expect( 4 );

		for ( i = 0; i < f2_ins.length; i += 1 ) {
			ids.push( f2_ins[i]._id );
		}

		flexo.find( flexo_2.scheme, flexo_2.fields, {selector: {_id: {$in: ids}}}, {count: true}, function( err, data, count ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 3, 'Documents aren\'t saved' );
			t.deepEqual( count, 3, 'Wrong count' );

			t.done();
		} )
	},

	'Insert documents into `test`': function( t ) {
		t.expect( 9 );

		flexo.insert( flexo_1.scheme, flexo_1.fields, [
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[2]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id, f2_ins[0]._id]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[1]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id]},
			{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[0]._id, array_of_id: [f2_ins[2]._id]}
		], {}, function( err, data ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 3, 'Documents aren\'t saved' );

			t.ok( data[0]._id, 'Document has no _id' );
			t.ok( data[1]._id, 'Document has no _id' );
			t.ok( data[2]._id, 'Document has no _id' );

			t.ok( data[0].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data[1].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data[2].tsUpdate, 'Document has no tsUpdate' );

			f1_ins = [
				{_id: data[0]._id, tsUpdate: data[0].tsUpdate},
				{_id: data[1]._id, tsUpdate: data[1].tsUpdate},
				{_id: data[2]._id, tsUpdate: data[2].tsUpdate}
			];

			t.done();
		} )
	},

	'Find insertions into `test`': function( t ) {
		var i, ids = [];
		t.expect( 4 );

		for ( i = 0; i < f1_ins.length; i += 1 ) {
			ids.push( f1_ins[i]._id );
		}

		flexo.find( flexo_1.scheme, flexo_1.fields, {selector: {_id: {$in: ids}}}, {count: true}, function( err, data, count ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 3, 'Documents aren\'t saved' );
			t.deepEqual( count, 3, 'Wrong count' );

			t.done();
		} );
	},

	'Modify `test` document': function( t ) {
		t.expect( 3 );

		flexo.modify( flexo_1.scheme, [
			{selector: f1_ins[0], properties: {join_id: f2_ins[0]._id}}
		], {}, function( err, data ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 1, 'Document wasn\'t modified' );

			t.done();
		} );
	},

	'Check `test` document modification': function( t ) {
		t.expect( 8 );

		flexo.find( flexo_1.scheme, flexo_1.fields, {selector: {_id: f1_ins[0]._id}}, {}, function( err, data ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.notDeepEqual( data.length, 0, 'Can\'t find modified document' );
			t.ok( data[0], 'Document not defined' );
			t.ok( data[0]._id, 'Document has no field `_id`' );
			t.ok( data[0].join_id, 'Document has no field `join_id`' );
			t.deepEqual( data[0]._id, f1_ins[0]._id, 'Find returned wrong document' );
			t.deepEqual( data[0].join_id, f2_ins[0]._id, 'Document wasn\'t modified' );

			t.done();
		} );
	},

	'Delete `test` document': function( t ) {
		t.expect( 6 );

		flexo.delete( flexo_1.scheme, [
			{selector: f1_ins[1]}
		], {}, function( err, data ) {
			t.ifError( err );

			t.ok( data, 'No data returned' );
			t.deepEqual( data.length, 1, 'Document wasn\'t found' );
			t.ok( data[0], 'Document not defined' );
			t.ok( data[0]._id, 'Document has no field `_id`' );
			t.deepEqual( data[0]._id, f1_ins[1]._id, 'Deleted _id not equal requested _id' );

			t.done();
		} );
	},

	'Check `test` document deletion': function( t ) {
		t.expect( 9 );

		flexo.find( flexo_1.scheme, flexo_1.fields, {selector: {}}, {count: true, all: true}, function( err, data, count ) {
			t.ifError( err );

			t.deepEqual( count, 2, 'Excessive documents in `test`' );
			t.ok( data, 'No data returned' );
			t.ok( data[0], 'Document not defined' );
			t.ok( data[0]._id, 'Document has no field `_id`' );
			t.ok( data[1], 'Document not defined' );
			t.ok( data[1]._id, 'Document has no field `_id`' );
			t.notDeepEqual( data[0]._id, f1_ins[1]._id, 'Document wasn\'t deleted' );
			t.notDeepEqual( data[1]._id, f1_ins[1]._id, 'Document wasn\'t deleted' );

			t.done();
		} );
	}
};



/**
 * Available test methods
 */
var t = {
	expect: function( number ) { return number; },
	ok: function( value, message ) { return value;},
	deepEqual: function( actual, expected, message ) { return [actual, expected];},
	notDeepEqual: function( actual, expected, message ) { return [actual, expected];},
	strictEqual: function( actual, expected, message ) { return [actual, expected];},
	notStrictEqual: function( actual, expected, message ) { return [actual, expected];},
	throws: function( block, error, message ) { return block;},
	doesNotThrow: function( block, error, message ) { return block;},
	ifError: function( value ) { return value;},
	done: function() { return true;}
};
