const constants = require('../common/constants');
const logger = require('../middleware/logger');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const cors = require('cors');
const url = require('url');
const db = admin.firestore();

/**
 * @description Route to retireve all transactions under all branches
 * @returns Json object containing all transactions under all branches
 */
router.get("/", async (request, response, next) => {
    console.log("Retrieving all transactions under all branches");
    let branchCollectionRef = db.collection('branch');
    let documents = []
    documents = await branchCollectionRef.listDocuments();
    const{user,product,fromDate,toDate} = request.query;    
    let alltransactions = []
    for(const doc of documents) {
        var branchtransactions = {}
        console.log(`fetching document of branch ${doc.id}`);
        let subCollectionDocRef = branchCollectionRef.doc(doc.id).collection('transactions');
        if(user){
            subCollectionDocRef = subCollectionDocRef.where("user","==",user)
        }
        if(product){
            subCollectionDocRef = subCollectionDocRef.where("product","==",product);
        }
        if(fromDate){
            subCollectionDocRef = subCollectionDocRef.where("date",">=",new Date(fromDate));
        }
        if(toDate){
            subCollectionDocRef = subCollectionDocRef.where("date","<=",new Date(toDate));
        }
        let snapshot = await subCollectionDocRef.get()
        branchtransactions[constants.BRANCH] = doc.id;
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
router.get("/:branch_name", async (request, response, next) => {
    logger.info("Retrieving all transactions under given branch for given user");
    var branchName = request.params.branch_name.toLocaleLowerCase();
    const{user,product,fromDate,toDate} = request.query;
    let transactionCollection = db.collection('branch').doc(branchName).collection('transactions')
    if(user){
        transactionCollection = transactionCollection.where("user","==",user)
    }
    if(product){
        transactionCollection = transactionCollection.where("product","==",product);
    }
    if(fromDate){
        transactionCollection = transactionCollection.where("date",">=",new Date(fromDate));
    }
    if(toDate){
        transactionCollection = transactionCollection.where("date","<=",new Date(toDate));
    }
    console.log(request.query);
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