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
//mock = true;

//process.env.DEBUG = true;
var log = function() { };
if ( process.env.DEBUG ) { log = console.log; }

var _ = require( 'underscore' );
var Starter = require( 'f0.starter' );


var starterConfig = _.extend(
	{},
	Starter.config,
	{
		flexo: require( '../' ),
		'flexo-client': Starter.mock['flexo-client'],
		view: Starter.mock.view,
		controller: Starter.mock.controller,
		flexo_path: __dirname + '/../test.schemes',
		type_path: __dirname + '/../node_modules/f0.starter/scheme/types',
		link_path: __dirname + '/../test.links',
		view_path: __dirname + '/../test.view',
		template_path: __dirname + '/../test.tpl',
		collection_alias: {
			test: 'tt',
			test_join: 'tj',
			bills: 'bl',
			bank: 'bn'
		}
	}
);
if ( mock ) { starterConfig.rabbit = Starter.mock.rabbit; }
var flexo, rabbit;

var flexo_1 = { scheme: 'test', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_name', 'test_join_inn', 'test_join_comment'] };
var flexo_2 = { scheme: 'test_join', fields: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'array_of_id'] };
var f1_ins, f2_ins;

function rnd() {
	return parseInt( Math.random() * 10000 ).toString( 10 );
}


exports['Init'] = function( t ) {
	catchAll( t );
	t.expect( 2 );

	Starter.init( starterConfig, function( err, c, all ) {
		t.ifError( err );

		t.ok( all.flexo );
		flexo = all.flexo;
		rabbit = all.rabbit;

		t.done();
	} );
};

exports['Check `test` is empty'] = function( t ) {
	catchAll( t );
	t.expect( 8 );

	flexo.find( {name: flexo_1.scheme, fields: flexo_1.fields, query: {}, options: {count: true}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.deepEqual( data.count, 0, 'Returned count is not equal 0' );

			t.ok( Array.isArray( data.result ) );
			t.deepEqual( data.result.length, 0, 'Empty DB before test' );

			if ( data.count || data.result.length ) {
				console.log( 'Тестовая коллекция `test` должна быть пустой' );
				process.exit();
			}
		} );

		t.done();
	} );
};

exports['Check `test_join` is empty'] = function( t ) {
	catchAll( t );
	t.expect( 9 );

	flexo.find( {name: flexo_2.scheme, fields: flexo_2.fields, query: {}, options: {count: true}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields )
			t.deepEqual( data.count, 0, 'Returned count is not equal 0' );

			t.ok( Array.isArray( data.result ) );
			t.deepEqual( data.result.length, 0, 'Empty DB before test' );

			if ( data.count || data.result.length ) {
				console.log( 'Тестовая коллекция `test` должна быть пустой' );
				process.exit();
			}
		} );

		t.done();
	} );
};

exports['Insert documents into `test_join`'] = function( t ) {
	catchAll( t );
	t.expect( 12 );

	flexo.insert( {name: flexo_2.scheme, fields: flexo_2.fields, query: [
		{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: ['xx' + rnd(), 'xx' + rnd(), 'xx' + rnd()]},
		{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: ['xx' + rnd(), 'xx' + rnd()]},
		{ name: rnd(), inn: rnd(), comment: rnd(), array_of_id: 'xx' + rnd() }
	], options: {}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.deepEqual( data.result.length, 3, 'Documents insertion didn\'t return result' );

			t.ok( data.result[0]._id, 'Document has no _id' );
			t.ok( data.result[1]._id, 'Document has no _id' );
			t.ok( data.result[2]._id, 'Document has no _id' );

			t.ok( data.result[0].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data.result[1].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data.result[2].tsUpdate, 'Document has no tsUpdate' );

			f2_ins = [
				{_id: data.result[0]._id, tsUpdate: data.result[0].tsUpdate},
				{_id: data.result[1]._id, tsUpdate: data.result[1].tsUpdate},
				{_id: data.result[2]._id, tsUpdate: data.result[2].tsUpdate}
			];
		} );

		t.done();
	} );
};

exports['Find insertions into `test_join`'] = function( t ) {
	catchAll( t );
	var i, ids = [];
	t.expect( 9 );

	for ( i = 0; i < f2_ins.length; i += 1 ) {
		ids.push( f2_ins[i]._id );
	}

	flexo.find( {name: flexo_2.scheme, fields: flexo_2.fields, query: {_id: {$in: ids}}, options: {count: true}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.deepEqual( data.count, 3, 'Wrong count' );

			t.ok( Array.isArray( data.result ) );
			t.deepEqual( data.result.length, 3, 'Documents aren\'t saved' );
		} );

		t.done();
	} )
};

