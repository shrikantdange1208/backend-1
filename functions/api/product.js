const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils');
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth')
const audit = require('./audit')
const joi = require('@hapi/joi')
const admin = require('firebase-admin')
const functions = require('firebase-functions')
const express = require('express');
const router = express.Router()
const db = admin.firestore()

/**
 * @description Route to retireve all products from firestore
 * @returns Json object containing all products
 */
router.get("/", async (request, response, next) => {
    console.info("Retrieving all products from firestore");
    const products = await getAllProducts()
    console.debug('Returning product list to client.');
    response.status(200).send(products);
});

/**
 * Utility method to retrieve all products from firestore
 */
const getAllProducts = async function() { 
    const products = {
        "products": []
    }
    let productCollection = db.collection(constants.PRODUCTS);
    let snapshot = await productCollection.get()
    snapshot.forEach(product => {
        var productData = product.data()
        productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
        productData[constants.ID] = product.id
        productData = utils.formatDate(productData)
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = snapshot.size;
    return products
}

/**
 * @description Route to retrieve single product data from firestore
 * @returns Json object containing requested product
 * @throws 400 if the product does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var productId = request.params.id
    console.info(`Retrieving product from firestore`)
    const doc = db.collection(constants.PRODUCTS).doc(productId);
    const product = await doc.get()
    if (!product.exists) {
        const error = new Error(`Requested product is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var productData = product.data()
    productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
    productData[constants.ID] = product.id
    productData = utils.formatDate(productData)
    console.debug(`Returning details for product ${productData[constants.NAME]} to client.`);
    response.status(200).send(productData);
});

/**
 * @description Route to retrieve products data from a given category
 * @returns Json object containing requested products
 */
router.get('/category/:categoryId', async (request, response, next) => {
    var categoryId = request.params.categoryId
    console.info(`Retrieving products from a category from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.CATEGORY, '==', categoryId);
    const productSnapshot = await productRef.get()

    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
        productData[constants.ID] = product.id
        productData = utils.formatDate(productData)
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    console.debug(`Returning products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active products
 * @returns Json object containing requested products
 */
router.get('/all/active', async (request, response, next) => {
    console.info(`Retrieving all active products from firestore`)
    const products = {
        "products": []
    }

    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', true);
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
        productData[constants.ID] = product.id
        productData = utils.formatDate(productData)
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    console.debug(`Returning active products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all inActive products
 * @returns Json object containing requested products
 */
router.get('/all/inactive', async (request, response, next) => {
    console.info(`Retrieving all inactive products from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', false);
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
        productData[constants.ID] = product.id
        productData = utils.formatDate(productData)
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    console.debug(`Returning inactive products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active/inActive products data from a given category
 * @returns Json object containing requested products
 */
router.get('/category/:categoryId/:active', async (request, response, next) => {
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    var categoryId = request.params.categoryId;
    console.info(`Retrieving all active/inActive products from a given category from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', status)
        .where(constants.CATEGORY, '==', categoryId)
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.NAME] = utils.capitalize(productData[constants.NAME])
        productData[constants.ID] = product.id
        productData = utils.formatDate(productData)
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    console.debug(`Returning products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all thresholds for a given product
 * @returns Json object containing requested thresholds
 */
router.get('/thresholds/:id', async (request, response, next) => {
    var productId = request.params.id
    console.info(`Retrieving all thresholds for a given product from firestore`)
    const doc = db.collection(constants.PRODUCTS).doc(productId);
    const product = await doc.get()
    if (!product.exists) {
        const error = new Error(`Requested product is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var productData = product.data()
    const thresholds = {}
    thresholds[constants.PRODUCT] = productData[constants.NAME]
    thresholds[constants.THRESHOLDS] = productData[constants.THRESHOLDS]
    console.debug(`Returning details for all thresholds for a given product ${productData[constants.NAME]} to client.`);
    response.status(200).send(thresholds);
});

/**
 * @description Route to retrieve thresholds for all products for a branch
 * @returns Json object containing thresholds for all products for a branch
 */
router.get('/thresholds/all/:branchId', async (request, response, next) => {
    console.info(`Retrieving thresholds for all products for a branch from firestore`)
    var branchId = request.params.branchId
    const doc = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await doc.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }

    var branchData = branch.data()
    const thresholds = {
        "thresholds": []
    }
    var data = {}
    const productRef = db.collection(constants.PRODUCTS)
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        if (productData[constants.THRESHOLDS][branchId]) {
            data[product.id] = productData[constants.THRESHOLDS][branchId]
        }
    })
    thresholds.thresholds.push(data);
    thresholds[constants.BRANCH] = branchData[constants.NAME];
    console.debug(`Returning thresholds for all products for a branch to client.`);
    response.status(200).send(thresholds);
});

/**
 * @description Route to add products in Firestore
 * @returns 201 - Created
 * @throws 400 if product already exists or 404 if required params are missing
 */
router.post('/', isAdminOrSuperAdmin, async (request, response, next) => {

    console.info(`Creating product in firestore....`);
    // Validate parameters
    console.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product already exists, return 400
    var productName = request.body.name.toLocaleLowerCase()
    console.info(`Creating product ${productName} in firestore....`);
    const productSnapshot = await db.collection(constants.PRODUCTS)
        .where(constants.NAME, '==', productName)
        .get()

    if (productSnapshot.size > 0) {
        const err = new Error(`The product ${productName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = request.body
    data[constants.NAME] = productName
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    if (!request.body.thresholds) {
        data[constants.THRESHOLDS] = {}
    }
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    const productRef = await db.collection(constants.PRODUCTS).add(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.name} added new product ${productName} to catalog`
    audit.logEvent(eventMessage, request)

    console.debug(`${productName} document Created`)
    response.status(201).json({ 'id': productRef.id, ...data })
});

/**
 * @description Route to update product
 * @returns  204 - No Content
 * @throws 404 if product does not exist or 400 if request has wrong params
 */
router.put('/', isAdminOrSuperAdmin, async (request, response, next) => {
    console.info(`Updating product in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var productId = request.body.id
    console.info(`Updating a product in firestore....`);
    const productRef = db.collection(constants.PRODUCTS).doc(productId);
    const product = await productRef.get()
    if (!product.exists) {
        const err = new Error(`Requested product ${productId} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }

    const oldData = product.data()
    let newData = request.body
    delete newData[constants.ID]
    newData[constants.NAME] = newData[constants.NAME].toLocaleLowerCase()
    delete newData[constants.CREATED_DATE]
    newData[constants.LAST_UPDATED_DATE] = new Date()
    await productRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]

    // Add event in Audit
    const eventMessage = `User ${request.user.name} updated product ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, request, oldData, newData)

    console.debug(`Updated product ${oldData[constants.NAME]}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete products
 * @returns  deleted product
 * @throws 400 if product does not exist
 */
router.delete('/:id', isSuperAdmin, async (request, response, next) => {
    var productid = request.params.id
    console.info(`Deleting a product from firestore`)

    const productRef = db.collection(constants.PRODUCTS).doc(productid);
    const product = await productRef.get()
    if (!product.exists) {
        const error = new Error(`Product ${productid} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const productData = product.data()
    await productRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.name} deleted product ${productData[constants.NAME]}`
    audit.logEvent(eventMessage, request)

    console.debug(`Deleted product ${productData[constants.NAME]}`)
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
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                unit: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool().required(),
                thresholds: joi.object().pattern(
                    joi.string().required(),
                    joi.number().integer().strict().required()
                )
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                id: joi.string()
                    .required(),
                name: joi.string()
                    .min(1)
                    .max(30),
                category: joi.string()
                    .min(1)
                    .max(30),
                unit: joi.string()
                    .min(1)
                    .max(30),
                thresholds: joi.object().pattern(
                    joi.string().required(),
                    joi.number().integer().strict().required()),
                isActive: joi.bool(),
                lastUpdatedDate: joi.date(),
                createdDate: joi.date()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;
module.exports.getAllProducts = getAllProducts

/**
 * Trigger to execute methods on product updates and deletes
 */
module.exports.addOrUpdateProduct = functions.firestore
    .document(`/${constants.PRODUCTS}/{productId}`)
    .onWrite(async (change, context) => {
        const productId = context.params.productId
        if(change.before._fieldsProto && change.after._fieldsProto) {
            var oldData = change.before.data()
            var newData = change.after.data()
            console.debug(`Product ${oldData[constants.NAME]} has been updated`)
            
            if (oldData.unit !== newData.unit) {
                console.debug(`Unit of product ${oldData[constants.NAME]} changed from ${oldData.unit} to ${newData.unit}`)
                await updateCategoryOrUnitInInventory(productId, null, newData.unit)
            }

            if (Object.entries(oldData.thresholds).toString() !== Object.entries(newData.thresholds).toString()) {
                console.debug(`Thresholds of product ${oldData[constants.NAME]} has been updated`)
                updateThresholdInInventories(productId, oldData, newData)
            }
        }
    });

/**
 * Method to update threshold in inventory of a branch
 * @param {Updated product ID} productId 
 * @param {oldData} oldData 
 * @param {newData} newData 
 */
async function updateThresholdInInventories(productId, oldData, newData) {
    const oldThresholds = oldData[constants.THRESHOLDS];
    const newThresholds = newData[constants.THRESHOLDS];
    var updatedThresholds = {}
    for (const branchId in oldThresholds) {
        if ((oldThresholds[branchId] && newThresholds[branchId])
            && (oldThresholds[branchId] !== newThresholds[branchId])) {
            updatedThresholds[branchId] = newThresholds[branchId]
        }
    }

    for (const branchId in newThresholds) {
        if ((newThresholds[branchId] && !oldThresholds[branchId])) {
            updatedThresholds[branchId] = newThresholds[branchId]
        }
    }

    const promises = []
    for (let [key, value] of Object.entries(updatedThresholds)) {
        console.log(`Updating threshold for product ${oldData[constants.NAME]} to ${value} in branch ${key}`)
        promises.push(updateThresholdInInventory(productId, key, value))
    }
    Promise.all(promises)
        .then(console.log(`Updated all thresholds in branch inventories`))
        .catch(err => {
            console.error(`Error occurred while updating thresholds`)
            throw err
        })
}

/**
 * Async method to update all thresholds
 * @param {product ID} productId
 * @param {branch} branchId
 * @param {threshold} threshold
 */
async function updateThresholdInInventory(productId, branchId, threshold) {

    const inventoryRef = db.collection(constants.BRANCHES)
        .doc(branchId)
        .collection(constants.INVENTORY)
        .doc(productId)

    db.runTransaction(async (transaction) => {
        const inventoryDocument = await transaction.get(inventoryRef)
        const availableQuantity = inventoryDocument.data()[constants.AVAILABLE_QUANTITY]
        var isBelowThreshold = false

        if (threshold > availableQuantity) {
            isBelowThreshold = true
        }
        if (inventoryDocument.exists) {
            transaction.update(inventoryRef,
                {
                    'threshold': threshold,
                    'isBelowThreshold': isBelowThreshold
                });
        }
    })
}

async function updateCategoryOrUnitInInventory(productId, category, unit) {

    const branchCollectionRef = db.collection(constants.BRANCHES)
    const branchDocuments = await branchCollectionRef.listDocuments();

    for (const branchDoc of branchDocuments) {
        const inventoryRef = branchDoc
            .collection(constants.INVENTORY)
        const productSnapshot = await inventoryRef
            .doc(productId)
            .get()
        if (productSnapshot.exists) {
            if (category) {
                console.log(`Updating category in inventory for product ${productSnapshot.id} in branch ${branchDoc.id} to ${category}`)
                await inventoryRef
                    .doc(productId).update({ 'category': category })
            } else if (unit) {
                console.log(`Updating unit in inventory for product ${productSnapshot.id} in branch ${branchDoc.id} to ${unit}`)
                await inventoryRef
                    .doc(productId).update({ 'unit': unit })
            }
        }
    }
}