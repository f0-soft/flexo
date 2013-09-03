'use strict';

module.exports = {
	name: 'testCustomer',
	root: {
		name: { type: 'string' },
		manager_id: { type: 'id', from: 'testManager', link: 'bill-manager' }
	}
};

var document = {
	_id: '2',
	name: 'ZAO Romashka',
	manager_id: '1'
};
