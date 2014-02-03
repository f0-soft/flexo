'use strict';

exports.name = 'products';
exports.root = {
	name: { type: 'words', title: 'Название', weight: true },
	group_id: { type: 'id', title: 'Группа продукции' },
	code: { type: 'str', title: 'Код' },
	unit_id: { type: 'id', title: 'Единица измерения', from: 'unit' },
	weight: { type: 'str', title: 'Вес' },
	price: { type: 'money', title: 'Цена по умолчанию', weight: true },
	note: { type: 'str', title: 'Описание' }
};

/*
 db.products.createIndex({ name:1});
 db.products.createIndex({ code:1});
 db.products.createIndex({ price:1});
 db.products.createIndex({ '_a.group_id':1});
 db.products.createIndex({'_a._w_name':1, name:1});
 db.products.createIndex({'_a._w_name':1, code:1});
 db.products.createIndex({'_a._w_name':1, price:1});
 db.products.createIndex({'_a._w_name':1, '_a.group_id':1, name:1});
 db.products.createIndex({'_a._w_name':1, '_a.group_id':1, code:1});
 db.products.createIndex({'_a._w_name':1, '_a.group_id':1, price:1});


 name:{$lte: '3D телевизор LG Bravia 15 7v-5494913'},
 name:{$gte: 'LED телевизор LG Slim 65 oi-4979388'}
 db.products.find({$and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).skip(120).limit(1).sort({name:-1}).toArray()

 db.products.find({name:{$lte: '3D телевизор LG Bravia 15 7v-5494913'}, $and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).limit(2).sort({name:1}).explain()
 db.products.find({name:{$lte: '3D телевизор LG Bravia 15 7v-5494913'}, $and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).limit(2).sort({name:1}).toArray()
 db.products.find({$and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).limit(2).sort({name:1}).toArray()
 db.products.find({name:{$gte: 'LED телевизор LG Slim 65 oi-4979388'}, $and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).limit(2).sort({name:-1}).explain()
 db.products.find({$and:[{_a:{$elemMatch:{_w_name:{$in:[/^lg/]}}}}]}).limit(2).sort({name:-1}).explain()

 */
