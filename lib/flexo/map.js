'use strict';

var async = require( 'async' );
var next = require( 'nexttick' );

/*
 0. карта, описывающая из каких коллекций какие брать поля, как они должны быть расположены в выходном объекте
 0.1 данные выбираются с использованием путей и без них в зависимости от удаленности коллекций от корня
 0.2 селекторы и сортировка по структуре, формируемой по карте

 1. find (`-` - не сделано, `+` - сделано, `*` - отложено на потом)
 1.1 * разбиение селектора на группы по коллекциям, трансляция названий полей
 1.2 - поиск id джойнов, по которым есть селектор
 1.3 - сборка запроса к корню из его собственного запроса и сужения по id джойнов
 1.4 + запрос корня по исходному селектору
 1.5 + запрос ближайших джойнов
 1.6 + запрос джойнов по путям
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
var LINKS; // links schemes
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
		// найти джойны, сборка по мере получения данных
		findJoins
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
	var queue;

	if ( !task.root.length ) { return cb( null, task ); }

	queue = [];
	queue.push( {
		level: task.root,
		collection: task.rootName
	} );

	return async.whilst( function() {
		return !!queue.length;
	}, function( cb ) {
		async.map( queue, joinNearest, function( err, res ) {
			if ( err ) { return cb( err ); }

			for ( var i = 0; i < res.length; i += 1 ) {
				for ( var j = 0; j < res[i].length; j += 1 ) {
					queue.push( res[i][j] );
				}
			}

			return cb( null );
		} );
	}, function( err ) {
		if ( err ) { return cb( err ); }

		return cb( null, task.root );
	} );
}

function joinNearest( task, cb ) {
	var mutable = SCHEMES[task.collection].dict.mutable;
	var types = SCHEMES[task.collection].dict.types;
	var dict = [];
	var child;

	for ( var i = 0; i < mutable.length; i += 1 ) {
		if ( types[ mutable[i] ].type !== LINK_TYPE || !types[ mutable[i] ].from ) { continue; }

		child = {
			field: mutable[i],
			collection: types[ mutable[i] ].from,
			ids: []
		};

		for ( var j = 0; j < task.level.length; j += 1 ) {
			for ( var k = 0; k < task.level[j][ mutable[i] ].length; k += 1 ) {
				if ( task.level[j][ mutable[i] ][k].split( '_', 2 ).length === 1 ) {
					child.ids.push( task.level[j][ mutable[i] ][k] );
				}
			}
		}

		dict.push( child );
	}

	if ( !dict.length ) { return cb( null, [] ); }

	return async.map( dict, findById, function( err, res ) {
		var newTasks;
		var mutable;
		var types;
		if ( err ) { return cb( err ); }

		newTasks = [];
		for ( var i = 0; i < dict.length; i += 1 ) {
			// join data
			for ( var a = 0; a < task.level.length; a += 1 ) {
				for ( var b = 0; b < task.level[a][ dict[i].field ].length; b += 1 ) {
					for ( var c = 0; c < res[i].length; c += 1 ) {
						if ( res[i][DOC_ID] !== task.level[a][ dict[i].field ][b] ) { continue; }

						task.level[a][ dict[i].field ][b] = res[i][c];
						break;
					}
				}
			}


			// new tasks
			mutable = SCHEMES[dict[i].collection].dict.mutable;
			types = SCHEMES[dict[i].collection].dict.types;
			for ( var j = 0; j < mutable.length; j += 1 ) {
				if ( types[ mutable[j] ].type !== LINK_TYPE || !types[ mutable[j] ].from ) { continue; }

				newTasks.push( {
					level: res[i],
					collection: types[ mutable[j] ].from
				} );
			}
		}

		return cb( null, newTasks );
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
