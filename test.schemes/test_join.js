'use strict';

// Customer List

module.exports = {
	name: 'test_join',

	root: { // корень, содержит изменяемые поля
		// `_id`, `tsCreate`, `tsUpdate` добавляются автоматически
		name: { type: 'string' },
		inn: { type: 'string' },
		comment: { type: 'string' },
		array_of_id: { type: 'array', of: 'id', from: 'test_join' } // может быть пустым
	}
};
