'use strict';

module.exports = {
	name: 'testCustomer',
	root: {
		name: { type: 'str' },
		manager_id: { type: 'id', from: 'testManager' }
	}
};
