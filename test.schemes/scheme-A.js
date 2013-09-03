'use strict';

module.exports = {
	name: 'scheme-A',
	root: {
		name: { type: 'string' },
		b_ids: { type: 'array', of: 'id' }
	},
	path: [
		{ key: 'b_ids', path: [
			[ 'scheme-B', 'c_ids' ]
		]}
	]
};
