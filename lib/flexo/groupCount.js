'use strict';

var argstype = require( 'f0.argstype' );
var async = require( 'async' );
var next = require( 'nexttick' );
var flexoValidator = require( './flexoValidator' );



var log = function() {};
if ( process.env.DEBUG && process.env.DEBUG.indexOf( 'gcount' ) !== -1 ) { log = console.log; }



function myErr( text ) {
	return new Error( 'f0.flexo.groupCount: ' + text );
}



var STORAGE;
var SCHEMES;
var PARALLEL_LIMIT = 6;
var AMOUNT_LIMIT = 256;
var comparisons = {};
var checks = {};



comparisons.$eq = function( value, element ) { return (element === value); };
comparisons.$gt = function( value, element ) { return (element > value); };
comparisons.$gte = function( value, element ) { return (element >= value); };
comparisons.$lt = function( value, element ) { return (element < value); };
comparisons.$lte = function( value, element ) { return (element <= value); };

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
	['percentCb', true, 'f'],
	['callback', true, 'f']
] );
function groupCount( request, percentCb, callback ) {
	var obj, errType = checks.groupCount( arguments );
	if ( errType ) { return next( callback, errType ); }

	obj = new groupCountRequest( request, percentCb, callback );
	return obj.run();
}



var groupCountRequest = function( request, percentCb, cb ) {
	this.request = request;
	this.percentCb = percentCb;
	this.cb = cb;
	this.child = {
		total: 0,
		processed: 0,
		pages: 0,
		result: {}
	};
	this.parent = {
		total: 0,
		processed: 0,
		pages: 0,
		rules: [],
		result: []
	};
	this.progress = 0;
};

groupCountRequest.prototype.run = function() {
	var self = this;
	async.auto( {
		countChildren: [ this.countChildren.bind( this ) ],
		getChildren: [ 'countChildren', this.getChildren.bind( this ) ],
		countParents: [ 'getChildren', this.countParents.bind( this ) ],
		getParents: [ 'countParents', this.getParents.bind( this ) ]
	}, function( err ) {
		if ( err ) { return self.cb( err ); }

		var i, j, transformed, res = self.parent.result;
		var parentTypes = SCHEMES[ self.request.parent.coll ].dict.types;
		var childTypes = SCHEMES[ self.request.child.coll ].dict.types;

		self.child.result = null;

		for ( i = 0; i < res.length; i += 1 ) {
			transformed = flexoValidator.toUser( res[i].parentSum, parentTypes[ self.request.parent.field_sum ].type );
			if ( transformed[0] ) { return self.cb( myErr( '`' + self.request.parent.field_sum + '` - ' + transformed[0] ) ); }
			res[i].parentSum = transformed[1];

			transformed = flexoValidator.toUser( res[i].childSum, childTypes[ self.request.child.field_sum ].type );
			if ( transformed[0] ) { return self.cb( myErr( '`' + self.request.child.field_sum + '` - ' + transformed[0] ) ); }
			res[i].childSum = transformed[1];

			for ( j = 0; j < res[i].parents.length; j += 1 ) {
				res[i].parents[j] = Object.keys( res[i].parents[j] ).length;
			}
		}

		return self.cb( null, res );
	} );
};

groupCountRequest.prototype.callPercent = function() {
	var mem = process.memoryUsage();
	log( 'Mem: rss ' + Math.ceil( mem.rss / 1024 / 1024 ) + ', heapTotal ' + Math.ceil( mem.heapTotal / 1024 / 1024 ) + ', heapUsed ' + Math.ceil( mem.heapUsed / 1024 / 1024 ) );

	var parentFraction = (this.parent.total !== 0) ? (this.parent.processed / this.parent.total) : 0;
	var childFraction = (this.child.total !== 0) ? (this.child.processed / this.child.total) : 0;

	// родительские документы - 1/4 работы
	// дочерние документы - 3/4 работы
	var percent = Math.floor( (parentFraction + childFraction * 3) / 4 * 100 );

	if ( this.progress === percent ) { return; }

	log( 'Percent: ' + percent );
	this.progress = percent;
	this.percentCb( percent );
};

groupCountRequest.prototype.countChildren = function( cb ) {
	log( 'countChildren' );
	countDocuments( this.request.child.coll, this.request.child.selector, function( err, data ) {
		if ( err ) { return cb( err ); }

		this.child.total = data.count;
		this.child.pages = Math.ceil( this.child.total / AMOUNT_LIMIT );
		return cb( null );
	}.bind( this ) );
};

groupCountRequest.prototype.countParents = function( cb ) {
	log( 'countParents' );
	countDocuments( this.request.parent.coll, this.request.parent.selector, function( err, data ) {
		if ( err ) { return cb( err ); }

		this.parent.total = data.count;
		this.parent.pages = Math.ceil( this.parent.total / AMOUNT_LIMIT );
		return cb( null );
	}.bind( this ) );
};

