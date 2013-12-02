'use strict';

var argstype = require( 'f0.argstype' );
var async = require( 'async' );
var next = require( 'nexttick' );

function myErr( text ) {
	return new Error( 'f0.flexo.separateCount: ' + text );
}



var STORAGE;
var PARALLEL_LIMIT = 4;
var AMOUNT_LIMIT = 128;
var comparisons = {};
var checks = {};



comparisons.$eq = function( v, element ) { return (element === v); };
comparisons.$gt = function( v, element ) { return (element > v); };
comparisons.$gte = function( v, element ) { return (element >= v); };
comparisons.$lt = function( v, element ) { return (element < v); };
comparisons.$lte = function( v, element ) { return (element <= v); };

function ruleToArrayOfFunc( rule ) {
	var i, out = [];
	var keys = Object.keys( comparisons );
	
	for ( i = 0; i < keys.length; i += 1 ) {
		if ( rule[keys[i]] !== undefined ) {
			out.push( comparisons[keys[i]].bind( null, rule[keys[i]] ) );
		}
	}

	return out;
}



checks.separateCount = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['parent', true, 'o', [
			['coll', true, 's'],
			['field_sum', true, 's'],
			['field_parent', true, 's'],
			['selector', true, 'o']
		]],
		['child', true, 'o', [
			['coll', true, 's'],
			['field_sum', true, 's'],
			['field_parent', true, 's'],
			['selector', true, 'o']
		]],
		['groups', true, 'a', [
			'*', true, 'o', [
				['$eq', false, 'n'],
				['$gt', false, 'n'],
				['$gte', false, 'n'],
				['$lt', false, 'n'],
				['$lte', false, 'n']
			]
		]]
	]],
	['callback', true, 'f']
] );
function separateCount( request, callback ) {
	var errType = checks.separateCount( arguments );
	var i, container;

	if ( errType ) { return next( callback, errType ); }


	container = {
		request: request,
		callback: callback,

		parent: {
			request: request.parent,
			result: [],
			total: undefined,
			processed: 0,
			progress: 0,
			skip: 0,
			tasks: 0,
			queue: undefined,
			processor: undefined,
			rules: [],
			children: undefined,
			cb: undefined
		},
		child: {
			request: request.child,
			result: {},
			total: undefined,
			processed: 0,
			progress: 0,
			skip: 0,
			tasks: 0,
			queue: undefined,
			processor: undefined,
			cb: undefined
		}
	};
	container.child.queue = queue.bind( container.child );
	container.parent.queue = queue.bind( container.parent );
	container.child.processor = processChildren.bind( container.child );
	container.parent.processor = processParent.bind( container.parent );
	container.parent.children = container.child.result;

	for ( i = 0; i < request.groups.length; i += 1 ) {
		container.parent.rules.push( ruleToArrayOfFunc( request.groups[i] ) );
		container.parent.result.push( 0 );
	}

	return async.auto( {
		countChildren: [ countDocuments.bind( container.child ) ],
		startChildren: [ startQueue.bind( container.child ) ],
		countParent: [ 'countChildren', countDocuments.bind( container.parent ) ],
		startParents: [ 'startChildren', startQueue.bind( container.parent ) ],
	}, function( err, res ) {
		return callback( err, container.parent.result );
	} );
}


function startQueue( cb ) {
	var i;

	for ( i = 0; i < PARALLEL_LIMIT; i += 1 ) {
		findDocuments.call( this, this.queue );
	}

	this.cb = cb;
}

function countDocuments( cb ) {
	STORAGE.find( {
		collname: this.request.coll,
		selector: this.request.selector,
		fields: [ '_id' ],
		options: { count: true }
	}, function( err, data ) {
		if ( err ) { return cb( err ); }

		this.total = data.count;
		return cb();
	}.bind( this ) );
}

function queue( err, data ) {
	if ( err ) {
		this.queue = function() {};
		return this.callback( err );
	}

	if ( data.result.length === AMOUNT_LIMIT ) {
		findDocuments.call( this, this.queue );
	}

	this.result = this.processor( this.result, data.result );
	this.tasks -= 1;
	this.processed += data.result.length;
	if ( this.total !== undefined ) {
		this.progress = Math.floor( this.processed / this.total * 100 );
	}


	if ( this.tasks === 0 && data.result.length !== AMOUNT_LIMIT ) {
//		console.log( this.total );
		this.cb( err, this.result );
	}
}

function processChildren( result, data ) {
	var i, j, parent_id;

	var field_sum = this.request.field_sum;
	var field_id = this.request.field_parent;

	for ( i = 0; i < data.length; i += 1 ) {
		parent_id = undefined;
		for ( j = 0; j < data[i][field_id].length || 0; j += 1 ) {
			if ( data[i][field_id][j].split( '_', 2 ).length === 1 ) {
				parent_id = data[i][field_id][j];
				break;
			}
		}
		if ( !parent_id ) { continue; }

		if ( result[parent_id] ) {
			result[parent_id] += data[i][field_sum];
		} else {
			result[parent_id] = data[i][field_sum]
		}
	}

	return result;
}

function processParent( result, data ) {
	var i, j, k, nice, val;
	for ( i = 0; i < data.length; i += 1 ) {
		val = 0;
		if ( this.children[ data[i][this.request.field_parent] ] !== undefined ) {
			val = this.children[ data[i][this.request.field_parent] ] / data[i][this.request.field_sum] * 100;
		}
		for ( j = 0; j < this.rules.length; j += 1 ) {
			nice = true;
			for ( k = 0; k < this.rules[j].length; k += 1 ) {
				if ( !this.rules[j][k]( val ) ) {
					nice = false;
					break;
				}
			}
			if ( nice ) {
				this.result[j] += 1;
			}
		}
	}


	return result;
}

function findDocuments( cb ) {
	var mySkip = this.skip;
	this.skip += 1;
	this.tasks += 1;

	STORAGE.find( {
		collname: this.request.coll,
		selector: this.request.selector,
		fields: [ this.request.field_parent, this.request.field_sum ],
		options: {
			skip: mySkip * AMOUNT_LIMIT,
			limit: AMOUNT_LIMIT
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
