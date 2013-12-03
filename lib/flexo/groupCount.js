'use strict';

var argstype = require( 'f0.argstype' );
var async = require( 'async' );
var next = require( 'nexttick' );
var flexoValidator = require( './flexoValidator' );



function myErr( text ) {
	return new Error( 'f0.flexo.groupCount: ' + text );
}



var STORAGE;
var SCHEMES;
var PARALLEL_LIMIT = 6;
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



checks.groupCount = argstype.getChecker( myErr, [
	['request', true, 'o', [
		['parent', true, 'o', [
			['coll', true, 's'],
			['field_sum', true, 's'],
			['field_link', true, 's'],
			['selector', true, 'o']
		]],
		['child', true, 'o', [
			['coll', true, 's'],
			['field_sum', true, 's'],
			['field_link', true, 's'],
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
function groupCount( request, callback ) {
	var errType = checks.groupCount( arguments );
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
		container.parent.result.push( { count: 0, parentSum: 0, childSum: 0, parents: [] } );
	}

	return async.auto( {
		countChildren: [ countDocuments.bind( container.child ) ],
		startChildren: [ startQueue.bind( container.child ) ],
		countParent: [ 'countChildren', countDocuments.bind( container.parent ) ],
		startParents: [ 'startChildren', startQueue.bind( container.parent ) ]
	}, function( err ) {
		if ( err ) { return callback( err ); }

		var i, j, process, res = container.parent.result;
		var parentTypes = SCHEMES[ request.parent.coll ].dict.types;
		var childTypes = SCHEMES[ request.child.coll ].dict.types;

		for ( i = 0; i < res.length; i += 1 ) {
			process = flexoValidator.toUser( res[i].parentSum, parentTypes[ request.parent.field_sum ].type );
			if ( process[0] ) { return callback( myErr( '`' + request.parent.field_sum + '` - ' + process[0] ) ); }
			res[i].parentSum = process[1];

			process = flexoValidator.toUser( res[i].childSum, childTypes[ request.child.field_sum ].type );
			if ( process[0] ) { return callback( myErr( '`' + request.child.field_sum + '` - ' + process[0] ) ); }
			res[i].childSum = process[1];

			for ( j = 0; j < res[i].parents.length; j += 1 ) {
				res[i].parents[j] = Object.keys( res[i].parents[j] ).length;
			}
		}

		return callback( null, res );
	} );
}


function startQueue( cb ) {
	var i, keys, maxParents = 0;

	for ( i = 0; i < PARALLEL_LIMIT; i += 1 ) {
		findDocuments.call( this, this.queue );
	}

	this.cb = cb;

	if ( this.children ) {
		keys = Object.keys( this.children );
		if ( keys.length ) {
			maxParents = this.children[ keys[0] ].parents.length;
		}
		for ( i = 0; i < this.result.length; i += 1 ) {
			this.result[i].parents = objTimes( maxParents );
		}
	}
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


	if ( this.tasks === 0 ) {
		this.cb( err, this.result );
	}
}

function processChildren( result, data ) {
	var i, j, k, parent_id, maxSplit, paths, split;

	var field_sum = this.request.field_sum;
	var field_id = this.request.field_link;
	maxSplit = 0;

	if ( data.length ) {
		for ( i = 0; i < data[0][field_id].length; i += 1 ) {
			split = data[0][field_id][i].split( '_' );
			if ( split.length > maxSplit ) {
				maxSplit = split.length;
			}
		}
	}

	for ( i = 0; i < data.length; i += 1 ) {
		parent_id = undefined;
		for ( j = 0; j < data[i][field_id].length || 0; j += 1 ) {
			if ( data[i][field_id][j].split( '_', 2 ).length === 1 ) {
				parent_id = data[i][field_id][j];
				break;
			}
		}
		if ( !parent_id ) { continue; }

		paths = [];
		for ( j = 0; j < data[i][field_id].length; j += 1 ) {
			split = data[i][field_id][j].split( '_' );
			if ( split.length < maxSplit ) { continue; }
			paths.push( split );
		}

		// paths содержит только самые длинные пути заданного поля
		// если самые длинные пути не найдены, документ отбрасывается
		if ( !paths.length ) { continue; }

		if ( result[parent_id] ) {
			result[parent_id].sum += data[i][field_sum];
		} else {
			result[parent_id] = {
				sum: data[i][field_sum],
				parents: objTimes( maxSplit )
			}
		}

		for ( j = 0; j < paths.length; j += 1 ) {
			for ( k = 0; k < paths[j].length; k += 1 ) {
				result[parent_id].parents[k][ paths[j][k] ] = true;
			}
		}
	}

	return result;
}

function objTimes( num ) {
	var i, out = [];
	for ( i = 0; i < num; i += 1 ) {
		out.push( {} );
	}
	return out;
}

function processParent( result, data ) {
	var i, j, k, z, nice, parentVal, child, childVal, percent, keys;

	for ( i = 0; i < data.length; i += 1 ) {
		child = this.children[ data[i][this.request.field_link] ];

		parentVal = data[i][this.request.field_sum];
		childVal = child ? child.sum : 0;
		percent = childVal / parentVal * 100;

		for ( j = 0; j < this.rules.length; j += 1 ) {
			nice = true;
			for ( k = 0; k < this.rules[j].length; k += 1 ) {
				if ( !this.rules[j][k]( percent ) ) {
					nice = false;
					break;
				}
			}
			if ( nice ) {
				this.result[j].count += 1;
				this.result[j].parentSum += parentVal;
				this.result[j].childSum += childVal;

				if ( !child ) { break; }

				for ( k = 0; k < child.parents.length; k += 1 ) {
					this.result[j].parents[k] = this.result[j].parents[k] || {};
					keys = Object.keys( child.parents[k] );
					for ( z = 0; z < keys.length; z += 1 ) {
						this.result[j].parents[k][ keys[z] ] = true;
					}
				}

				break;
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
		fields: [ this.request.field_link, this.request.field_sum ],
		options: {
			skip: mySkip * AMOUNT_LIMIT,
			limit: AMOUNT_LIMIT
		}
	}, cb );
}



function init( storage, schemes ) {
	STORAGE = storage;
	SCHEMES = schemes;
	return groupCount;
}



module.exports = init;
