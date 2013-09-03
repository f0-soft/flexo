'use strict';

module.exports = {
	name: 'testBill',
	root: {
		date: { type: 'number' },
		attachment_id: { type: 'array', of: 'id', from: 'testAttachment', link: 'bill-manager' } // в пути схема встречается только 1 раз, поэтому не нужно указывать позицию схемы в пути
	}
};

var document = {
	_id: '6',
	date: 123,
	attachment_id: [ '4', '5' ],
	_path: [
			{ c: 'testAttachment', k: 'attachment_id', i: '4', o: '3' },
			{ c: 'testAttachment', k: 'attachment_id', i: '5', o: '3' },
		
			{ c: 'testContract', k: 'attachment_id', i: '3', o: '2' },
		
			{ c: 'testCustomer', k: 'attachment_id', i: '2', o: '1' }
	]
};
