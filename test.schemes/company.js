'use strict';

exports.name = 'company';
exports.root = {
	name: { type: 'words', title: 'Название компании', weight: true },
	m_id: { type: 'id', title: 'Менеджер', link: 'companyUser', from: 'sys_users', includeWeight: ['sys_users'] },
	type_id: { type: 'id', title: 'Тип контрагента' },
	inn: { type: 'str', title: 'ИНН' },
	kpp: { type: 'str', title: 'КПП' },
	ogrn: { type: 'str', title: 'ОГРН' },
	okpo: { type: 'str', title: 'ОКПО' },
	phone: { type: 'str', title: 'Телефон' },
	www: { type: 'str', title: 'WWW' },
	mail: { type: 'str', title: 'email' },
	note: { type: 'str', title: 'Описание' }
};

/*
 db.company.createIndex({'_a.m_id':1});
 db.company.createIndex({'_a.type_id':1});
 db.company.createIndex({inn:1})
 db.company.createIndex({name:1})
 db.company.createIndex({'_a.m_id_su_fullname':1});
 db.company.createIndex({'_a._w_name':1, name:1});
 db.company.createIndex({'_a._w_name':1, inn:1});
 db.company.createIndex({'_a._w_name':1, '_a.m_id_su_fullname':1});
 db.company.createIndex({'_a._w_name':1, '_a.type_id':1, name:1});
 db.company.createIndex({'_a._w_name':1, '_a.type_id':1,  inn:1});
 db.company.createIndex({'_a._w_name':1, '_a.type_id':1, '_a.m_id_su_fullname':1});
 db.company.createIndex({'_a._w_name':1, '_a.m_id_su_fullname':1, 'inn':1});

 */
