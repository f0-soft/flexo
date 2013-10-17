'use strict';

module.exports = {
	name: 'testContract',
	root: {
		date: { type: 'int' },
		index: { type: 'str' },
		customer_id: { type: 'idpath', from: 'testCustomer', link: 'bill-manager' }
	}
};
