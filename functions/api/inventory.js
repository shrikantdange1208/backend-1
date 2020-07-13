const constants = require('../common/constants')
const logger = require('../middleware/logger');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
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
router.get('/:id/belowthreshold/', async (request, response, next) => {
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
    for (const doc of branchDocuments) {
        const p1 = getInventory(branchCollectionRef.doc(doc.id), doc.id, false)
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
    for (const doc of branchDocuments) {
        const p1 = getInventory(branchCollectionRef.doc(doc.id), doc.id, true)
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
    if (belowthreshold) {
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
        data[constants.PRODUCT] = product.id
        inventory.inventory.push(data)
    })
    inventory[constants.TOTAL_PRODUCTS] = productCollection.size
    inventory[constants.BRANCH] = branchId
    return inventory
}

module.exports = router;

/**
 * Trigger to update availableQuantity and isBelowThreshold value after
 * a transaction is completed for a particular branch
 */
module.exports.updateAvailableQuantityInInventory = functions.firestore
    .document(`/${constants.BRANCHES}/{branch}/${constants.TRANSACTIONS}/{transactionId}`)
    .onWrite(async (snapshot, context) => {
        const transactionRecord = snapshot.after.data()
        const branchId = context.params.branch
        const productId = transactionRecord[constants.PRODUCT]
        logger.info(`Updating availableQuantity for product ${transactionRecord[constants.PRODUCT]} in branch ${branchId}`)

        const inventoryRef = await db.collection(constants.BRANCHES).doc(branchId)
            .collection(constants.INVENTORY)
        const inventorySnapshot = await inventoryRef
            .doc(productId)
            .get()

        var data = {}
        if (!inventorySnapshot.exists) {
            const productSnapshot = await db.collection(constants.PRODUCTS)
                .doc(productId).get()
            if (productSnapshot.get(constants.THRESHOLDS)[branchId]) {
                data[constants.THRESHOLD] = productSnapshot.get(constants.THRESHOLDS)[branchId]
            } else {
                data[constants.THRESHOLD] = 0
            }
        } else {
            data = inventorySnapshot.data()
        }
        data[constants.AVAILABLE_QUANTITY]
            = transactionRecord[constants.CLOSING_QUANTITY]
        data[constants.IS_BELOW_THRESHOLD]
            = transactionRecord[constants.CLOSING_QUANTITY] < data[constants.THRESHOLD]
                ? true : false
        inventoryRef.doc(productId).set(data)
    });
