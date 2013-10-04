'use strict';

module.exports = {
	name: 'testBill',
	root: {
		date: { type: 'number' },
		attachment_id: { type: 'array', of: 'id', from: 'testAttachment', link: 'bill-manager' } // в пути схема встречается только 1 раз, поэтому не нужно указывать позицию схемы в пути
	},

	before: {
		insert: [
			function( name, docs, callback ) {
				return callback( null );
			}
		],
		modify: [
			function( name, query, callback ) {
				return callback( null );
			}
		]
	},
	after: { // может содержать только `find`, `insert`, `modify`, delete`
		insert: [ // функции в массиве запускаются параллельно
			function( name, docs, callback ) { // каждая функция в `this` имеет объект с функциями flexo
				return callback( null );
			}
		],
		modify: [
			function( name, query, callback ) {
				return callback( null );
			}
		]
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
