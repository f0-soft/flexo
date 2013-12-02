module.exports = {
    name: 'contract',

    root: {
        name: { type: 'words', title:'Название контракта', weight: true},
        c_id: { type:'id', title:'Компания',  link: 'companyUser', from: 'company', includeWeight: ['company']},
        date: { type: 'int', title:'Дата подпсиание контракта'},
        note: { type:'str', title:'Примечание'}
    }
};

/*
 db.contract.createIndex({name:1});
 db.contract.createIndex({'_a.c_id':1});
 db.contract.createIndex({date:1})
 db.contract.createIndex({'_a.c_id_cm_name':1});
 db.contract.createIndex({'_a.m_id_su_fullname':1});
 db.contract.createIndex({'_a._w_name':1, '_a.m_id_su_fullname':1});
 db.contract.createIndex({'_a._w_name':1, 'date':1});
 db.contract.createIndex({'_a._w_name':1, 'name':1});

 */