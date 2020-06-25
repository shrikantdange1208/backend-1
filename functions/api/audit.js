const constants = require('../common/constants')
const logger = require('../middleware/logger');
const config = require('config');
const admin = require('firebase-admin');
const auth = require('./auth/auth')
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const cors = require('cors');
const db = admin.firestore();

/**
 * @description Route to retireve audit logs from firestore
 * @returns Json object containing all audit logs
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving audit logs from firestore");
    const audits = {
        "audit": []
    }
    let auditCollection = db.collection(constants.AUDIT);
    let snapshot = await auditCollection.get()
    snapshot.forEach(audit => {
        audits.audit.push(audit.data());
    })
    audits[constants.TOTAL] = snapshot.size;
    logger.debug('Returning audit log to client.');
    response.status(200).send(audits);
});

module.exports = router;
module.exports.logInAuditCollection = async function(data) {
    logger.info('Writing log to audit Collection')
    await db.collection(constants.AUDIT).add(data)    
}