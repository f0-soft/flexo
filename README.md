Flexo
=====

## Инструкция по установке
* Перед запуском провести установку зависимостей `npm install`
* Для работы требует `collectioner` и `rabbit`, которые надо поместить в `node_modules` на уровне package.json
* Перед запуском с настоящим `rabbit` следует очистить коллекции `test` и `test_join` 
* Для тестов с настоящим `rabbit`, в файле `test/index.js` в переменной `flexoConfig` надо заменить значение mock на `false`
* Тест запускать через `node test/index.js`



## TODO
* поддержка хуков на Pre-/Post- Find/Insert/Modify/Delete, способные предотвратить действие;
* поддержка уникальных индексов, предотвращающих создание дублирующих документов;
* поддержка вычисляемых полей;
* проверка типов данных в запросах;
* валидация документов при Insert/Modify;
* поддержка схем из глобального объекта.



## init( options, callback )
Производит инициализацию библиотеки.

Параметры:
* ```options``` - объект
	* ```storage``` - объект, содержит функции работы с хранилищем (```find```, ```insert```, ```modify```, ```delete```)
	* ```schemes``` - объект, содержит доступные схемы со справочниками
* ```callback( error, collection )``` - функция
	* ```collection``` - объект, содержит функции работы с библиотекой: ```find```, ```insert```, ```modify```, ```delete```

Пример ```schemes```
```
var schemes = {
	orders: {
		scheme: require( './test.schemes/orders.js' ),
		dict: {
			// все поля документа, влючая системные _id, tsCreate, tsUpdate
			all: ['_id', 'tsCreate', 'tsUpdate', 'number', 'comments', 'services'],

			// изменяемые поля корневого блока
			mutable: ['number', 'comments', 'services'],

			// поля корневого блока от которых зависят джойны
			joinProperties: [],

			// названия схем присоединяемых блоков
			joins: [],

			types: { // справочник типов всех полей (значения полей из схемы), type обязателен
				_id: {type: 'id'},
				tsCreate: {type: 'number'},
				tsUpdate: {type: 'number'},
				number: { type: 'string' },
				comments: { type: 'string' },
				services: { type: 'array', of: 'id', scheme: 'test_join' }
			}
		}
	},
	test: {
		scheme: require( './test.schemes/test.js' ),
		dict: {
			// все поля документа, влючая системные _id, tsCreate, tsUpdate
			all: ['_id', 'tsCreate', 'tsUpdate', 'name', 'inn', 'comment', 'join_id', 'array_of_id', 'test_join__id', 'test_join_name', 'test_join_inn', 'test_join_comment'],

			// изменяемые поля корневого блока
			mutable: ['name', 'inn', 'comment', 'join_id', 'array_of_id'],

			// поля корневого блока от которых зависят джойны
			joinProperties: ['join_id'],

			// названия схем присоединяемых блоков
			joins: ['test_join'],

			types: { // справочник типов всех полей (значения полей из схемы), type обязателен
				_id: {type: 'id'},
				tsCreate: {type: 'number'},
				tsUpdate: {type: 'number'},
				name: { type: 'string', validation: {len: [0, 20]}, messages: {} },
				inn: { type: 'string' },
				comment: { type: 'string' },
				join_id: { type: 'id' },
				array_of_id: { type: 'array', of: 'id', scheme: 'test_join' },
				test_join__id: {type: 'id'},
				test_join_name: { type: 'string' },
				test_join_inn: { type: 'string' },
				test_join_comment: { type: 'string' }
			}
		}
	}
};

```



## collection
Контейнер функций работы с проинициализированной библиотекой ```Flexo```.
Содержит методы, предоставляющие доступ к документам по заданной схеме

Документы включают в себя:
* собственные поля;
* присоединенные из иных документов поля.



### collection.find( scheme, fields, query, options, callback )
Осуществляет поиск документов в хранилище.
Возвращает удовлетворяющие запросу документы (и их количество).

