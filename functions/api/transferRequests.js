const constants = require('../common/constants')
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();
const utils = require('../common/utils')

/**
 * @description Route to retrieve transfer requests for a branch
 * @returns Json object containing all transfer requests
 */
router.get("/branches/:id", async (request, response, next) => {

    const branchId = request.params.id
    const doc = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    console.info("Retrieving transfer requests from firestore");

    var { email, fromDate, toDate, state } = request.query;
    if (!state) {
        state = constants.PENDING
    }
    var nextPageToken = request.query.nextPageToken ? request.query.nextPageToken : null;
    var prevPageToken = request.query.prevPageToken ? request.query.prevPageToken : null;

    if(nextPageToken !== null && prevPageToken !== null) {
        const error = new Error("Invalid Query Parameters, Please send either nextPageToken or prevPageToken")
        error.statusCode = 400
        next(error)
        return;
    }

    let transferRequestsCollection = db.collection(constants.BRANCHES).doc(branchId)
                    .collection(constants.TRANSFER_REQUESTS)
                    .where(constants.STATE, '==', state)
                    .orderBy(constants.DATE, 'desc');

    if (email) {
        transferRequestsCollection = transferRequestsCollection.where(constants.EMAIL, "==", email)
    }
    if (fromDate) {
        transferRequestsCollection = transferRequestsCollection.where(constants.DATE, ">=", new Date(fromDate));
    }
    if(toDate){
        toDate = new Date(toDate)
        toDate.setDate(toDate.getDate()+1)
        transferRequestsCollection = transferRequestsCollection.where(constants.DATE,"<",toDate);
    }
    var transferRequestsCollectionOrig = transferRequestsCollection
    //Case 1 : if both are null, then default to sending first time with defined pagesize
    if(nextPageToken === null && prevPageToken === null) {
        transferRequestsCollection = transferRequestsCollection
                .limit(constants.PAGE_SIZE)
    }
    //Case 2 : only nextPageToken is given, then start after the doc id + pagesize
    if(nextPageToken !== null ) {
        var lastVisibleDoc = await db.collection(constants.BRANCHES).doc(branchId)
                    .collection(constants.TRANSFER_REQUESTS)
                    .doc(nextPageToken)
                    .get()
        if(lastVisibleDoc){
            transferRequestsCollection = transferRequestsCollection
                .startAfter(lastVisibleDoc)
                .limit(constants.PAGE_SIZE)
            }
    }
    // Case 3 : Only prev page token is given, then end Before the given doc id with limit pagesize.
    if(prevPageToken !== null) {
    var prevVisibleDoc = await db.collection(constants.BRANCHES).doc(branchId)
                    .collection(constants.TRANSFER_REQUESTS)
                    .doc(prevPageToken)
                    .get()
        if(prevVisibleDoc){
            transferRequestsCollection = transferRequestsCollection
                .endBefore(prevVisibleDoc)
                .limitToLast(constants.PAGE_SIZE)
        }
    }

    console.log('Getting transfer requests...')
    let snapshot = await transferRequestsCollection.get()

    const allTransferRequests = []

    snapshot.forEach(transaction => {
        const trxData = transaction.data()
        trxData[constants.DATE] = trxData[constants.DATE].toDate()
        allTransferRequests.push({ id: transaction.id, ...trxData })
    })

    const transferRequestsResponse = {
        transferRequests: allTransferRequests,
        totalTransferRequests: allTransferRequests.length
    }

    var size = snapshot.docs.length;

    // Populating the response ( with page tokens)
    if(size > 0){
        //To identify if its end of pages ( no prev or no next)
       const hasPrevious =  await utils.hasPreviousPage(transferRequestsCollectionOrig, snapshot)
       const hasNext = await utils.hasNextPage(transferRequestsCollectionOrig, snapshot)

       transferRequestsResponse[constants.NEXT_PAGE_TOKEN] = hasNext ? snapshot.docs[size-1].id : null;
       transferRequestsResponse[constants.PREV_PAGE_TOKEN] = hasPrevious ? snapshot.docs[0].id : null;
   }

    response.status(200).send(transferRequestsResponse);
    
});

module.exports = router;