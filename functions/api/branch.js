const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const formatDate = require('../common/dateFormatter')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const { isAdmin } = require('../middleware/auth');
const audit = require('./audit')
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all branches from firestore
 * @returns Json object containing all branches
 */
router.get("/", async (request, response) => {
    logger.info("Retrieving all branches from firestore");
    const branches = {
        "branches": []
    }
    let branchCollection = db.collection(constants.BRANCHES);
    let snapshot = await branchCollection.get()
    snapshot.forEach(branch => {
        var branchData = branch.data()
        branchData[constants.NAME] = utils.capitalize(branchData[constants.NAME])
        branchData[constants.ID] = branch.id
        branchData = utils.formatDate(branchData)
        delete branchData[constants.INVENTORY]
        branches.branches.push(branchData);
    })
    branches[constants.TOTAL_BRANCHES] = snapshot.size;
    logger.debug('Returning branches to client.');
    response.status(200).send(branches);
});

/**
 * @description Route to retrieve single branch data from firestore
 * @returns Json object containing requested branch
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var branchId = request.params.id
    logger.info(`Retrieving branch from firestore`)
    const doc = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var branchData = branch.data()
    branchData[constants.ID] = branchId
    branchData[constants.NAME] = utils.capitalize(branchData[constants.NAME])
    branchData = formatDate(branchData)
    delete branchData[constants.INVENTORY]
    logger.debug(`Returning details for branch ${branchData[constants.NAME]} to client.`);
    response.status(200).send(branchData);
});

/**
 * @description Route to retrieve users in a given branch
 * @returns Json object containing users
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var branchId = request.params.id
    logger.info(`Retrieving branch from firestore`)
    const doc = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var branchData = branch.data()
    logger.debug(`Returning details for branch ${branchData[constants.NAME]} to client.`);
    response.status(200).send(branchData[constants.USERS]);
});

/**
 * @description Route to add new branch in Firestore
 * @returns 201 - Created
 * @throws 400 if branch already exists or 404 if required params are missing
 */
router.post('/', isAdmin, async (request, response, next) => {
    logger.info(`Creating branch in firestore....`);
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
    var branchName = request.body.name.toLocaleLowerCase()
    logger.info(`Creating branch ${branchName} in firestore....`);
    const branchSnapshot = await db.collection(constants.BRANCHES)
        .where(constants.NAME, '==', branchName)
        .get()
    if (branchSnapshot.size > 0) {
        const err = new Error(`The branch ${branchName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = request.body
    data[constants.NAME] = branchName
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    data[constants.USERS] = []
    const branchRef = await db.collection(constants.BRANCHES).add(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} created new branch ${branchName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Created branch ${branchName}`)
    response.status(201).json({ 'id': branchRef.id, ...data })
});

/**
 * @description Route to update a branch
 * @returns 204, No Content
 * @throws 404/400 if branch does not exist or has wrong params resp.
 */
router.put('/', isAdmin, async (request, response, next) => {
    logger.debug(`Updating branch in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category does not exists, return 404
    var branchId = request.body.id
    logger.info(`Updating branch in firestore....`);
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await branchRef.get()
    if (!branch.exists) {
        const err = new Error(`Requested branch is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    const oldData = branch.data()
    let newData = request.body
    delete newData[constants.ID]
    newData[constants.LAST_UPDATED_DATE] = new Date()
    delete newData[constants.CREATED_DATE]
    await branchRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]
    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} updated branch ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, request, oldData, newData)

    logger.debug(`Updated branch ${oldData[constants.NAME]}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete a branch
 * @throws 400 if branch does not exist
 */
router.delete('/:id', isAdmin, async (request, response, next) => {
    var branchId = request.params.id
    logger.info(`Deleting branch from firestore`)

    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await branchRef.get()
    if (!branch.exists) {
        const error = new Error(`Branch to delete is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const branchData = branch.data()
    await branchRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} deleted branch ${branchData[constants.NAME]}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Deleted branch ${branchData[constants.NAME]}`)
    response.status(200).json({ "message": "deleted successfully" })
})

/**
 * Validates the request body.
 * @param {*} body request body
 * @param {*} type identifier to determine which request is to be validated
 */
function validateParams(body, type) {
    let schema;
    switch (type) {
        case constants.CREATE:
            schema = joi.object({
                name: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                address: joi.object({
                    street: joi.string()
                        .min(1)
                        .max(100)
                        .required(),
                    city: joi.string()
                        .min(1)
                        .max(50)
                        .required(),
                    state: joi.string()
                        .min(1)
                        .max(50)
                        .required(),
                    country: joi.string()
                        .min(1)
                        .max(50)
                        .required(),
                    zipcode: joi.number()
                }).required(),
                isHeadOffice: joi.bool()
                    .required(),
                isActive: joi.bool().required()
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                id: joi.string()
                    .min(1)
                    .max(30),
                name: joi.string()
                    .min(1)
                    .max(30),
                address: joi.object({
                    street: joi.string()
                        .min(1)
                        .max(100),
                    city: joi.string()
                        .min(1)
                        .max(50),
                    state: joi.string()
                        .min(1)
                        .max(50),
                    country: joi.string()
                        .min(1)
                        .max(50),
                    zipcode: joi.number()
                }),
                isHeadOffice: joi.bool(),
                isActive: joi.bool(),
                users: joi.array()
                    .items(joi.string().allow('')),
                lastUpdatedDate: joi.date(),
                createdDate: joi.date()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;