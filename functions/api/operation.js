const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const { isAdmin } = require('../middleware/auth');
const audit = require('./audit')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all operations from firestore
 * @returns Json object containing all operations
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving all operations from firestore");
    const operations = {
        "operations": []
    }
    let operationCollection = db.collection(constants.OPERATIONS);
    let snapshot = await operationCollection.get()
    snapshot.forEach(operation => {
        var operationData = operation.data()
        operationData[constants.NAME] = utils.capitalize(operationData[constants.NAME])
        operationData[constants.ID] = operation.id
        operationData = utils.formatDate(operationData)
        operations.operations.push(operationData);
    })
    operations[constants.TOTAL_OPERATIONS] = snapshot.size;
    logger.debug('Returning operation list to client.');
    response.status(200).send(operations);
});

/**
 * @description Route to retrieve single operation data from firestore
 * @returns Json object containing requested operation
 * @throws 400 if the operation does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var  operationId = request.params.id
    logger.info(`Retrieving operation from firestore`)
    const doc = db.collection(constants.OPERATIONS).doc(operationId);
    const operation = await doc.get()
    if (!operation.exists) {
        const error = new Error(`Requested operation is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var operationData = operation.data()
    operationData[constants.NAME] = utils.capitalize(operationData[constants.NAME])
    operationData[constants.ID] = operation.id
    operationData = utils.formatDate(operationData)
    logger.debug(`Returning details for operation to client.`);
    response.status(200).send(operationData);
});

/**
 * @description Route to retrieve all active operations
 * @returns Json object containing requested operations
 */
router.get('/all/active', async (request, response, next) => {
    logger.info(`Retrieving all active operations from firestore`)
    const operations = {
        "operations": []
    }

    const operationRef = db.collection(constants.OPERATIONS)
        .where(constants.IS_ACTIVE, '==', true);
    const operationSnapshot = await operationRef.get()
    operationSnapshot.forEach(operation => {
        var operationData = operation.data()
        operationData[constants.OPERATION] = operation.id
        operationData[constants.CREATED_DATE] = operationData.createdDate.toDate()
        operationData[constants.LAST_UPDATED_DATE] = operationData.lastUpdatedDate.toDate()
        operations.operations.push(operationData);
    })
    operations[constants.TOTAL_OPERATIONS] = operationSnapshot.size;
    logger.debug(`Returning operations to client.`);
    response.status(200).send(operations);
});

/**
 * @description Route to retrieve all inActive operations
 * @returns Json object containing requested operations
 */
router.get('/all/inactive', async (request, response, next) => {
    logger.info(`Retrieving all inActive operations from firestore`)
    const operations = {
        "operations": []
    }

    const operationRef = db.collection(constants.OPERATIONS)
        .where(constants.IS_ACTIVE, '==', false);
    const operationSnapshot = await operationRef.get()
    operationSnapshot.forEach(operation => {
        var operationData = operation.data()
        operationData[constants.OPERATION] = operation.id
        operationData[constants.CREATED_DATE] = operationData.createdDate.toDate()
        operationData[constants.LAST_UPDATED_DATE] = operationData.lastUpdatedDate.toDate()
        operations.operations.push(operationData);
    })
    operations[constants.TOTAL_OPERATIONS] = operationSnapshot.size;
    logger.debug(`Returning operations to client.`);
    response.status(200).send(operations);
});

/**
 * @description Route to add operations in Firestore
 * @returns 201 - Created 
 * @throws 400 if operation already exists or 404 if required params are missing
 */
router.post('/', isAdmin, async (request, response, next) => {
    logger.info(`Creating Operation in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category already exists, return 400
    var operationName = request.body.name.toLocaleLowerCase()
    logger.info(`Creating operation ${operationName} in firestore....`);
    const operationSnapshot = await db.collection(constants.OPERATIONS)
        .where(constants.NAME, '==', operationName)
        .get()
    if (operationSnapshot.size > 0) {
        const err = new Error(`The operation ${operationName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }
    let data = request.body
    data[constants.NAME] = operationName
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    const operationRef = await db.collection(constants.OPERATIONS)
        .add(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} created new operation ${operationName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Created operation ${operationName}`)
    response.status(201).json({ 'id': operationRef.id, ...data })
});

/**
 * @description Route to update operation
 * @returns  204 - No Content
 * @throws 404 if operation does not exist or 400 has wrong params
 */
router.put('/', isAdmin, async (request, response, next) => {
    logger.info(`Updating a operation in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var operationid = request.body.id
    const operationRef = db.collection(constants.OPERATIONS).doc(operationid);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const err = new Error(`Requested operation is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    const oldData = operation.data()
    let newData = request.body
    delete newData[constants.ID]
    newData[constants.LAST_UPDATED_DATE] = new Date()
    delete newData[constants.CREATED_DATE]
    await operationRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]
    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} updated operation ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, request, oldData, newData)

    logger.debug(`Updated operation ${oldData[constants.NAME]}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete operations
 * @returns  deleted operation
 * @throws 400 if product does not exist
 */
router.delete('/:id', isAdmin, async(request, response, next) => {
    var operationid = request.params.id
    logger.info(`Deleting operation from firestore`)
    
    const operationRef = db.collection(constants.OPERATIONS).doc(operationid);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const error = new Error(`Operation is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const operationData = operation.data()
    await operationRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} deleted operation ${operationData[constants.NAME]}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Deleted operation ${operationData[constants.NAME]}`)
    response.status(200).json({"message": "deleted successfully"})
})

/**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  */
 function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.CREATE:
            schema = joi.object({
                name: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                label: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
        case  constants.UPDATE:
            schema = joi.object({
                id: joi.string()
                .required(),
                name: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool(),
                label: joi.string()
                    .min(1)
                    .max(30),
                description: joi.string()
                    .min(1)
                    .max(50),
                lastUpdatedDate: joi.date(),
                createdDate: joi.date(),
                isActive: joi.bool()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;