'use strict';

module.exports = {
	name: 'testAttachment',
	root: {
		date: { type: 'int' },
		index: { type: 'str' },
		contract_id: { type: 'id', from: 'testContract', link: 'bill-manager' }
	}
};
