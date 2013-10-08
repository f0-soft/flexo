'use strict';

module.exports = {
	name: 'testContract',
	root: {
		date: { type: 'number' },
		index: { type: 'string' },
		customer_id: { type: 'array', of: 'id', from: 'testCustomer', link: 'bill-manager' }
	}
};
