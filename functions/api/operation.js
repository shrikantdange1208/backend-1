const constants = require('../config/constants')
const validate = require('../validation/validator')
const logger = require('../middleware/logger');
const config = require('config');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const cors = require('cors');
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
    let operationCollection = db.collection(constants.OPERATION);
    let snapshot = await operationCollection.get()
    snapshot.forEach(operation => {
        var operationData = operation.data()
        operationData[constants.OPERATION] = operation.id
        operationData[constants.CREATED_DATE] = operationData.createdDate.toDate()
        operationData[constants.LAST_UPDATED_DATE] = operationData.lastUpdatedDate.toDate()
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
router.get('/:operation', async (request, response, next) => {
    var  requestedOperation = request.params.operation.toLocaleLowerCase()
    logger.info(`Retrieving operation ${requestedOperation} from firestore`)
    const doc = db.collection(constants.OPERATION).doc(requestedOperation);
    const operation = await doc.get()
    if (!operation.exists) {
        const error = new Error(`Requested operation ${requestedOperation} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var operationData = operation.data()
    operationData[constants.OPERATION] = operation.id
    operationData[constants.CREATED_DATE] = operationData.createdDate.toDate()
    operationData[constants.LAST_UPDATED_DATE] = operationData.lastUpdatedDate.toDate()
    logger.debug(`Returning details for operation ${requestedOperation} to client.`);
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

    const operationRef = db.collection(constants.OPERATION)
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

    const operationRef = db.collection(constants.OPERATION)
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
router.post('/', async (request, response, next) => {
    logger.info(`Creating operation in firestore....`);
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
    var operationName = request.body.operation.toLocaleLowerCase()
    logger.info(`Creating operation ${operationName} in firestore....`);
    const doc = db.collection(constants.OPERATION).doc(operationName);
    const operation = await doc.get()
    if (operation.exists) {
        const err = new Error(`The operation ${operationName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }
    let data = request.body
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await db.collection(constants.OPERATION)
        .doc(operationName)
        .set(data)
    logger.debug(`${operationName} document Created`)
    response.status(201).json({"message": "created successfully"})
});

/**
 * @description Route to update operation
 * @returns  204 - No Content
 * @throws 404 if operation does not exist or 400 has wrong params
 */
router.put('/', async (request, response, next) => {
    logger.info(`Updating status for operation in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var operationName = request.body.operation.toLocaleLowerCase()
    logger.info(`Updating status of operation ${operationName} in firestore....`);
    const operationRef = db.collection(constants.OPERATION).doc(operationName);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const err = new Error(`Requested operation ${operationName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = request.body
    delete data[constants.OPERATION]
    data[constants.LAST_UPDATED_DATE] = new Date()
    await operationRef.update(data)
    logger.debug(`Updated operation ${operationName}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete operations
 * @returns  deleted operation
 * @throws 400 if product does not exist
 */
router.delete('/:operation', async(request, response, next) => {
    var  operationName = request.params.operation.toLocaleLowerCase()
    logger.info(`Deleting operation ${operationName} from firestore`)
    
    const operationRef = db.collection(constants.OPERATION).doc(operationName);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const error = new Error(`Operation ${operationName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    let data = {}
    const operationData = operation.data()
    data[constants.OPERATION] = operationName
    data[constants.LABEL] = operationData.label
    data[constants.DESCRIPTION] = operationData.description
    
    await operationRef.delete()
    logger.debug(`Deleted operation ${operationName}`)
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
                operation: joi.string()
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
                    .required()
            })
            break
        case  constants.UPDATE:
            schema = joi.object({
                operation: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool(),
                label: joi.string()
                    .min(1)
                    .max(30),
                description: joi.string()
                    .min(1)
                    .max(50)
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;