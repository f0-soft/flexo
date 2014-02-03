'use strict';

exports.name = 'sys_users';
exports.root = {
	login: { type: 'str', title: 'Логин', description: 'Логин пользователя' },
	role: { type: 'str', title: 'Роль', description: 'Роль' },
	company_id: { type: 'id', title: 'Идентификатор компании', description: 'Идентификатор компании' },
	name: { type: 'str', title: 'Имя пользователя', description: 'Имя пользователя' },
	lastname: { type: 'str', title: 'Фамилия пользователя', description: 'Фамилия пользователя' },
	fullname: { type: 'words', title: 'Фамилия пользователя', description: 'Фамилия и имя', weight: true },
	email: { type: 'str', title: 'Почтовый адрес', description: 'Почтовый адрес' },
	phone: { type: 'phone', title: 'Мобильный телефон', description: 'Мобильный телефон' }
};
