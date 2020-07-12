const constants = require('../common/constants')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const { isAdminOrSuperAdmin } = require('../middleware/auth');
const admin = require('firebase-admin');
const auth = require('../middleware/auth')
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve audit logs from firestore
 * @returns Json object containing all audit logs
 */
router.get("/", isAdminOrSuperAdmin, async (request, response, next) => {
    logger.info("Retrieving audit logs from firestore");
    const audits = {
        "audit": []
    }
    let auditCollection = db.collection(constants.AUDIT);
    let snapshot = await auditCollection.get()
    snapshot.forEach(audit => {
        var auditData = audit.data()
        auditData[constants.DATE] = auditData[constants.DATE].toDate()
        if(auditData[constants.BEFORE] && auditData[constants.AFTER]) {
            auditData[constants.BEFORE] = utils.formatDate(auditData[constants.BEFORE])
            auditData[constants.AFTER] = utils.formatDate(auditData[constants.AFTER])
        }
        audits.audit.push(auditData);
    })
    audits[constants.TOTAL] = snapshot.size;
    logger.debug('Returning audit log to client.');
    response.status(200).send(audits);
});

// TODO: DELETE ME
router.delete("/", isAdminOrSuperAdmin, async (request, response, next) => {
    db.collection("audit")
        .get()
        .then(res => {
            res.forEach(element => {
                element.ref.delete();
            });
        })
    response.sendStatus(200)
});

module.exports = router;

/**
 * Async funciton to log data in audit collection
 * @param {Event Log} data 
 */
module.exports.logEvent = function (eventMessage, request, oldData, newData) {
    const eventData = {}
    eventData[constants.EVENT] = eventMessage
    eventData[constants.USER] = `${request.user.firstName} ${request.user.lastName}`
    eventData[constants.UID] = `${request.user.uid}`
    eventData[constants.DATE] = new Date()
    if(oldData && newData) {
        eventData[constants.BEFORE] = oldData
        eventData[constants.AFTER] = newData
    }
    logger.info('Writing event to audit')
    db.collection(constants.AUDIT).add(eventData)
        .then(() => {
            logger.info(`Successfully logged event in audit.`)
        })
        .catch((err) => {
            logger.error(`Error occurred while writing audit log \n ${err}`)
        })
}