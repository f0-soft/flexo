'use strict';

module.exports = {
	name: 'scheme-0',
	root: {
		name: { type: 'str' },
		a_ids: { type: 'id' },
		a_ids__: {type: 'id', link: [
			// имя схемы, имя поля схемы (определяющего связи со следующим уровнем)
			[ 'scheme-A', 'b_ids' ],
			[ 'scheme-B', 'c_ids' ]
		]}
	}
};



// пример документа
var document_1 = {
	name: 'example',
	a_ids: [ 1, 2 ],
	a_ids__: [ 3, 4 ],
	_path: {
		'scheme-A': [
			{k: 'a_ids', i: 1, o: 5},
			{k: 'a_ids', i: 2, o: 6}
		]
	}
};



// пример записи в redis
var redis = {};

var from = 'scheme-0'; // название коллекции
var to = 'scheme-A'; // название коллекции
var field = 'a_ids'; // имя поля в корневом блоке, определяющего связи с ближайшим уровнем
var id = '1'; // _id документа коллекции from
var links = ['2', '3', '4']; // массив _id документов коллекции to, с которыми прямо или косвенно связан документ коллекции from

redis[( 'link|' + from + '|' + to + '|' + field + '|' + id )] = links.join( '|' );



// db.testScheme0.ensureIndex( {'path.c': 1, '_path.i': 1, '_path.l': 1}, {name: 'path'} );
// db.testScheme0.find( {$query: {'_path.k': 'a_ids'}, $hint: 'path', $explain: 1} ).toArray();

// повторять столько раз, сколько максимум встречается элементов, удовлетворяющих запросу, в одном документе коллекции
// db.testScheme0.update( {'_path': {$elemMatch: {c: 'scheme-A', i: 2, l: 6}}}, {$set: {'_path.$.l': 8}}, {multi: true} );


var rabbit = require( 'f0.rabbit' );
var collection = 'testBills';

rabbit.init( {}, function( error ) {
	var getRandom;
	var insertCallback;
	var limit = 1000;
	var loop = 0;
	var id1, id2, id3, i, docs, doc;

	if ( error ) {
		console.log( error );
		return;
	}

	getRandom = function( min, max ) {
		return Math.floor( Math.random() * (max - min) + min );
	};

	insertCallback = function( error, result ) {
		if ( error ) {
			console.log( error );
			return;
		}

		if ( loop < limit ) {
			loop += 1;

			docs = [];

			for ( i = loop * 10000; i < ((loop + 1) * 10000); i += 1 ) {

				doc = {
					tsCreate: getRandom( 1104559200, 1377706314 ),
					tsUpdate: getRandom( 1104559200, 1377706314 ),
					a_id: [],
					_path1: {
						'testAttachment': [],
						'testContract': []
					},
					_path2: []
				};

				id3 = (loop + 1).toString( 36 );
				id2 = (getRandom( loop * 100 + 1, (loop + 1) * 100 )).toString( 36 );
				id1 = (getRandom( loop * 10 + loop * 100 + 1, (loop + 1) * 10 + loop * 100 )).toString( 36 );

				doc.a_id.push( id1 );

				doc._path1.testAttachment.push( {k: 'a_id', i: id1, o: id2} );
				doc._path1.testContract.push( {k: 'a_id', i: id2, o: id3} );

				doc._path2.push( {c: 0, k: 'a_id', i: id1, o: id2} );
				doc._path2.push( {c: 1, k: 'a_id', i: id2, o: id3} );

				docs.push( doc );
			}

			rabbit.insert( collection, docs, insertCallback );
		} else {
			process.kill();
		}
	};

	insertCallback();
} );

