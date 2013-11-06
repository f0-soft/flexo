'use strict';

// Customer List

module.exports = {
	name: 'test_join',

	root: { // корень, содержит изменяемые поля
		// `_id`, `tsCreate`, `tsUpdate` добавляются автоматически
		name: { type: 'str' },
		inn: { type: 'str' },
		comment: { type: 'str' },
		array_of_id: { type: 'id', from: 'test_join' } // может быть пустым
	}
};
