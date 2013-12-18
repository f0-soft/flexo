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
		view: Starter.mock.view,
		controller: Starter.mock.controller,
		flexo_path: __dirname + '/../test.schemes',
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



module.exports = {
	'Init': function( t ) {
		catchAll( t );
		t.expect( 2 );

		Starter.init( starterConfig, function( err, c, all ) {
			t.ifError( err );

			t.ok( all.flexo );
			flexo = all.flexo;
			rabbit = all.rabbit;

			t.done();
		} );
	},

	'Check `test` is empty': function( t ) {
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
			} );

			t.done();
		} );
	},

	'Check `test_join` is empty': function( t ) {
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
			} );

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

function catchAll( test ) {
	process.removeAllListeners( 'uncaughtException' );
	process.on( 'uncaughtException', test.done );
}
