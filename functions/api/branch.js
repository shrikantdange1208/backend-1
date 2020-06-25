const constants = require('../common/constants')
const validate = require('../common/validator')
const logger = require('../middleware/logger');
const formatDate = require('../common/dateFormatter')
const config = require('config');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const auth = require('./auth/auth')
const audit = require('./audit')
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const cors = require('cors');
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
        branchData[constants.BRANCH] = branch.id
        delete branchData[constants.INVENTORY]
        branchData = formatDate(branchData)
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
router.get('/:branch', async (request, response, next) => {
    var requestedBranch = request.params.branch.toLocaleLowerCase()
    logger.info(`Retrieving branch ${requestedBranch} from firestore`)
    const doc = db.collection(constants.BRANCHES).doc(requestedBranch);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch ${requestedBranch} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var branchData = branch.data()
    branchData[constants.BRANCH] = branch.id
    branchData = formatDate(branchData)
    delete branchData[constants.INVENTORY]
    logger.debug(`Returning details for branch ${requestedBranch} to client.`);
    response.status(200).send(branchData);
});

/**
 * @description Route to retrieve inventory for a branch from firestore
 * @returns Json object containing inventory for a branch
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/inventory/:branch', async (request, response, next) => {
    const inventory = {
        "inventory": []
    }

    var requestedBranch = request.params.branch.toLocaleLowerCase()
    logger.info(`Retrieving inventory for a branch ${requestedBranch} from firestore`)
    const doc = db.collection(constants.BRANCHES).doc(requestedBranch);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch ${requestedBranch} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const inventoryData = branch.data()[constants.INVENTORY];
    var size = 0
    for (let [product, value] of Object.entries(inventoryData)) {
        value[constants.PRODUCT] = product;
        inventory.inventory.push(value) 
        size++;   
    }
    inventory[constants.TOTAL_PRODUCTS] = size
    logger.debug(`Returning inventory for branch ${requestedBranch} to client.`);
    response.status(200).send(inventory);
});

/**
 * @description Route to retrieve inventory of products below threshold for a branch from firestore
 * @returns Json object containing inventory of products below threshold for a branch
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/inventory/belowthreshold/:branch', async (request, response, next) => {
    const inventory = {
        "inventory": []
    }

    var requestedBranch = request.params.branch.toLocaleLowerCase()
    logger.info(`Retrieving inventory of products below threshold for branch ${requestedBranch} from firestore`)
    const doc = db.collection(constants.BRANCHES).doc(requestedBranch);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch ${requestedBranch} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const inventoryData = branch.data()[constants.INVENTORY];
    var size = 0
    for (let [product, value] of Object.entries(inventoryData)) {
        if(value[constants.IS_BELOW_THRESHOLD]) {
            value[constants.PRODUCT] = product;
            inventory.inventory.push(value) 
            size++;
        }
    }
    inventory[constants.TOTAL_PRODUCTS] = size
    logger.debug(`Returning inventory of products below threshold for branch ${requestedBranch} to client.`);
    response.status(200).send(inventory);
});


/**
 * @description Route to retrieve inventory for all products below threshold for all branches
 * @returns Json object containing inventory for all branches
 */
router.get('/all/inventory', async (request, response, next) => {
    const inventories = {
        "inventories": []
    }
    logger.info(`Retrieving inventory for all branch from firestore`)
    const doc = db.collection(constants.BRANCHES)
    const branchSnapshots = await doc.get()
    branchSnapshots.forEach(branch => {
        var inventory = {
            "inventory": []
        }
        const inventoryData = branch.data()[constants.INVENTORY];
        var size = 0
        for (let [product, value] of Object.entries(inventoryData)) {
            value[constants.PRODUCT] = product;
            inventory.inventory.push(value) 
            size++;   
        }
        inventory[constants.TOTAL_PRODUCTS] = size
        inventory[constants.BRANCH] = branch.id
        inventories.inventories.push(inventory);
    })
    inventories[constants.TOTAL_BRANCHES] = branchSnapshots.size
    logger.debug(`Returning inventory for all branches to client.`);
    response.status(200).send(inventories);
});

/**
 * @description Route to retrieve inventory for all branches from firestore
 * @returns Json object containing inventory for all branches
 */
router.get('/all/inventory/belowthreshold', async (request, response, next) => {
    const inventories = {
        "inventories": []
    }
    logger.info(`Retrieving inventory for all products below threshold for all branches`)
    const doc = db.collection(constants.BRANCHES)
    const branchSnapshots = await doc.get()
    branchSnapshots.forEach(branch => {
        var inventory = {
            "inventory": []
        }
        const inventoryData = branch.data()[constants.INVENTORY];
        var size = 0
        for (let [product, value] of Object.entries(inventoryData)) {
            if(value[constants.IS_BELOW_THRESHOLD]) {
                value[constants.PRODUCT] = product;
                inventory.inventory.push(value) 
                size++;
            }   
        }
        inventory[constants.TOTAL_PRODUCTS] = size
        inventory[constants.BRANCH] = branch.id
        inventories.inventories.push(inventory);
    })
    inventories[constants.TOTAL_BRANCHES] = branchSnapshots.size
    logger.debug(`Returning inventory for all products below threshold for all branches.`);
    response.status(200).send(inventories);
});

/**
 * @description Route to add new branch in Firestore
 * @returns 201 - Created
 * @throws 400 if branch already exists or 404 if required params are missing
 */
router.post('/', async (request, response, next) => {
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
    var branchName = request.body.branch.toLocaleLowerCase()
    logger.info(`Creating branch ${branchName} in firestore....`);
    const doc = db.collection(constants.BRANCHES).doc(branchName);
    const branch = await doc.get()
    if (branch.exists) {
        const err = new Error(`The branch ${branchName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = request.body
    delete data[constants.BRANCH];
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    data[constants.USERS] = []
    data[constants.INVENTORY] = {}
    await db.collection(constants.BRANCHES).doc(branchName).set(data)
    logger.debug(`${branchName} document Created`)
    response.status(201).json({ "message": "created successfully" })
});

/**
 * @description Route to update a branch
 * @returns 204, No Content
 * @throws 404/400 if branch does not exist or has wrong params resp.
 */
router.put('/', async (request, response, next) => {
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
    var branchName = request.body.branch
    logger.info(`Updating branch ${branchName} in firestore....`);
    const branchRef = db.collection(constants.BRANCHES).doc(branchName);
    const branch = await branchRef.get()
    if (!branch.exists) {
        const err = new Error(`Requested branch ${branchName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = request.body
    delete data[constants.BRANCH]
    data[constants.LAST_UPDATED_DATE] = new Date()
    await branchRef.set(data, {merge: true})
    logger.debug(`Updated branch ${branchName}`)
    response.sendStatus(204)
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
                branch: joi.string()
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
                        .required()
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                branch: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
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
                isActive: joi.bool()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;