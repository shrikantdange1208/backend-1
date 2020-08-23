const constants = require('../common/constants')
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retrieve transfer requests for a branch
 * @returns Json object containing all transfer requests
 */
router.get("/branches/:id", async (req, res, next) => {
    const branchId = req.params.id
    const { state } = req.query
    //default option is PENDING if state is not passed in query params
    if(!state){
        state = 'PENDING'
    }
    const allTransferRequests = []
    let transferRequests = db.collection(constants.BRANCHES).doc(branchId).collection(constants.TRANSFER_REQUESTS).where('state','==',state);
    console.log('Getting transfer requests...')
    let snapshot = await transferRequests.get()
    snapshot.forEach(transaction => {
        const trxData = transaction.data()
        trxData[constants.DATE] = trxData[constants.DATE].toDate()
        allTransferRequests.push({ id: transaction.id, ...trxData })
    })
    const response = {
        transferRequests: allTransferRequests,
        totalTransferRequests: allTransferRequests.length
    }
    res.status(200).send(response);
});

module.exports = router;