'use strict';

var async = require( 'async' );
var next = require( 'nexttick' );

/*
 0. карта, описывающая из каких коллекций какие брать поля, как они должны быть расположены в выходном объекте
 0.1 данные выбираются с использованием путей и без них в зависимости от удаленности коллекций от корня
 0.2 селекторы и сортировка по структуре, формируемой по карте

 1. find (`-` - не сделано, `+` - сделано, `*` - отложено на потом)
 1.1 * разбиение селектора на группы по коллекциям, трансляция названий полей
 1.2 * поиск id джойнов, по которым есть селектор
 1.3 * сборка запроса к корню из его собственного запроса и сужения по id джойнов
 1.4 + запрос корня по исходному селектору
 1.5 + запрос ближайших джойнов
 1.6 * запрос джойнов по путям
 1.7 * запрос джойнов по путям по пересечению карты и запрошенных полей
 1.8 + сборка с использованием имен полей из схем flexo
 1.9 * сборка в объект по карте с использованием поля связи и путей
 */

var map = {
	root: 'bank',
	map: {
		// формат указания выбираемого поля: массив из 2-3 значений
		// collName - название коллекции, из которой берется поле
		// field - название выбираемого поля
		// [dependField] - название поля в корневой коллекции, через которое установлена связь (прямая или через путь)

		// выбор поля корневой схемы
		name: ['bank', 'name'],

		// явное обозначение массива
		users: [
			{
				name: ['sys_users', 'name', 'bill_id'],
				fullname: ['sys_users', 'fullname', 'bill_id']
			}
		],

		// выборка единичного внешнего документа
		// допустимо только если в схеме flexo стоит ограничение на длину массива id, равное 1
		company: {
			name: ['company', 'name', 'bill_id']
		}
	}
};

var SCHEMES; // flexo schemes
var STORAGE; // flexo
var container = {};



var LINK_TYPE = 'id';
var DOC_ID = '_id';



container.find = function( request, cb ) {
	var task = {
		request: request,
		rootName: request.name
	};

	// каждая функция получает аргументы `task, cb`, дописывает данные в task, в конце вызывает cb(null, task)
	async.waterfall( [
		function noop( cb ) { return next( cb, null, task ); },
		// найти корень
		findRoot,
		// найти джойны
		findJoins,
		// собрать результат
		buildResult
	], function( err, res ) {
		if ( err ) { return cb( err ); }
		return cb( null, res );
	} );
};
function findRoot( task, cb ) {
	STORAGE.find( task.request, function( err, data ) {
		if ( err ) { return cb( err ); }

		task.root = data.result;
		return cb( null, task );
	} );
}
function findJoins( task, cb ) {
	var child;
	var mutable;
	var types;

	task.children = { dict: [], data: [] };

	if ( !task.root.length ) { return cb( null, task ); }

	mutable = SCHEMES[task.rootName].dict.mutable;
	types = SCHEMES[task.rootName].dict.types;

	for ( var i = 0; i < mutable.length; i += 1 ) {
		if ( types[ mutable[i] ].type === LINK_TYPE && types[ mutable[i] ].from ) {
			child = {
				rootField: mutable[i],
				collection: types[ mutable[i] ].from,
				ids: []
			};

			for ( var j = 0; j < task.root.length; j += 1 ) {
				for ( var k = 0; k < task.root[j][ mutable[i] ].length; k += 1 ) {
					if ( task.root[j][ mutable[i] ][k].split( '_', 2 ).length === 1 ) {
						child.ids.push( task.root[j][ mutable[i] ][k] );
					}
				}
			}

			task.children.dict.push( child );
		}
	}

	return async.map( task.children.dict, findById, function( err, res ) {
		if ( err ) { return cb( err ); }

		task.children.data = res;

		for ( var i = 0; i < task.children.dict.length; i += 1 ) {
			delete task.children.dict[i].ids;
		}

		return cb( null, task );
	} );
}
function findById( item, cb ) {
	var request = {
		name: item.collection,
		fields: SCHEMES[ item.collection ].dict.all,
		query: {}
	};
	request.query[ DOC_ID ] = { $in: item.ids };

	STORAGE.find( request, function( err, data ) {
		if ( err ) { return cb( err ); }

		return cb( null, data.result );
	} );
}
function buildResult( task, cb ) {
	for ( var i = 0; i < task.children.dict.length; i += 1 ) {
		for ( var j = 0; j < task.root.length; j += 1 ) {
			for ( var k = 0; k < task.root[j][ task.children.dict[i].rootField ].length; k += 1 ) {
				for ( var x = 0; x < task.children.data[i].length; x += 1 ) {
					if ( task.children.data[i][ DOC_ID ] !== task.root[j][ task.children.dict[i].rootField ][k] ) { continue; }
					task.root[j][ task.children.dict[i].rootField ][k] = task.children.data[i];
					break;
				}
			}
		}
	}

	return cb( null, task.root );
}



container.insert = function( request, cb ) {};
container.modify = function( request, cb ) {};
container.delete = function( request, cb ) {};



function init( options, cb ) {
	SCHEMES = options.schemes;
	STORAGE = options.storage;
	next( cb, null, container );
}
module.exports = exports = {
	init: init
};
