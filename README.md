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



## init( options )
Запускает инициализацию библиотеки.
Во время инициализации производится:
* предзагрузка файлов схем документов;
* проверка схем документов;
* предварительное построение справочных данных для схем документов.

Параметры:
* ```options``` - объект
    * ```path``` - строка, путь к каталогу схем (устаревшая опция, должна быть заменена на глобальный объект предварительно прочитанных схем)
    * ```mock``` - логическое, приводит к использованию имитации хранилища ```rabbit```



## getSchemes()
Возвращает массив названий доступных схем документов



## Collection( options )
Класс для работы с хранилищем документов.
Создает экземпляр класса по заданной схеме, с заданными полями документов.
Экземпляр класса включает в себя:
* документы;
* серверные или клиентские методы документов.

Документы включают в себя:
* собственные поля;
* присоединенные из иных документов поля;
* локальные вычисляемые поля документов.

Параметры:
* ```options``` - объект
	* ```scheme``` - строка, содержит название схемы
	* ```fields``` - массив, содержит названия необходимых полей документов



### Collection.find( query, options, callback )
Осуществляет поиск документов в хранилище, сохраняет ```_id```, ```tsUpdate``` переданных документов для исключения повторной передачи документов.
Возвращает удовлетворяющие запросу документы (и их количество).

Параметры:
* ```query``` - объект, потому что на массив запросов невозможно быстро вернуть честный count
	* ```selector``` - объект, поисковый запрос Mongo
	* ```[options]``` - объект
		* ```[limit]``` - число, ограничение количества результатов поиска
		* ```[skip]``` - число, смещение ограничения количества результатов поиска
		* ```[sort]``` - объект или массив объектов ```sort```, правило сортировки Mongo
		* ```[hint]``` - объект, содержит указание по выбору индекса Mongo
* ```[options]``` - объект
	* ```[count]``` - логическое, опция запроса количества документов удовлетворяющих запросу
	* ```[all]``` - логическое, возврат всех документов без учета ранее переданных ( прозрачный запрос )
	* ```[nocache]``` - логическое, предотвращает сохранение учет документов как ранее переданных
	* ```[fields]``` - массив, содержит названия полей, с которыми надо вернуть документы
* ```callback( error, documents, count )``` - функция, получает массив документов или число документов


### Collection.insert( document, options, callback )
Проверяет полученные документы, присоединяет к ним зависимые блоки, сохраняет результирующие документы в хранилище.
Возвращает созданные документы.

Документ может содержать только поля, относящиеся к корневому блоку документа.
Документ не может содержать служебные поля: ```_id```, ```tsCreate```, ```tsUpdate```.
Для документа обязательными являются поля, по которым осуществляется присоединение зависимых блоков.
Параметры документа ```tsCreate``` и ```tsUpdate``` создаются на уровне метода.

Параметры:
* ```document``` - объект или массив объектов ```document```, содержит поля нового документа
* ```[options]``` - объект
	* ```[fields]``` - массив, содержит названия полей, с которыми надо вернуть сохраненные документы 
* ```callback( error, documents )``` - функция, получает массив сохраненных документов



### Collection.modify( query, options, callback )
Производит обновление параметров документов в хранилище, дополняет поисковые запросы параметром ```tsUpdate``` из списка переданных документов.
Возвращает массив измененных документов, сокращенных до ```_id```, ```tsUpdate```.

Параметры:
* ```query``` - объект или массив объектов ```query```
	* ```selector``` - объект, поисковый запрос Mongo, включающий в себя поле ```_id```
	* ```properties``` - объект новых значений
* ```[options]``` - объект
* ```callback( error, documents )``` - функция, получает массив документов, сокращенных до ```_id```, ```tsUpdate```



### Collection.delete( query, options, callback )
Удаляет заданные документы в хранилище, дополняет поисковые запросы параметром ```tsUpdate``` из списка переданных документов.
Возвращает массив удаленных документов, сокращенных до ```_id```.

Параметры:
* ```query``` - объект или массив объектов ```query```
	* ```selector``` - объект, поисковый запрос Mongo
* ```[options]``` - объект
* ```callback( error, documents )``` - функция, получает массив ```_id``` удаленных документов
