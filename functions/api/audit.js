const constants = require('../common/constants')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const { isSuperAdmin, isAdminOrSuperAdmin} = require('../middleware/auth');
const admin = require('firebase-admin');
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
    var {user,fromDate,toDate} = request.query;
    var nextPageToken = request.query.nextPageToken ? request.query.nextPageToken : null;
    var prevPageToken = request.query.prevPageToken ? request.query.prevPageToken : null;
    
    let auditCollection = db.collection(constants.AUDIT)
                            .orderBy(constants.DATE,'desc');
    if(user){
        auditCollection = auditCollection.where(constants.USER,"==",user)
    }
    if(fromDate){
        auditCollection = auditCollection.where(constants.DATE,">=",new Date(fromDate));
    }
    if(toDate){
        toDate = new Date(toDate)
        toDate.setDate(toDate.getDate()+1)
        auditCollection = auditCollection.where(constants.DATE,"<",toDate);
    }
    if(nextPageToken !== null && prevPageToken !== null) {
        response.status(400)
        .send("Invalid Query Parameters, Please send either nextPageToken or prevPageToken");

    }
    var auditCollectionOrig = auditCollection
    //Case 1 : if both are null, then default to sending first time with defined pagesize
    if(nextPageToken === null && prevPageToken === null) {
        auditCollection = auditCollection
                .limit(constants.PAGE_SIZE)
    }
    //Case 2 : only nextPageToken is given, then start after the doc id + pagesize
    if(nextPageToken !== null ) {
        var lastVisibleDoc = await db
            .collection(constants.AUDIT)
            .doc(nextPageToken)
            .get()
        console.log (lastVisibleDoc.id);
        if(lastVisibleDoc){
            auditCollection = auditCollection
                .startAfter(lastVisibleDoc)
                .limit(constants.PAGE_SIZE)
            }
    }
    // Case 3 : Only prev page token is given, then end Before the given doc id with limit pagesize.
    if(prevPageToken !== null) {
    var prevVisibleDoc = await db
            .collection(constants.AUDIT)
            .doc(prevPageToken)
            .get()
        console.log (prevVisibleDoc.id);
        if(prevVisibleDoc){
            auditCollection = auditCollection
                .endBefore(prevVisibleDoc)
                .limitToLast(constants.PAGE_SIZE)
        }
    }
    let snapshot = await auditCollection.get()

    //Final query retrieval
    var size = snapshot.docs.length;
    console.log(`result size: ${size}`)
    for(var i=0;i<size;i++){
        var audit = snapshot.docs[i]
        var auditData = audit.data()
        auditData[constants.DATE] = auditData[constants.DATE].toDate()
        if(auditData[constants.BEFORE] && auditData[constants.AFTER]) {
            auditData[constants.BEFORE] = utils.formatDate(auditData[constants.BEFORE])
            auditData[constants.AFTER] = utils.formatDate(auditData[constants.AFTER])
        }
        auditData[constants.ID] = audit.id
        audits.audit.push(auditData);
    }
    // Populating the response ( with page tokens)
    if(size >0){
         //To identify if its end of pages ( no prev or no next)
        const hasPrevious =  await utils.hasPreviousPage(auditCollectionOrig,snapshot)
        const hasNext = await utils.hasNextPage(auditCollectionOrig,snapshot)

        audits[constants.NEXT_PAGE_TOKEN]= hasNext ? snapshot.docs[size-1].id : null;
        audits[constants.PREV_PAGE_TOKEN]= hasPrevious ? snapshot.docs[0].id : null;
    }
    logger.debug('Returning audit log to client.');
    response.status(200).send(audits);
});

// TODO: DELETE ME
router.delete("/", isSuperAdmin, async (request, response, next) => {
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
            return
        })
        .catch((err) => {
            logger.error(`Error occurred while writing audit log \n ${err}`)
            return
        })
}