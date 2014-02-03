'use strict';

// Customer List

exports.name = 'test_join';
exports.root = { // корень, содержит изменяемые поля
	// `_id`, `tsCreate`, `tsUpdate` добавляются автоматически
	name: { type: 'str' },
	inn: { type: 'str' },
	comment: { type: 'str' },
	array_of_id: { type: 'id', from: 'test_join' } // может быть пустым
};
