'use strict';

module.exports = {
	name: 'testAttachment',
	root: {
		date: { type: 'number' },
		index: { type: 'string' },
		contract_id: { type: 'array', of: 'id', from: 'testContract', link: 'bill-manager' }
	}
};
