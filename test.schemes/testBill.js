'use strict';

module.exports = {
	name: 'testBill',
	root: {
		date: { type: 'int' },
		attachment_id: { type: 'idpath', from: 'testAttachment', link: 'bill-manager' } // в пути схема встречается только 1 раз, поэтому не нужно указывать позицию схемы в пути
	},

	before: {
		insert: [
			function( callback ) {
				return callback( null );
			}
		],
		modify: [
			function( callback ) {
				return callback( null );
			}
		]
	},
	after: { // может содержать только `find`, `insert`, `modify`, delete`
		insert: [ // функции в массиве запускаются параллельно
			function( callback ) { // каждая функция в `this` имеет объект с функциями flexo
				return callback( null );
			}
		],
		modify: [
			function( callback ) {
				return callback( null );
			}
		]
	}
};
