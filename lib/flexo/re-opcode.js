'use strict';

var opcodes = {
	'^': 1,
	'$': 2,
	'i': 4,
	'm': 8,
	's': 16
};

var skip = 4096;
var len = opcodes['^'] + opcodes['$'] + opcodes['i'] + opcodes['m'] + opcodes['s'];

function code( options ) {
	var res = skip;
	var keys = Object.keys( options );
	for ( var i = 0; i < keys.length; i += 1 ) {
		if ( opcodes[keys[i]] !== undefined ) {
			res += opcodes[keys[i]];
		}
	}
	return String.fromCharCode( res );
}

function decode( code ) {
	var res = {};
	var keys = Object.keys( opcodes );
	for ( var i = 0; i < keys.length; i += 1 ) {
		if ( code & opcodes[keys[i]] ) { res[keys[i]] = true; }
	}
	return res;
}

function split( str ) {
	var code;
	if ( !str.length ) { return [ {}, '' ]; }
	if ( hasOpcode( str ) ) {
		code = str.charCodeAt( 0 );
		str = str.substr( 1 );
	} else {
		code = opcodes['^'] + opcodes['$'];
	}
	return [ decode( code ), str ];
}
function hasOpcode( str ) {
	var code = str.charCodeAt( 0 );
	return (skip <= code && code <= (skip + len));
}

module.exports = {
	opcodes: opcodes,
	code: code,
	decode: decode,
	split: split,
	hasOpcode: hasOpcode
};
