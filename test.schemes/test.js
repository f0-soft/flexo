'use strict';

// Тестовая схема

// название схемы
// под этим именем схема попадает в глобальный объект
exports.name = 'test';


// корень
// содержит изменяемые поля
exports.root = {
	// `_id`, `tsCreate`, `tsUpdate` добавляются автоматически
	name: { type: 'str', validation: {len: [0, 20]}, messages: {} },
	inn: { type: 'str' },
	comment: { type: 'str' },
	join_id: { type: 'id' }, // автоматически обязательное поле из-за джойна
	array_of_id: { type: 'id', from: 'test_join' } // может быть пустым
};


// присоединения
// содержат неизменяемые поля
exports.join = {
	test_join: { // название схемы, становится префиксом
		rename: 'tj',
		fields: [ 'name', 'inn', 'comment' ], // `_id` добавляется автоматически
		depend: [ 'root', 'join_id' ] // связь через _id: название группы/корень, название поля группы/корня
	}
};



exports.before = {
	insert: [
		function( callback ) {
			console.log( 'before insert' );
			return callback( null, this.query );
		}
	],
	modify: [
		function( callback ) {
			console.log( 'before modify' );
			return callback( null, this.query );
		}
	]
};
exports.after = { // может содержать только `insert`, `modify`
	insert: [ // функции в массиве запускаются параллельно
		function( callback ) { // каждая функция в `this` имеет объект с функциями flexo
			console.log( 'after insert' );
			return callback( null, true );
		}
	],
	modify: [
		function( callback ) {
			console.log( 'after modify' );
			return callback( null, true );
		}
	]
};



// уникальные значения
// содержит индексы, которые должны быть уникальными на базу
// индекс может быть по 1 полю или более более
// индекс может включать в себя поля только из корневого блока
exports.unique = [
	['inn']
];
