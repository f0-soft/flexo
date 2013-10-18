'use strict';

var opcodes = {
	'^': 1,
	'$': 2,
	'i': 4,
	'm': 8,
	's': 16
};

function code( options ) {
	var res = 0;
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

module.exports = {
	opcodes: opcodes,
	code: code,
	decode: decode
};
