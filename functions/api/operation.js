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
 * @description Route to retrieve all active/inActive operations
 * @returns Json object containing requested operations
 */
router.get('/:active/active', async (request, response, next) => {
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    logger.info(`Retrieving all active/inActive operations from firestore`)
    const operations = {
        "operations": []
    }

    const operationRef = db.collection(constants.OPERATION)
        .where(constants.IS_ACTIVE, '==', status);
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
 * @returns Created operation
 * @throws 400 if operation already exists or if required params are missing
 */
router.post('/', async (request, response, next) => {
    logger.info(`Creating operation in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.OPERATION)
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

    let data = {}
    data[constants.LABEL] = request.body.label
    data[constants.DESCRIPTION] = request.body.description
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await db.collection(constants.OPERATION).doc(operationName).set(data)
    logger.debug(`${operationName} document Created`)
    var result = {}
    result[constants.OPERATION] = operationName
    result[constants.LABEL] = data.label
    result[constants.DESCRIPTION] = data.description
    response.status(200).send(result);    
});

/**
 * @description Route to update status of operation
 * @returns  updated operation
 * @throws 400 if operation does not exist or has wrong params
 */
router.put('/status', async (request, response, next) => {
    logger.info(`Updating status for operation in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.STATUS)
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
    let data = {}
    data[constants.IS_ACTIVE] = request.body.isActive
    data[constants.LAST_UPDATED_DATE] = new Date()
    await operationRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.OPERATION] = operationName
    data = JSON.parse(JSON.stringify( data, [constants.OPERATION,constants.IS_ACTIVE]));
    logger.debug(`Updated status of operation ${operationName} to ${request.body.isActive}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to update label of operation
 * @returns  updated operation
 * @throws 400 if operation does not exist or has wrong params
 */
router.put('/label', async (request, response, next) => {
    logger.info(`Updating label for operation in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.LABEL)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var operationName = request.body.operation.toLocaleLowerCase()
    logger.info(`Updating label of operation ${operationName} in firestore....`);
    const operationRef = db.collection(constants.OPERATION).doc(operationName);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const err = new Error(`Requested operation ${operationName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.LABEL] = request.body.label
    data[constants.LAST_UPDATED_DATE] = new Date()
    await operationRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.OPERATION] = operationName
    data = JSON.parse(JSON.stringify( data, [constants.OPERATION,constants.LABEL]));
    logger.debug(`Updated label of operation ${operationName} to ${request.body.label}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to update label of operation
 * @returns  updated operation
 * @throws 400 if operation does not exist or has wrong params
 */
router.put('/desc', async (request, response, next) => {
    logger.info(`Updating description for operation in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.DESCRIPTION)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var operationName = request.body.operation.toLocaleLowerCase()
    logger.info(`Updating description of operation ${operationName} in firestore....`);
    const operationRef = db.collection(constants.OPERATION).doc(operationName);
    const operation = await operationRef.get()
    if (!operation.exists) {
        const err = new Error(`Requested operation ${operationName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.DESCRIPTION] = request.body.description
    data[constants.LAST_UPDATED_DATE] = new Date()
    await operationRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.OPERATION] = operationName
    data = JSON.parse(JSON.stringify( data, [constants.OPERATION,constants.DESCRIPTION]));
    logger.debug(`Updated description of operation ${operationName} to ${request.body.description}`)
    response
        .status(200)
        .send(data);
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
    response
        .status(200)
        .send(data);
})

/**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  *         product for create product
  *         description for updating description
  *         status for updating status
  *         status for updating unit
  */
 function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.OPERATION:
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
        case  constants.STATUS:
            schema = joi.object({
                operation: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
        case constants.DESCRIPTION:
            schema = joi.object({
                operation: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required()
            })
            break
        case constants.LABEL:
                schema = joi.object({
                    operation: joi.string()
                        .min(1)
                        .max(30)
                        .required(),
                    label: joi.string()
                        .min(1)
                        .max(30)
                        .required()
                })
    }
    return validate(schema, body)
}

module.exports = router;