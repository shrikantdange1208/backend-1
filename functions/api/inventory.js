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
 * @description Route to retrieve inventory for a branch from firestore
 * @returns Json object containing inventory for a branch
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var branchId = request.params.id
    logger.info(`Retrieving inventory for a branch from firestore`)
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branchSnapshot = await branchRef.get()
    if (!branchSnapshot.exists) {
        const error = new Error(`Requested Branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const inventory = await getInventory(branchRef, branchId, false)

    logger.debug(`Returning inventory for branch ${branchSnapshot.data().name} to client.`);
    response.status(200).send(inventory);
});

/**
 * @description Route to retrieve inventory of products below threshold for a branch from firestore
 * @returns Json object containing inventory of products below threshold for a branch
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/belowthreshold/:id', async (request, response, next) => {
    var branchId = request.params.id
    logger.info(`Retrieving inventory for a branch from firestore`)

    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branchSnapshot = await branchRef.get()
    if (!branchSnapshot.exists) {
        const error = new Error(`Requested branch is not present.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const inventory = await getInventory(branchRef, branchId, true)

    logger.debug(`Returning inventory for branch ${branchSnapshot.data().name} to client.`);
    response.status(200).send(inventory);
});

/**
 * @description Route to retrieve inventory for all branches from firestore
 * @returns Json object containing inventory for all branches
 */
router.get('/', async (request, response, next) => {
    const inventories = {
        "inventories": []
    }
    
    const branchCollectionRef = db.collection(constants.BRANCHES)
    const branchDocuments = await branchCollectionRef.listDocuments();
    logger.info(`Retrieving inventory for  ${branchDocuments.length} branches from firestore`)
    const inventoryArray = []
    for(const doc of branchDocuments) {
        const p1 = getInventory(branchCollectionRef.doc(doc.id), doc.id ,false)
        inventoryArray.push(p1)
    }
    Promise.all(inventoryArray).then(inventory => {
        inventories.inventories.push(inventory)
        inventories[constants.TOTAL_BRANCHES] = branchDocuments.length
        logger.debug(`Returning inventory for all products for all branches.`);
        return response.status(200).send(inventories);
    }).catch(err => {
        err.statusCode = 500
        next(err)
        return;
    })
});

/**
 * @description Route to retrieve inventory for all products below threshold for all branches
 * @returns Json object containing inventory for all branches
 */
router.get('/all/branches/belowthreshold/', async (request, response, next) => {
    const inventories = {
        "inventories": []
    }
    
    const branchCollectionRef = db.collection(constants.BRANCHES)
    const branchDocuments = await branchCollectionRef.listDocuments();
    logger.info(`Retrieving inventory for  ${branchDocuments.length} branches from firestore`)
    const inventoryArray = []
    for(const doc of branchDocuments) {
        const p1 = getInventory(branchCollectionRef.doc(doc.id), doc.id ,true)
        inventoryArray.push(p1)
    }
    Promise.all(inventoryArray).then(inventory => {
        inventories.inventories.push(inventory)
        inventories[constants.TOTAL_BRANCHES] = branchDocuments.length
        logger.debug(`Returning inventory for all products for all branches.`);
        return response.status(200).send(inventories);
    }).catch(err => {
        err.statusCode = 500
        next(err)
        return;
    })
});

/**
 * Utility method to format inventory json
 * @param {*} branchName branchName
 * @param {*} inventoryData inventoryData
 * @param {*} inventoryData true or false
 */
async function getInventory(branchRef, branchId, belowthreshold) {
    const inventory = {
        "inventory": []
    }
    var productCollection;
    if(belowthreshold) {
        productCollection = await branchRef
                        .collection(constants.INVENTORY)
                        .where(constants.IS_BELOW_THRESHOLD, '==', true)
                        .get()
    } else {
        productCollection = await branchRef.collection(constants.INVENTORY)
                        .get()
    }
    productCollection.forEach((product) => {
        const data = product.data()
        data[constants.ID] = product.id
        inventory.inventory.push(data)
    })
    inventory[constants.TOTAL_PRODUCTS] = productCollection.size
    inventory[constants.BRANCH] = branchId
    return inventory
}

/**
 * Utility method to format inventory json
 * @param {*} branchName branchName
 * @param {*} inventoryData inventoryData
 * @param {*} inventoryData true or false
 */
async function getInventoryOld(branch, belowthreshold) {
    const inventory = {
        "inventory": []
    }
    const branchData = branch.data()
    const inventoryData = branchData[constants.INVENTORY];
    var size = 0
    if (belowthreshold) {
        for (let [productId, value] of Object.entries(inventoryData)) {
            if (value[constants.IS_BELOW_THRESHOLD]) {
                value[constants.PRODUCT] = productId;
                inventory.inventory.push(value)
                size++;
            }
        }
    } else {
        for (let [productId, value] of Object.entries(inventoryData)) {
            value[constants.PRODUCT] = productId;
            inventory.inventory.push(value)
            size++;
        }
    }
    inventory[constants.TOTAL_PRODUCTS] = size
    inventory[constants.NAME] = utils.capitalize(branchData[constants.NAME])
    return inventory
}

module.exports = router;