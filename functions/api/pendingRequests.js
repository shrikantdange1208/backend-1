const constants = require('../common/constants')
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retrieve pending requests for a branch
 * @returns Json object containing all pending requests
 */
router.get("/branches/:id", async (req, res, next) => {
    const branchId = req.params.id
    const allPendingRequests = []
    let pendingRequests = db.collection(constants.BRANCHES).doc(branchId).collection(constants.PENDING_REQUESTS);
    console.log('Getting pending requests...')
    let snapshot = await pendingRequests.get()
    snapshot.forEach(transaction => {
        const trxData = transaction.data()
        trxData[constants.DATE] = trxData[constants.DATE].toDate()
        allPendingRequests.push({ id: transaction.id, ...trxData })
    })
    const response = {
        pendingRequests: allPendingRequests,
        totalPendingRequests: allPendingRequests.length
    }
    res.status(200).send(response);
});

module.exports = router;