/*
 индексы

 db.testBills.ensureIndex( {'_path1.testContract.k': 1, '_path1.testContract.o': 1}, {name: 'path1-cust'} );
 db.testBills.ensureIndex( {'_path2.c': 1, '_path2.k': 1, '_path2.o': 1}, {name: 'path2-cust'} );

 db.testBills.ensureIndex( {'_path1.testContract.k': 1, '_path1.testContract.o': 1, tsCreate: 1}, {name: 'path1-cust-create'} );
 db.testBills.ensureIndex( {'_path2.c': 1, '_path2.k': 1, '_path2.o': 1, tsCreate: 1}, {name: 'path2-cust-create'} );

 db.testBills.ensureIndex( {tsCreate: 1, '_path1.testContract.k': 1, '_path1.testContract.o': 1}, {name: 'path1-create-cust'} );
 db.testBills.ensureIndex( {tsCreate: 1, '_path2.c': 1, '_path2.k': 1, '_path2.o': 1}, {name: 'path2-create-cust'} );

 */


/*
 Задача: сравнить разную организацию хранения связей между объектами

 == Исходные данные ==
 Заказчиков: 1000
 Договоров: по 100 у каждого заказчика
 Приложений: по 10 у каждого договора
 Счетов: по 10 на каждое приложение
 Разброс времени создания счетов: 8.5 лет с 01.01.2005 по 28.08.2013 
 Итого: у каждого заказчика 10000 счетов

 == Документы ==
 {
     _id: (integerCounter).toString(36),
     tsCreate: getRandom( 1104559200, 1377706314 ),
     tsUpdate: getRandom( 1104559200, 1377706314 ),
     a_id: [ '%id1%' ],
     _path1: {
         'testAttachment': [
             { k: 'a_id', i: '%id1%', o: '%id2%' }
         ],
         'testContract': [
             { k: 'a_id', i: '%id2%', o: '%id3%' }
         ]
     },
     _path2: [
         { c: 0, k: 'a_id', i: '%id1%', o: '%id2%' }
         { c: 1, k: 'a_id', i: '%id2%', o: '%id3%' }
     ]
 }


 == Индексы ==
 path1-cust: {'_path1.testContract.k': 1, '_path1.testContract.o': 1}
 path2-cust: {'_path2.c': 1, '_path2.k': 1, '_path2.o': 1}
 path1-cust-create: {'_path1.testContract.k': 1, '_path1.testContract.o': 1, tsCreate: 1}
 path2-cust-create: {'_path2.c': 1, '_path2.k': 1, '_path2.o': 1, tsCreate: 1}
 path1-cust-create: {'_path1.testContract.k': 1, '_path1.testContract.o': 1, tsCreate: 1}
 path2-cust-create: {'_path2.c': 1, '_path2.k': 1, '_path2.o': 1, tsCreate: 1}


 == Объемы индексов ==
 _id_: 219 MB (229941824 B)
 path1-cust: 250 MB (261705584 B)
 path2-cust: 689 MB (722177904 B)
 path1-cust-create: 337 MB (353595648 B)
 path2-cust-create: 862 MB (903709632 B)
 path1-create-cust: 336 MB (352426480 B)
 path2-create-cust: 862 MB (903570640 B)


 == Результаты тестов ==
 Название\Индекс,                                 _id_ path1, _id_ path2, path1-cust, path2-cust, path1-cust-create, path2-cust-create, path1-create-cust, path2-create-cust
 Поиск счетов по 1 заказчику (10k),               132945,     140453,     80,         110,        128,               132
 Поиск счетов по 1 заказчику за 3 года (~3,5k),   159461,     137828,     57,         96,         90,                128
 Поиск счетов по 10 заказчикам (100k),            179743,     167386,     1420-462,   834-533,    710-487,           867-701,           73924,             167681
 Поиск счетов по 10 заказчикам за 3 года (~35k),  165527,     146762,     1103-453,   772-478,    469-241,           774-527,           16661,             87747
 Поиск счетов по 100 заказчикам (1m),             163394,     160951,     5072,       6812,       5727,              7546
 Поиск счетов по 100 заказчикам за 3 года (346k), 137154,     139286,     14722,      9796,       5915,              9526
 */
