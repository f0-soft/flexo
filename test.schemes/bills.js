'use strict';

var coll_prod = 'products';

exports.name = 'bills';
exports.root = {
	number: { type: 'int', title: 'Номер' },
	contr_id: { type: 'id', title: 'Ссылка на контракт', link: 'companyUser', from: 'contract', includeWeight: ['contract'] },
	p_id: { type: 'id', title: 'Ссылка на продукцию', from: 'products', includeWeight: ['products'] },
	count: { type: 'int', title: 'Количество' },
	sum: { type: 'money', title: 'Сумма счета' },
	date: { type: 'int', title: 'Дата выставления' },
	note: { type: 'str', title: 'Примечание' }
};

exports.before = {
	insert: [
		// проверить наличие id Prod
		function checkProd( cb ) {
			if ( this.query.p_id && this.query.p_id.length === 0 ) { return cb( 'не указана продукция' ); }
			return cb( null, this.query );
		},
		// поиск цены
		insertBills
	],
	modify: [
		// проверить наличие id Prod
		function checkProd( cb ) {
			if ( this.query.properties.p_id && this.query.properties.p_id.length === 0 ) { return cb( 'не указана продукция' ); }
			return cb( null, this.query );
		},
		// поиск цены
		modifyBills
	]
};

/*

 db.bills.createIndex({'_a.contr_id':1});
 db.bills.createIndex({'_a.p_id':1});
 db.bills.createIndex({'sum':1});
 db.bills.createIndex({date:1});
 db.bills.createIndex({number:1});
 db.bills.createIndex({'_a.p_id':1, sum:1});
 db.bills.createIndex({'_a.contr_id_cn_name':1});
 db.bills.createIndex({'_a.p_id_pr_name':1});
 db.bills.createIndex({'_a.p_id_pr_price':1});
 db.bills.createIndex({date:1, '_a.p_id_pr_price':1});
 db.bills.createIndex({date:1, 'sum':1});
 db.bills.createIndex({date:1, 'number':1});
 db.bills.createIndex({'_a.contr_id':1, date:1, '_a.contr_id_cn_name':1});
 db.bills.createIndex({'_a.contr_id':1, date:1, '_a.p_id_pr_price':1});
 db.bills.createIndex({'_a.contr_id':1, date:1, 'sum':1});
 db.bills.createIndex({'_a.contr_id':1, date:1, 'number':1});
 db.bills.createIndex({'_a.p_id':1, date:1, '_a.contr_id_cn_name':1});
 db.bills.createIndex({'_a.p_id':1, date:1, '_a.p_id_pr_price':1});
 db.bills.createIndex({'_a.p_id':1, date:1, 'sum':1});
 db.bills.createIndex({'_a.p_id':1, date:1, 'number':1});

 */



function insertBills( cb ) {
	console.log( this.query );
	var queryFind = {
		name: coll_prod,
		fields: ['price'],
		query: {_id: this.query.p_id[0]},
		options: {}
	}
	this.db.find( queryFind, function( err, data ) {
		if ( err ) { return cb( err ); }
		if ( !data.result.length ) {
			return cb( 'такой товар не найден' );
		}

		var price = parseInt( data.result[0].price * 100 );
		if ( !this.query.count ) {
			this.query.count = 1;
		}
		else {
			this.query.count = parseInt( this.query.count );
		}
		this.query.sum = this.query.count * price;
		return cb( null, this.query );

	}.bind( this ) );
}

function modifyBills( cb ) {
	console.log( this.query );
	var queryFind = {
		name: coll_prod,
		fields: ['price'],
		query: {_id: this.query.properties.p_id[0]},
		options: {}
	}
	this.db.find( queryFind, function( err, data ) {
		if ( err ) { return cb( err ); }
		if ( !data.result.length ) {
			return cb( 'такой товар не найден' );
		}

		var price = parseInt( data.result[0].price * 100 );
		if ( !this.query.properties.count ) {
			this.query.properties.count = 1;
		}
		else {
			this.query.properties.count = parseInt( this.query.properties.count );
		}
		this.query.properties.sum = this.query.properties.count * price;
		return cb( null, this.query );

	}.bind( this ) );
}
