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
 1.6 + запрос джойнов по путям
 1.7 * запрос джойнов по путям по пересечению карты и запрошенных полей
 1.8 + сборка с использованием имен полей из схем flexo
 1.9 * сборка в объект по карте с использованием поля связи и путей
 */

var map = {
	root: 'bank',
	map: {
		scheme: 'bills',
		fieldsAll: true,
		fields: {
			contr_id: { // будет содержать результат объединения массивов, без повторов
				scheme: 'company',
				proc: ['concat', 'unique']
			}
		}
	}
};

var SCHEMES; // flexo schemes
var LINKS; // links schemes
var PREFIXES; // prefixes dictionary
var MAPS;
var STORAGE; // flexo
var container = {};



var LINK_TYPE = 'id';
var DOC_ID = '_id';



function replaceById( task ) {
	task = {
		level: [
			[], // чистые массивы с id только присоединяемых данных
			[],
			[]
		],
		data: [],
		submap: {}
	};

	var dataMap = {};
	for ( var a = 0; a < task.data.length; a += 1 ) {
		dataMap[ task.data[a][DOC_ID] ] = task.data[a];
	}

	if ( !task.submap.fields ) { return replaceByIdStraight( task.level, dataMap ); }
	if ( Array.isArray( task.submap.fields ) ) { return replaceByIdFetch( task.level, dataMap, task.submap.fields ); }
	return replaceByIdRename( task.level, dataMap, task.submap );
}

function replaceByIdStraight( level, dataMap ) {
	for ( var i = 0; i < level.length; i += 1 ) {
		for ( var j = 0; j < level[i].length; j += 1 ) {
			level[i][j] = dataMap[ level[i][j] ];
		}
	}
	return {};
}

function replaceByIdFetch( level, dataMap, fields ) {
	var obj;
	for ( var i = 0; i < level.length; i += 1 ) {
		for ( var j = 0; j < level[i].length; j += 1 ) {
			obj = {};
			for ( var k = 0; k < fields.length; k += 1 ) {
				obj[ fields[k] ] = dataMap[ level[i][j] ][ fields[k] ];
			}
			level[i][j] = obj;
		}
	}
	return {};
}

function replaceByIdRename( level, dataMap, map ) {
	var keys = Object.keys( map.fields );
	var rename = [];
	var joins = [];
	var nextLevels = {};
	var usedFields = {};
	var type;
	var obj;
	var arr;
	var id;

	for ( var a = 0; a < keys.length; a += 1 ) {
		type = typeof map.fields[ keys[a] ];

		if ( type === 'string' ) {
			rename.push( [ keys[a], map.fields[keys[a]] ] );
			usedFields[ map.fields[ keys[a] ] ] = true;
			continue;
		}

		if ( !map.fields[ keys[a] ].src ) {
			joins.push( [ keys[a], keys[a], map.fields[ keys[a] ].scheme /* ??? */ ] );
			usedFields[ keys[a] ] = true;
		} else {
			joins.push( [ keys[a], map.fields[ keys[a] ].src, map.fields[ keys[a] ].scheme /* ??? */ ] );
			usedFields[ map.fields[ keys[a] ].src ] = true;
		}


		nextLevels[ keys[a] ] = {
			level: [],
			data: [], // ???
			submap: map.fields[ keys[a] ]
		};
	}

	if ( map.fieldsAll ) { // добавление всех полей из схемы
		for ( var b = 0; b < SCHEMES[map.scheme].dict.all.length; b += 1 ) {
			if ( usedFields[ SCHEMES[map.scheme].dict.all[b] ] ) { continue; }
			rename.push( [ SCHEMES[map.scheme].dict.all[b], SCHEMES[map.scheme].dict.all[b] ] );
		}
	}

	for ( var i = 0; i < level.length; i += 1 ) {
		for ( var j = 0; j < level[i].length; j += 1 ) {
			obj = {};
			for ( var k = 0; k < rename.length; k += 1 ) {
				obj[ rename[k][0] ] = dataMap[ level[i][j] ][ rename[k][1] ];
			}
			for ( var x = 0; x < joins.length; x += 1 ) {
				arr = [];
				// filter ids ???
				for ( var y = 0; y < dataMap[ level[i][j] ][ joins[x][1] ].length; y += 1 ) {
					if ( dataMap[ level[i][j] ][ joins[x][1] ][y].substr( 0, 2 ) === PREFIXES.c2p[ joins[x][2] ] ) {
						id = dataMap[ level[i][j] ][ joins[x][1] ][y].slice( '_', 1 )[0];
						if ( arr.indexOf( id ) === -1 ) {
							arr.push( id );
						}
					}
				}
				obj[ joins[x][0] ] = arr;
				nextLevels[ joins[x][0] ].level.push( arr );
			}
			level[i][j] = obj;
		}
	}

	return nextLevels;
}



