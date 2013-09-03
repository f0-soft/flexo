'use strict';

module.exports = {
	name: 'testContract',
	root: {
		date: { type: 'number' },
		index: { type: 'string' },
		customer_id: { type: 'id', from: 'testCustomer', link: 'bill-manager' }
	}
};

var document = {
	_id: '3',
	name: 'A001',
	customer_id: '2',
	_path: [
		{ c: 'testCustomer', k: 'customer_id', i: '2', o: '1' }
	]
};
