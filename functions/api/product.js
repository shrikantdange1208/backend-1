const constants = require('../common/constants')
const validate = require('../common/validator')
const logger = require('../middleware/logger');
const { isAdmin } = require('../middleware/auth')
const audit = require('./audit')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all products from firestore
 * @returns Json object containing all products
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving all products from firestore");
    const products = {
        "products": []
    }
    let productCollection = db.collection(constants.PRODUCTS);
    let snapshot = await productCollection.get()
    snapshot.forEach(product => {
        var productData = product.data()
        productData[constants.PRODUCT] = product.id,
        productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = snapshot.size;
    logger.debug('Returning product list to client.');
    response.status(200).send(products);
});

/**
 * @description Route to retrieve single product data from firestore
 * @returns Json object containing requested product
 * @throws 400 if the product does not exists in firestore
 */
router.get('/:product', async (request, response, next) => {
    var requestedProduct = request.params.product.toLocaleLowerCase()
    logger.info(`Retrieving product ${requestedProduct} from firestore`)
    const doc = db.collection(constants.PRODUCTS).doc(requestedProduct);
    const product = await doc.get()
    if (!product.exists) {
        const error = new Error(`Requested product ${requestedProduct} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var productData = product.data()
    productData[constants.PRODUCT] = product.id,
    productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
    productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
    logger.debug(`Returning details for product ${requestedProduct} to client.`);
    response.status(200).send(productData);
});

/**
 * @description Route to retrieve products data from a given category
 * @returns Json object containing requested products
 */
router.get('/category/:category', async (request, response, next) => {
    var requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving products of category ${requestedCategory} from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCTS).where(constants.CATEGORY, '==', requestedCategory);
    const productSnapshot = await productRef.get()

    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.PRODUCT] = product.id,
        productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning products of category ${requestedCategory} to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active products
 * @returns Json object containing requested products
 */
router.get('/all/active', async (request, response, next) => {
    logger.info(`Retrieving all active products from firestore`)
    const products = {
        "products": []
    }

    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', true);
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.PRODUCT] = product.id,
        productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning active products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all inActive products
 * @returns Json object containing requested products
 */
router.get('/all/inactive', async (request, response, next) => {
    logger.info(`Retrieving all inactive products from firestore`)
    const products = {
        "products": []
    }

    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', false);
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.PRODUCT] = product.id,
        productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning inactive products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to retrieve all active/inActive products data from a given category
 * @returns Json object containing requested products
 */
router.get('/category/:category/:active', async (request, response, next) => {
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    var category = request.params.category.toLocaleLowerCase();
    logger.info(`Retrieving all active/inActive products from a given category from firestore`)
    const products = {
        "products": []
    }
    const productRef = db.collection(constants.PRODUCTS)
        .where(constants.IS_ACTIVE, '==', status)
        .where(constants.CATEGORY, '==', category)
    const productSnapshot = await productRef.get()
    productSnapshot.forEach(product => {
        var productData = product.data()
        productData[constants.PRODUCT] = product.id,
        productData[constants.CREATED_DATE] = productData.createdDate.toDate(),
        productData[constants.LAST_UPDATED_DATE] = productData.lastUpdatedDate.toDate()
        products.products.push(productData);
    })
    products[constants.TOTAL_PRODUCTS] = productSnapshot.size;
    logger.debug(`Returning products to client.`);
    response.status(200).send(products);
});

/**
 * @description Route to add products in Firestore
 * @returns 201 - Created
 * @throws 400 if product already exists or 404 if required params are missing
 */
router.post('/', isAdmin, async (request, response, next) => {

    logger.info(`Creating product in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product already exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Creating product ${productName} in firestore....`);
    const doc = db.collection(constants.PRODUCTS).doc(productName);
    const product = await doc.get()
    if (product.exists) {
        const err = new Error(`The product ${productName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = request.body
    delete data[constants.PRODUCT]
    if (!request.body.thresholds) {
        data[constants.THRESHOLDS] = {}
    }
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await db.collection(constants.PRODUCTS).doc(productName).set(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} added new product ${productName} to catalog`
    audit.logEvent(eventMessage, request)

    logger.debug(`${productName} document Created`)
    data[constants.PRODUCT] = productName
    response.status(201).json(data)
});

/**
 * @description Route to update product
 * @returns  204 - No Content
 * @throws 404 if product does not exist or 400 if request has wrong params
 */
router.put('/', isAdmin, async (request, response, next) => {
    logger.info(`Updating status for product in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If product does not exists, return 400
    var productName = request.body.product.toLocaleLowerCase()
    logger.info(`Updating product ${productName} in firestore....`);
    const productRef = db.collection(constants.PRODUCTS).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const err = new Error(`Requested product ${productName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = request.body
    delete data[constants.PRODUCT]
    data[constants.LAST_UPDATED_DATE] = new Date()
    await productRef.set(data, { merge: true })

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} updated product ${productName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Updated product ${productName}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete products
 * @returns  deleted product
 * @throws 400 if product does not exist
 */
router.delete('/:product', isAdmin, async (request, response, next) => {
    var productName = request.params.product.toLocaleLowerCase()
    logger.info(`Deleting product ${productName} from firestore`)

    const productRef = db.collection(constants.PRODUCTS).doc(productName);
    const product = await productRef.get()
    if (!product.exists) {
        const error = new Error(`Product ${productName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    await productRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} deleted product ${productName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Deleted product ${productName}`)
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
                product: joi.string()
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
                thresholds: joi.object().pattern(
                    joi.string()
                        .regex(/^[a-zA-Z]+$/).required(),
                    joi.number().required()
                )
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                product: joi.string()
                    .min(1)
                    .max(30),
                category: joi.string()
                    .min(1)
                    .max(30),
                unit: joi.string()
                    .min(1)
                    .max(30),
                thresholds: joi.object().pattern(
                    joi.string()
                        .regex(/^[a-zA-Z]+$/).required(),
                    joi.number().required()),
                isActive: joi.bool()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;
module.exports.addOrUpdateProduct = functions.firestore
    .document(`/${constants.PRODUCTS}/{productName}`)
    .onWrite(async (change, context) => {
        const productName = context.params.productName
        if (!change.before._fieldsProto) {
            logger.debug(`New product ${change.after.id} has been created`)
            addProductToCategory(change.after)
        } else if (!change.after._fieldsProto) {
            logger.debug(`Product ${change.before.id} has been deleted`)
            deleteProductFromCategory(change.before)
        } else {
            logger.debug(`Product ${change.before.id} has been updated`)
            var oldData = change.before.data()
            var newData = change.after.data()
            if (oldData.category !== newData.category) {
                logger.debug(`Category of product ${productName} changed from ${oldData.category} to ${newData.category}`)
                deleteProductFromCategory(change.before)
                addProductToCategory(change.after)
            } else if (oldData.isActive !== newData.isActive) {
                logger.debug(`Status of product ${productName} changed from ${oldData.isActive} to ${newData.isActive}`)
                if (newData.isActive) {
                    addProductToCategory(change.after)
                } else {
                    deleteProductFromCategory(change.after)
                }
            }
        }
    });

async function addProductToCategory(newProduct) {
    var productName = newProduct.id
    var category = newProduct.data().category;
    const categoryRef = db.doc(`${constants.CATEGORIES}/${category}`);
    const categorySnapshot = await categoryRef.get()
    // Check if category is present in the collection
    if (!categorySnapshot.exists) {
        console.log(`Category ${category} is not present in firestore!!!!`)
        return `Category ${category} is not present in firestore!!!!`;
    }
    const products = categorySnapshot.data().products;
    products.push(productName);
    await categoryRef.update({ 'products': products })
}

async function deleteProductFromCategory(deletedProduct) {
    var productName = deletedProduct.id
    var category = deletedProduct.data().category;
    const categoryRef = db.doc(`${constants.CATEGORIES}/${category}`);
    const categorySnapshot = await categoryRef.get()
    // Check if category is present in the collection
    if (!categorySnapshot.exists) {
        console.log(`Category ${category} is not present in firestore!!!!`)
        return `Category ${category} is not present in firestore!!!!`;
    }
    const products = categorySnapshot.data().products;
    var index = products.indexOf(productName)
    products.splice(index, 1);
    await categoryRef.update({ 'products': products })
}