exports['Insert documents into `test`'] = function( t ) {
	catchAll( t );
	t.expect( 13 );

	flexo.insert( {name: flexo_1.scheme, fields: flexo_1.fields, query: [
		{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[2]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id, f2_ins[0]._id]},
		{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[1]._id, array_of_id: [f2_ins[2]._id, f2_ins[1]._id]},
		{ name: rnd(), inn: rnd(), comment: rnd(), join_id: f2_ins[0]._id, array_of_id: [f2_ins[2]._id]}
	], options: {}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.deepEqual( data.result.length, 3, 'Documents aren\'t saved' );

			t.ok( data.result[0]._id, 'Document has no _id' );
			t.ok( data.result[1]._id, 'Document has no _id' );
			t.ok( data.result[2]._id, 'Document has no _id' );

			t.ok( data.result[0].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data.result[1].tsUpdate, 'Document has no tsUpdate' );
			t.ok( data.result[2].tsUpdate, 'Document has no tsUpdate' );

			f1_ins = [
				{_id: data.result[0]._id, tsUpdate: data.result[0].tsUpdate},
				{_id: data.result[1]._id, tsUpdate: data.result[1].tsUpdate},
				{_id: data.result[2]._id, tsUpdate: data.result[2].tsUpdate}
			];
		} );

		t.done();
	} )
};

exports['Find insertions into `test`'] = function( t ) {
	catchAll( t );
	var i, ids = [];
	t.expect( 9 );

	for ( i = 0; i < f1_ins.length; i += 1 ) {
		ids.push( f1_ins[i]._id );
	}

	flexo.find( {name: flexo_1.scheme, fields: flexo_1.fields, query: {_id: {$in: ids}}, options: {count: true}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.ok( Array.isArray( data.result ) );
			t.deepEqual( data.result.length, 3, 'Documents aren\'t saved' );
			t.deepEqual( data.count, 3, 'Wrong count' );
		} );

		t.done();
	} );
};

exports['Modify `test` document'] = function( t ) {
	catchAll( t );
	t.expect( 3 );

	flexo.modify( {name: flexo_1.scheme, query: [
		{ selector: f1_ins[0], properties: {join_id: f2_ins[0]._id} }
	], options: {}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( data.length, 1, 'Document wasn\'t modified' );

		t.done();
	} );
};

exports['Check `test` document modification'] = function( t ) {
	catchAll( t );
	t.expect( 13 );

	flexo.find( {name: flexo_1.scheme, fields: flexo_1.fields, query: {_id: f1_ins[0]._id}, options: {}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.ok( Array.isArray( data.result ) );
			t.notDeepEqual( data.result.length, 0, 'Can\'t find modified document' );
			t.ok( data.result[0], 'Document not defined' );
			t.ok( data.result[0]._id, 'Document has no field `_id`' );
			t.ok( data.result[0].join_id, 'Document has no field `join_id`' );
			t.deepEqual( data.result[0]._id, f1_ins[0]._id, 'Find returned wrong document' );
			t.deepEqual( data.result[0].join_id, [f2_ins[0]._id], 'Document wasn\'t modified' );
		} );

		t.done();
	} );
};

exports['Delete `test` document'] = function( t ) {
	catchAll( t );
	t.expect( 6 );

	flexo.delete( {name: flexo_1.scheme, query: [ f1_ins[1] ], options: {}}, function( err, data ) {
		t.ifError( err );

		t.ok( data, 'No data returned' );
		t.deepEqual( data.length, 1, 'Document wasn\'t found' );
		t.ok( data[0], 'Document not defined' );
		t.ok( data[0]._id, 'Document has no field `_id`' );
		t.deepEqual( data[0]._id, f1_ins[1]._id, 'Deleted _id not equal requested _id' );

		t.done();
	} );
};

exports['Check `test` document deletion'] = function( t ) {
	catchAll( t );
	t.expect( 14 );

	flexo.find( {name: flexo_1.scheme, fields: flexo_1.fields, query: {}, options: {count: true}}, function( err, data ) {
		t.ifError( err );

		t.ok( data );
		t.deepEqual( typeof data, 'object' );
		t.doesNotThrow( function() {
			t.ok( data.result );
			t.ok( data.idFields );
			t.ok( Array.isArray( data.result ) );
			t.deepEqual( data.count, 2, 'Excessive documents in `test`' );

			t.ok( data.result[0], 'Document not defined' );
			t.ok( data.result[0]._id, 'Document has no field `_id`' );
			t.ok( data.result[1], 'Document not defined' );
			t.ok( data.result[1]._id, 'Document has no field `_id`' );
			t.notDeepEqual( data.result[0]._id, f1_ins[1]._id, 'Document wasn\'t deleted' );
			t.notDeepEqual( data.result[1]._id, f1_ins[1]._id, 'Document wasn\'t deleted' );
		} );

		t.done();
	} );
};

exports['Clear'] = function( t ) {
	catchAll( t );
	t.expect( 8 );

	flexo.find( {
		name: flexo_1.scheme,
		fields: ['_id', 'tsUpdate'],
		query: {}
	}, function( err, data ) {
		t.ifError( err );

		t.ok( data.result.length );

		flexo.delete( {
			name: flexo_1.scheme,
			query: data.result
		}, function( err, data ) {
			t.ifError( err );

			t.ok( data.length );

			flexo.find( {
				name: flexo_2.scheme,
				fields: ['_id', 'tsUpdate'],
				query: {}
			}, function( err, data ) {
				t.ifError( err );

				t.ok( data.result.length );

				flexo.delete( {
					name: flexo_2.scheme,
					query: data.result
				}, function( err, data ) {
					t.ifError( err );

					t.ok( data.length );

					t.done();
				} );
			} );
		} );
	} );
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

function catchAll( test ) {
	process.removeAllListeners( 'uncaughtException' );
	process.on( 'uncaughtException', test.done );
}
