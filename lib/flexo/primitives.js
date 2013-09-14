'use strict';

/**
 * @constructor
 * @struct
 * @param {string} collection Name of collection
 * @param {string} field Name of path-defining field in root
 * @param {string} input _id of document link established from
 * @param {string} output _id of document link established to
 */
var pathElement = function( collection, field, input, output ) {
	this[ pathElement.collection ] = collection;
	this[ pathElement.field ] = field;
	this[ pathElement.input ] = input;
	this[ pathElement.output ] = output;
};
pathElement.collection = 'c';
pathElement.field = 'f';
pathElement.input = 'i';
pathElement.output = 'o';


module.exports = {
	pathElement: pathElement
};
