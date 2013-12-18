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

	'Group count': function( t ) {
		catchAll( t );
		t.expect( 2 );

		console.time( 'groupCount' );
		flexo.groupCount( {
			parent: {
				coll: 'bills',
				field_sum: 'sum',
				field_link: '_id',
				selector: {}
			},
			child: {
				coll: 'bank',
				field_sum: 'sum',
				field_link: 'bill_id',
				selector: {}
			},
			groups: [
				{ $gte: 100 },
				{ $gte: 66, $lt: 100 },
				{ $gte: 33, $lt: 66 },
				{ $gt: 0, $lt: 33 },
				{ $eq: 0 }
			]
		}, function( percent ) {
			console.log( percent );
		}, function( err, res ) {
			console.timeEnd( 'groupCount' );
			t.ifError( err );
			t.ok( res );
			console.log( res );
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
