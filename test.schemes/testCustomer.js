'use strict';

module.exports = {
	name: 'testCustomer',
	root: {
		name: { type: 'string' },
		manager_id: { type: 'array', of: 'id', from: 'testManager', link: 'bill-manager' }
	}
};
