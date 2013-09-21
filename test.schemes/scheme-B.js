'use strict';

module.exports = {
	name: 'scheme-B',
	root: {
		name: { type: 'string' },
		c_ids: { type: 'array', of: 'id' }
	}
};
