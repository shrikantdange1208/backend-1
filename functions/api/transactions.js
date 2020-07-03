const constants = require('../common/constants');
const logger = require('../middleware/logger');
const { isAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const url = require('url');
const db = admin.firestore();

/**
 * @description Route to retireve all transactions under all branches
 * @returns Json object containing all transactions under all branches
 */
router.get("/", isAdmin, async (request, response, next) => {
    console.log("Retrieving all transactions under all branches");
    let branchCollectionRef = db.collection(constants.BRANCHES);
    let documents = []
    documents = await branchCollectionRef.listDocuments();
    const{user,product,fromDate,toDate} = request.query;    
    let alltransactions = []
    for(const doc of documents) {
        var branchtransactions = {}
        console.log(`fetching document of branch ${doc.id}`);
        const branchSnapshot = await doc.get()
        const branchData = branchSnapshot.data()
        let subCollectionDocRef = branchCollectionRef
                                    .doc(doc.id)
                                    .collection('transactions')
                                    .orderBy(constants.DATE, 'desc');
        if(user){
            subCollectionDocRef = subCollectionDocRef.where(constants.USER,"==",user)
        }
        if(product){
            subCollectionDocRef = subCollectionDocRef.where(constants.PRODUCT,"==",product);
        }
        if(fromDate){
            subCollectionDocRef = subCollectionDocRef.where(constants.DATE,">=",new Date(fromDate));
        }
        if(toDate){
            subCollectionDocRef = subCollectionDocRef.where(constants.DATE,"<=",new Date(toDate));
        }
        let snapshot = await subCollectionDocRef.get()
        branchtransactions[constants.BRANCH] = branchData[constants.NAME];
        branchtransactions[constants.TRANSACTIONS] = []
       
        snapshot.forEach(transaction => {
            var transactionData = transaction.data()
            transactionData[constants.DATE] = transactionData[constants.DATE].toDate();
            branchtransactions[constants.TRANSACTIONS].push(transactionData)
        })
        alltransactions.push(branchtransactions);
    }
    //console.log(alltransactions)
    logger.debug('Returning all transactions for all branches.');
    response.status(200).send(alltransactions);
});
/**
 * @description Route to retireve all transactions under given branch for given user
 * @returns Json object containing all transactions under given branch for given user
 */
router.get("/:id", isAdmin, async (request, response, next) => {
    logger.info("Retrieving all transactions under given branch for given user");
    var branchId = request.params.id
    const{user,product,fromDate,toDate} = request.query;
    let transactionCollection = db.collection(constants.BRANCHES)
                                    .doc(branchId)
                                    .collection(constants.TRANSACTIONS)
                                    .orderBy(constants.DATE, 'desc')
    if(user){
        transactionCollection = transactionCollection.where(constants.USER,"==",user)
    }
    if(product){
        transactionCollection = transactionCollection.where(constants.PRODUCT,"==",product);
    }
    if(fromDate){
        transactionCollection = transactionCollection.where(constants.DATE,">=",new Date(fromDate));
    }
    if(toDate){
        transactionCollection = transactionCollection.where(constants.DATE,"<=",new Date(toDate));
    }
    let snapshot = await transactionCollection.get()
    const branchTransactions = []
    snapshot.forEach(transaction => {
        var transactionData = transaction.data()
        transactionData[constants.DATE] = transactionData[constants.DATE].toDate();
        branchTransactions.push(transactionData)
    })
    const res = {
        "transactions": branchTransactions
    }
    response.status(200).send(res);
});

module.exports = router;