groupCountRequest.prototype.getChildren = function( cb ) {
	log( 'getChildren' );
	var i, tasks = [], processor;
	processor = this.processChild.bind( this );

	if ( !this.child.pages ) { return cb(); }

	for ( i = 0; i < this.child.pages; i += 1 ) {
		tasks.push( {
			collname: this.request.child.coll,
			selector: this.request.child.selector,
			fields: [ this.request.child.field_link, this.request.child.field_sum ],
			page: i,
			processor: processor
		} );
	}

	return async.eachLimit( tasks, PARALLEL_LIMIT, findDocuments, cb );
};

groupCountRequest.prototype.processChild = function( data, cb ) {
	log( 'processChild' );
	var i, j, k, parent_id, paths, split, maxSplit = 0;
	var field_sum = this.request.child.field_sum;
	var field_id = this.request.child.field_link;

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
		paths = [];
		for ( j = 0; j < data[i][field_id].length; j += 1 ) {
			split = data[i][field_id][j].split( '_' );
			if ( split.length === 1 && !parent_id ) {
				parent_id = data[i][field_id][j];
			}
			if ( split.length < maxSplit ) { continue; }
			paths.push( split );
		}

		if ( !parent_id ) { continue; }

		// paths содержит только самые длинные пути заданного поля
		// если самые длинные пути не найдены, документ отбрасывается
		if ( !paths.length ) { continue; }



		if ( this.child.result[parent_id] ) {
			this.child.result[parent_id].sum += data[i][field_sum];
		} else {
			this.child.result[parent_id] = {
				sum: data[i][field_sum],
				parents: objTimes( maxSplit )
			}
		}

		for ( j = 0; j < paths.length; j += 1 ) {
			for ( k = 0; k < paths[j].length; k += 1 ) {
				this.child.result[parent_id].parents[k][ paths[j][k] ] = true;
			}
		}
	}

	this.child.processed += data.length;

	this.callPercent();
	cb();
};

groupCountRequest.prototype.getParents = function( cb ) {
	log( 'getParents' );
	var i, tasks = [], processor;
	var keys, maxParents = 0;
	processor = this.processParent.bind( this );

	if ( !this.parent.pages ) { return cb(); }

	keys = Object.keys( this.child.result );
	if ( keys.length ) {
		maxParents = this.child.result[ keys[0] ].parents.length - 1;
	}

	for ( i = 0; i < this.request.groups.length; i += 1 ) {
		this.parent.rules.push( ruleToArrayOfFunc( this.request.groups[i] ) );
		this.parent.result.push( {
			count: 0,
			parentSum: 0,
			childSum: 0,
			parents: objTimes( maxParents )
		} );
	}

	for ( i = 0; i < this.parent.pages; i += 1 ) {
		tasks.push( {
			collname: this.request.parent.coll,
			selector: this.request.parent.selector,
			fields: [ this.request.parent.field_link, this.request.parent.field_sum ],
			page: i,
			processor: processor
		} );
	}

	return async.eachLimit( tasks, PARALLEL_LIMIT, findDocuments, cb );
};

groupCountRequest.prototype.processParent = function( data, cb ) {
	log( 'processParent' );
	var i, j, k, z, nice, parentVal, child, childVal, percent, keys;

	for ( i = 0; i < data.length; i += 1 ) {
		child = this.child.result[ data[i][this.request.parent.field_link] ];

		parentVal = data[i][this.request.parent.field_sum];
		childVal = child ? child.sum : 0;
		percent = childVal / parentVal * 100;

		for ( j = 0; j < this.parent.rules.length; j += 1 ) {
			nice = true;
			for ( k = 0; k < this.parent.rules[j].length; k += 1 ) {
				if ( !this.parent.rules[j][k]( percent ) ) {
					nice = false;
					break;
				}
			}
			if ( nice ) {
				this.parent.result[j].count += 1;
				this.parent.result[j].parentSum += parentVal;
				this.parent.result[j].childSum += childVal;

				if ( !child ) { break; }

				for ( k = 0; k < (child.parents.length - 1); k += 1 ) {
					if ( !this.parent.result[j].parents[k] ) {
						this.parent.result[j].parents[k] = {};
					}
					keys = Object.keys( child.parents[k] );
					for ( z = 0; z < keys.length; z += 1 ) {
						this.parent.result[j].parents[k][ keys[z] ] = true;
					}
				}

				break;
			}
		}
	}

	this.parent.processed += data.length;

	this.callPercent();
	cb();
};

function countDocuments( name, selector, cb ) {
	STORAGE.find( {
		collname: name,
		selector: selector,
		fields: [ 'tsCreate' ],
		options: { limit: 1, count: true }
	}, cb );
}

function findDocuments( task, cb ) {
	STORAGE.find( {
		collname: task.collname,
		selector: task.selector,
		fields: task.fields,
		options: {
			skip: task.page * AMOUNT_LIMIT,
			limit: AMOUNT_LIMIT
		}
	}, function( err, data ) {
		if ( err ) { return cb( err ); }

		return task.processor( data.result, cb );
	} );
}

function objTimes( num ) {
	var i, out = [];
	for ( i = 0; i < num; i += 1 ) {
		out.push( {} );
	}
	return out;
}



function init( storage, schemes ) {
	STORAGE = storage;
	SCHEMES = schemes;
	return groupCount;
}



module.exports = init;
