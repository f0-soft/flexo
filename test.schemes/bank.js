module.exports = {
    name: 'bank',

    root: {
        name: { type: 'words', title:'Назначение платежа'},
        bill_id: { type:'id', title:'Связь с счетом',  link: 'companyUser', from: 'bills', includeWeight: ['company', 'sys_users'] },
        pbill_id: { type:'id', title:'Связь с продуктом',  link: 'productsGroup', from: 'bills' },
        sum: {type:'money',  title:'Сумма поступления'},
        date: { type:'int', title:'Дата оплаты'}
    }
};
/*

db.bank.createIndex({'_a.bill_id_cm_name':1});
db.bank.createIndex({'sum':1});
db.bank.createIndex({'name':1});
db.bank.createIndex({'_a.bill_id_su_fullname':1});
db.bank.createIndex({'_a.bill_id':1});
db.bank.createIndex({'_a.pbill_id':1});
db.bank.createIndex({'_a.name':1});
db.bank.createIndex({'_a.pbill_id':1, sum:1});
db.bank.createIndex({'_a.bill_id':1, sum:1});
db.bank.createIndex({'date':1});

 db.bank.createIndex({'_a.bill_id':1, '_a.bill_id_su_fullname':1});
 db.bank.createIndex({'_a.bill_id':1, 'date':1});
 db.bank.createIndex({'_a.bill_id':1, 'name':1});

 db.bank.createIndex({'_a.bill_id':1, 'date':1, '_a.bill_id_su_fullname':1});
 db.bank.createIndex({'_a.bill_id':1, 'date':1, 'name':1});

 db.bank.createIndex({'_a.pbill_id':1, 'date':1, '_a.bill_id_su_fullname':1});
 db.bank.createIndex({'_a.pbill_id':1, 'date':1, 'name':1});

*/