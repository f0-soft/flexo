'use strict';

module.exports = {
	name: 'testCustomer',
	root: {
		name: { type: 'str' },
		manager_id: { type: 'ids', from: 'testManager' }
	}
};
