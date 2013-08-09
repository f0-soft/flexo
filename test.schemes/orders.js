'use strict';

module.exports = {
	name: 'orders',

	root: {
		number: { type: 'string' },
		comments: { type: 'string' },
		services: { type: 'array', of: 'id', scheme: 'test_join' }
	}
};