container.find = function( request, cb ) {
	request = {
		name: 'test',
		selector: {}
	};

	var task = {
		request: request,
		rootCollection: MAPS[ request.name ].map.scheme
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
/*
 построить скелет и собрать связки пустышек под данные
 сделать запросы к базе с привязкой к запросам связок пустышек
 наполнить пустышки данными
 */

function makeSkel( task, cb ) {
	var out = [];
	var map = {
		root: MAPS[task.request.name]
	};

	var queue = [];
	queue.push( {
		mapPath: ['root'],
		data: [ task.root ]
	} );

	while ( queue.length ) {
		var el = queue.shift();
		var submap = map;

		for ( var i = 0; i < el.mapPath.length; i += 1 ) {
			submap = submap[el.mapPath[i]];
		}

		if ( !submap.fields ) {
			task.res = task.root;
			return cb( null, task );
		}

		if ( Array.isArray( submap.fields ) ) {

		}
	}
}

// нихрена не получилось без справочника 
// пример справочника
var dictionary = {
	SuperSchemeName: {
		target: 'root',
		scheme: 'bills',
		fields: ['_id', 'oldName'], // массив полей для запроса к базе
		rename: [
			// для полей которые надо записать в результат
			// массив пар (поле базы - поле данных), включает переименования
			['newName', 'oldName']
		],
		joins: [ // все дети, которых можно выбрать по пути
			{
				source: 'newName', // поле с путем
				children: [ // дети следуют в порядке вложенности
					{ // каждый такой объект - экземпляр описания узла
						target: 'newName', // новое имя поля, в котором должен быть масив объектов
						scheme: 'contracts',
						fields: ['_id', 'sum'],
						rename: [
							['_id', '_id'],
							['sum', 'sum']
						],
						joins: []
					},
					{
						target: 'newName.*.manager',
						scheme: 'managers',
						fields: ['_id', 'fullname'],
						rename: [
							['_id', '_id'],
							['fullname', 'fullname']
						],
						joins: []
					}
				]
			}
		]
	}
};

// итого, узел:
var node = {
	target: 'string',
	scheme: 'string',
	fields: ['array'],
	rename: ['array of arrays'],
	joins: ['array of objects',
		{
			source: 'string',
			children: ['array of nodes']
		}
	]
};
var nodeRule = [
	['node', true, 'o', [
		['target', true, 's'],
		['scheme', true, 's'],
		['fields', true, 'a', 's'], // non-empty
		['rename', true, 'a', [
			'*', true, 'a', [
				['newName', true, 's'],
				['oldName', true, 's']
			]
		]],
		['joins', true, 'a', [
			'*', false, 'o', [
				['source', true, 's'],
				['children', true, 'a', 'o'] // non-empty
			]
		]]
	]]
];



function findJoins( task, cb ) {
	var queue;

	if ( !task.root.length ) { return cb( null, task ); }

	queue = [];
	queue.push( {
		level: task.root,
		collection: task.rootCollection
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
	var mutable = SCHEMES[task.rootCollection].dict.mutable;
	var types = SCHEMES[task.rootCollection].dict.types;
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



container.insert = function( request, cb ) {
	var task = {
		request: request,
		rootCollection: request.name
	};

	// каждая функция получает аргументы `task, cb`, дописывает данные в task, в конце вызывает cb(null, task)
	async.waterfall( [
		function noop( cb ) { return next( cb, null, task ); },
		saveJoins
	], function( err, res ) {
		if ( err ) { return cb( err ); }
		return cb( null, res );
	} );
};
function saveJoins( task, cb ) {
	saveLevel( {
		level: task.request.query,
		collection: task.rootCollection
	}, function( err ) {
		if ( err ) { return cb( err ); }
		return cb( null, task.request.query );
	} );
}

function saveLevel( task, cb ) {
	var saveMap = [];
	var saveDocs = [];
	var childTasks = [];
	var type;
	var mutable = SCHEMES[task.rootCollection].dict.mutable;
	var types = SCHEMES[task.rootCollection].dict.types;

	for ( var i = 0; i < task.level.length; i += 1 ) {
		type = typeof task.level[i];
		if ( type === 'string' ) { continue; }
		if ( type !== 'object' ) { return cb( new Error( 'недопустимый тип вложенного элемента' ) ); }

		if ( task.level[i]._id ) { continue; }

		for ( var j = 0; j < mutable.length; j += 1 ) {
			if ( types[ mutable[j] ].type !== LINK_TYPE || !types[ mutable[j] ].from ) { continue; }

			childTasks.push( {
				level: task.level[i][ mutable[j] ],
				collection: types[ mutable[j] ].from
			} );
		}

		saveMap.push( i );
		saveDocs.push( task.level[i] );
	}

	if ( !saveDocs.length ) { return next( cb, null ); }

	return async.map( childTasks, saveLevel, function( err ) {
		if ( err ) { return cb( err ); }

		return STORAGE.insert( {
			name: task.rootCollection,
			fields: [DOC_ID],
			query: saveDocs
		}, function( err, data ) {
			if ( err ) { return cb( err ); }

			for ( var i = 0; i < saveMap.length; i += 1 ) {
				task.level[ saveMap[i] ] = data.result[i]._id;
			}

			return cb( null );
		} );
	} );
}

container.modify = function( request, cb ) {};
container.delete = function( request, cb ) {};



function init( options, cb ) {
	SCHEMES = options.schemes;
	LINKS = options.links;
	PREFIXES = options.prefixes;
	MAPS = options.maps;
	STORAGE = options.storage;
	next( cb, null, container );
}

module.exports = exports = {
	init: init
};