Параметры:
* ```scheme``` - строка, содержит название схемы
* ```fields``` - массив, содержит названия полей, с которыми надо вернуть документы
* ```query``` - объект, потому что на массив запросов невозможно быстро вернуть честный count
	* ```selector``` - массив, поисковый запрос Mongo (четные элементы - ключи, нечетные элементы - значения), может иметь вложенные массивы
	* ```[options]``` - объект
		* ```[limit]``` - число, ограничение количества результатов поиска
		* ```[skip]``` - число, смещение ограничения количества результатов поиска
		* ```[sort]``` - объект или массив объектов ```sort```, правило сортировки Mongo
* ```options``` - объект
	* ```[count]``` - логическое, опция запроса количества документов удовлетворяющих запросу
* ```callback( error, documents, count )``` - функция
	* ```documents``` - массив, содержит объекты документов
	* ```count``` - число, общее количество удовлетворяющих запросу документов

	
	
### collection.aggregate( scheme, match, group, callback )
Производит аггреацию, вызывает аггрегацию Rabbit.
 
Параметры:
* ```scheme``` - строка, содержит название схемы
* ```match``` - объект, содержит селектор поиска
* ```group``` - объект, содержит правила группировки
* ```callback( error, documents )``` - строка, содержит название схемы
* ```documents``` - массив, содержит объекты результатов группировки
    
Запрос к rabbit.aggregate( request, callback )
Параметры:
* ```request``` - массив
    * ```collection_name``` - название коллекции
    * ```match``` - массив, содержит монговский поисковый запрос-массив как в rabbit.find
    * ```group``` - объект, содержит правила группировки
* ```callback( error, data )``` - функция
    * ```data``` - массив, может содержать ноль и более объектов
    
Пример работы rabbit.aggregate
```
rabbit.aggregate = function( request, callback ){
    var coll = request[0];
    var match = request[1];
    var group = request[2];
    
    var new_match = objectSelectorFromArraySelector( match );
    
    COLLECTIONS[ coll ].aggregate( [
        { $match: new_match },
        { $group: group }
    ], callback );
}
```



### collection.insert( scheme, fields, document, options, callback )
Проверяет полученные документы, присоединяет к ним зависимые блоки, сохраняет результирующие документы в хранилище.
Возвращает созданные документы.

Документ может содержать только поля, относящиеся к корневому блоку документа.
Документ не может содержать служебные поля: ```_id```, ```tsCreate```, ```tsUpdate```.
Для документа обязательными являются поля, по которым осуществляется присоединение зависимых блоков.
Параметры документа ```tsCreate``` и ```tsUpdate``` создаются на уровне метода.

Параметры:
* ```scheme``` - строка, содержит название схемы
* ```fields``` - массив, содержит названия полей, с которыми надо вернуть документы
* ```documents``` - массив
    * ```document``` - объект, содержит поля нового документа
* ```options``` - объект
* ```callback( error, documents )``` - функция
	* ```documents``` - массив, содержит объекты сохраненных документов



### collection.modify( scheme, query, options, callback )
Производит обновление параметров документов в хранилище.
Возвращает массив измененных документов, сокращенных до ```_id```, ```tsUpdate```.

Параметры:
* ```scheme``` - строка, содержит название схемы
* ```query``` - объект или массив объектов ```query```
	* ```selector``` - объект, поисковый запрос Mongo, обязательно должен содержать поля ```_id``` и ```tsUpdate```
	* ```properties``` - объект новых значений
* ```options``` - объект
* ```callback( error, documents )``` - функция
	* ```documents``` - массив, содержит объекты документов, сокращенных до ```_id```, ```tsUpdate```



### collection.delete( scheme, query, options, callback )
Удаляет заданные документы в хранилище.
Возвращает массив удаленных документов, сокращенных до ```_id```.

Параметры:
* ```scheme``` - строка, содержит название схемы
* ```query``` - объект или массив объектов ```query```
	* ```selector``` - объект, поисковый запрос Mongo, обязательно должен содержать поля ```_id``` и ```tsUpdate```
* ```options``` - объект
* ```callback( error, documents )``` - функция
	* ```documents``` - массив, содержит объекты удаленных документов, сокращенных до ```_id```
