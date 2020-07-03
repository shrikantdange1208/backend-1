const constants = require('../common/constants')
const logger = require('../middleware/logger');
const { isAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retrieve pending transactions for a branch
 * @returns Json object containing all pending transactions
 */
router.get("/branches/:id", async (req, res, next) => {
    const branchId = req.params.id
    const allPendingRequests = []
    let pendingTransactions = db.collection(constants.BRANCHES).doc(branchId).collection(constants.PENDING_REQUESTS);
    let snapshot = await pendingTransactions.get()
    snapshot.forEach(transaction => {
        const trxData = transaction.data()
        trxData[constants.DATE] = trxData[constants.DATE].toDate()
        allPendingRequests.push({ id: transaction.id, ...trxData })
    })
    const response = {
        pendingTransactions: allPendingRequests,
        totalPendingTransactions: allPendingRequests.length
    }
    res.status(200).send(response);
});

module.exports = router;