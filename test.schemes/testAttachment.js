'use strict';

module.exports = {
	name: 'testAttachment',
	root: {
		date: { type: 'number' },
		index: { type: 'string' },
		contract_id: { type: 'id', from: 'testContract', link: 'bill-manager' }
	}
};

var document1 = {
	_id: '4',
	date: 123,
	attachment_id: [ '3' ],
	_path: [
		{ c: 'testContract', k: 'contract_id', i: '3', o: '2' },

		{ c: 'testCustomer', k: 'contract_id', i: '2', o: '1' }
	]
};

var document2 = {
	_id: '5',
	date: 123,
	attachment_id: [ '3' ],
	_path: [
		{ c: 'testContract', k: 'contract_id', i: '3', o: '2' },

		{ c: 'testCustomer', k: 'contract_id', i: '2', o: '1' }
	]
};
