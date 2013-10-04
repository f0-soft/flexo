'use strict';

// Тестовая схема

module.exports = {
	// название схемы
	// под этим именем схема попадает в глобальный объект
	name: 'test',


	// корень
	// содержит изменяемые поля
	root: {
		// `_id`, `tsCreate`, `tsUpdate` добавляются автоматически
		name: { type: 'string', validation: {len: [0, 20]}, messages: {} },
		inn: { type: 'string' },
		comment: { type: 'string' },
		join_id: { type: 'id' }, // автоматически обязательное поле из-за джойна
		array_of_id: { type: 'array', of: 'id', from: 'test_join', inline: 'array_of_id' } // может быть пустым
	},


	// присоединения
	// содержат неизменяемые поля
	join: {
		test_join: { // название схемы, становится префиксом
			rename: 'tj',
			fields: [ 'name', 'inn', 'comment' ], // `_id` добавляется автоматически
			depend: [ 'root', 'join_id' ] // связь через _id: название группы/корень, название поля группы/корня
		}
	},



	before: {
		insert: [
			function( name, docs, callback ) {
				console.log( 'before insert' );
				return callback( null, true );
			}
		],
		modify: [
			function( name, query, callback ) {
				console.log( 'before modify' );
				return callback( null, true );
			}
		]
	},
	after: { // может содержать только `insert`, `modify`
		insert: [ // функции в массиве запускаются параллельно
			function( name, docs, callback ) { // каждая функция в `this` имеет объект с функциями flexo
				console.log( 'after insert' );
				return callback( null, true );
			}
		],
		modify: [
			function( name, query, callback ) {
				console.log( 'after modify' );
				return callback( null, true );
			}
		]
	},



	// уникальные значения
	// содержит индексы, которые должны быть уникальными на базу
	// индекс может быть по 1 полю или более более
	// индекс может включать в себя поля только из корневого блока
	unique: [
		['inn']
	]
};
