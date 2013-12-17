// Описание подключения коллекции со всеми полями без изменений
var TestAll = {
	scheme: 'bills'
};

// Коллекция только с указанными полями
var TestSome = {
	scheme: 'bills',
	fields: ['_id', 'sum']
};

// Коллекция только с переименованными полями
var TestRename = {
	scheme: 'bills',
	fields: {
		id: '_id',
		summa: 'sum'
	}
};

// Коллекция со всеми полями и переименованием некоторых
var TestAllRename = {
	scheme: 'bills',
	fieldsAll: true,
	fields: {
		// новоеИмя : староеИмя
		id: '_id',
		summa: 'sum'
	}
};

// Коллекция с подменой id объектами
var TestPopulate = {
	scheme: 'bills',
	fieldsAll: true,
	fields: {
		contr_id: { // описание коллекции
			scheme: 'contract'
		}
	}
};

// Коллекция с переименованием и подменой id объектами
var TestRenamePopulate = {
	scheme: 'bills',
	fieldsAll: true,
	fields: {
		id: '_id',
		contracts: { // описание коллекции
			src: 'contr_id',
			scheme: 'contract'
		}
	}
};

// Коллекция с пропуском соседа
var TestSkipPopulate = {
	scheme: 'bills',
	fieldsAll: true,
	fields: {
		contr_id: { // будет содержать массив массивов объектов
			scheme: 'company'
		}
	}
};

// Коллекция с пропуском соседа и обработкой массива массивов объектов
var TestSkipPopulateProcess = {
	scheme: 'bills',
	fieldsAll: true,
	fields: {
		contr_id: { // будет содержать результат объединения массивов, без повторов
			scheme: 'company',
			proc: ['concat', 'unique']
		}
	}
};

// Перенос поля при связи 1:1 ???
var TestMove = {
	scheme: 'bills'
};

// Экспорт карты
module.exports = {
	name: 'test',
	map: TestAll
};
