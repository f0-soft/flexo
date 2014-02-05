'use strict';

//TODO: провести тест
var Starter = require( 'f0.starter' );
var _ = require( 'underscore' );



var starterConfig = _.extend(
	{}, // empty
	Starter.config, // initial config
	{
		// replace unnecessary modules
		flexo: Starter.mock.flexo,
		'flexo-client': Starter.mock['flexo-client'],
		view: Starter.mock.view,
		controller: Starter.mock.controller,

		flexo_path: __dirname + '/../test.schemes',
		type_path: __dirname + '/../node_modules/f0.starter/scheme/types',
		link_path: __dirname + '/../test.other',
		view_path: __dirname + '/../test.other',
		template_path: __dirname + '/../test.other',

		collection_alias: {
			testWordsArray: 'wa'
		}
	}
);



var RABBIT; // модуль
var COLL = 'testWordsArray'; // название коллекции
var DOC_ID; // переменная для хранения _id
var DOC_UPDATE; // переменная для хранения tsUpdate



exports['Init'] = function( t ) {
	t.expect( 4 );

	Starter.init( starterConfig, function( err, c, all ) {
		t.ifError( err );

		t.doesNotThrow( function() {
			t.ok( all );
			t.ok( all.rabbit );

			RABBIT = all.rabbit;
		} );

		t.done();
	} );

};

exports['Insert'] = function( t ) {
	t.expect( 2 );

	RABBIT.insert( {
		collname: COLL,
		doc: {
			str: 'qwe',
			words: 'asd zxc',
			array: [ 1 ]
		}
	}, function( err, data ) {
		console.log( arguments );
		t.ifError( err );

		t.doesNotThrow( function() {
			DOC_ID = data._id;
			DOC_UPDATE = data.tsUpdate;
		} );

		t.done();
	} );
};

// работает
exports['Modify str+words'] = function( t ) {
	t.expect( 2 );

	RABBIT.modify( {
		collname: COLL,
		doc: {
			selector: {
				_id: DOC_ID,
				tsUpdate: DOC_UPDATE
			},
			properties: {
				str: 'asd',
				words: 'rty fgh'
			}
		}
	}, function( err, data ) {
		t.ifError( err );

		t.doesNotThrow( function() {
			DOC_ID = data._id;
			DOC_UPDATE = data.tsUpdate;
		} );

		t.done();
	} );
};

// работает
exports['Modify words+array'] = function( t ) {
	t.expect( 2 );

	RABBIT.modify( {
		collname: COLL,
		doc: {
			selector: {
				_id: DOC_ID,
				tsUpdate: DOC_UPDATE
			},
			properties: {
				words: 'zxc vbn',
				array: [ 1, 2 ]
			}
		}
	}, function( err, data ) {
		t.ifError( err );

		t.doesNotThrow( function() {
			DOC_ID = data._id;
			DOC_UPDATE = data.tsUpdate;
		} );

		t.done();
	} );
};

// не работает
exports['Modify str+array'] = function( t ) {
	t.expect( 2 );

	RABBIT.modify( {
		collname: COLL,
		doc: {
			selector: {
				_id: DOC_ID,
				tsUpdate: DOC_UPDATE
			},
			properties: {
				str: 'jkl',
				array: [1, 2, 3]
			}
		}
	}, function( err, data ) {
		t.ifError( err );

		t.doesNotThrow( function() {
			DOC_ID = data._id;
			DOC_UPDATE = data.tsUpdate;
		} );

		t.done();
	} );
};
