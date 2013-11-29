'use strict';

var argstype = require( 'f0.argstype' );



var STORAGE;
var PARALLEL_LIMIT = 6;
var AMOUNT_LIMIT = 100;

function separateCount( request, callback ) {
	var i;
	var container = {
		result: [],
		skip: 0,
		tasks: 0,
		workerCb: undefined,
		callback: callback
	};
	container.workerCb = counter.bind( container );

	for ( i = 0; i < PARALLEL_LIMIT; i += 1 ) {
		worker.call( container, container.workerCb );
	}
}

function counter( err, data ) {
	if ( err ) {
		this.workerCb = function() {};
		return this.callback( err );
	}

	if ( data.result.length !== AMOUNT_LIMIT ) {
		worker.call( this, this.workerCb );
	}

	this.result = processResult( this.result, data.result );
	this.tasks -= 1;

	if ( this.tasks === 0 && data.result.length !== AMOUNT_LIMIT ) {
		this.callback( err, this.result );
	}
}

function processResult( result, data ) {
	var i, j, parent_id, append;

	var id_field = 'bill_id';
	var sum_field = 'sum';

	for ( i = 0; i < data.length; i += 1 ) {
		parent_id = undefined;
		for ( j = 0; j < data[i][id_field].length || 0; j += 1 ) {
			if ( data[i][id_field][j].split( '_', 2 ).length === 1 ) {
				parent_id = data[i][id_field][j];
				break;
			}
		}
		if ( !parent_id ) { continue; }

		append = true;
		for ( j = 0; j < result.length; j += 1 ) {
			if ( result[j]._id === parent_id ) {
				append = false;
				result[j].sum += data[i][sum_field];
				break;
			}
		}
		if ( append ) {
			result.push( {
				_id: parent_id,
				sum: data[i][sum_field]
			} );
		}
	}

	return result;
}

function worker( cb ) {
	var mySkip = this.skip;
	this.skip += 1;
	this.tasks += 1;


	STORAGE.find( {
		collname: 'bank',
		selector: {},
		fields: ['bill_id', 'sum'],
		options: {
			sort: {tsCreate: 1},
			skip: mySkip * AMOUNT_LIMIT,
			limit: ( mySkip + 1 ) * AMOUNT_LIMIT
		}
	}, cb );
}

function init( options ) {
	STORAGE = options.storage;
}



module.exports = {
	init: init,
	separateCount: separateCount
};
