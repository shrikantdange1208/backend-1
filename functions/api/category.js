const constants = require('../common/constants')
const validate = require('../common/validator')
const logger = require('../middleware/logger');
const { isAdmin } = require('../middleware/auth');
const audit = require('./audit')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all categories from firestore
 * @returns Json object containing all categories
 */
router.get("/", async (request, response) => {
    logger.info("Retrieving all categories from firestore");
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES);
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.CATEGORY] = category.id
        categoryData[constants.CREATED_DATE] = categoryData[constants.CREATED_DATE].toDate()
        categoryData[constants.LAST_UPDATED_DATE] = categoryData[constants.LAST_UPDATED_DATE].toDate()
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData);
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    logger.debug('Returning categories to client.');
    response.status(200).send(categories);
});

/**
 * @description Route to retrieve single category data from firestore
 * @returns Json object containing requested category
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:category', async (request, response, next) => {
    var requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving category ${requestedCategory} from firestore`)
    const doc = db.collection(constants.CATEGORIES).doc(requestedCategory);
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category ${requestedCategory} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()
    categoryData[constants.CATEGORY] = category.id
    categoryData[constants.CREATED_DATE] = categoryData[constants.CREATED_DATE].toDate()
    categoryData[constants.LAST_UPDATED_DATE] = categoryData[constants.LAST_UPDATED_DATE].toDate()
    delete categoryData[constants.PRODUCTS]
    logger.debug(`Returning details for category ${requestedCategory} to client.`);
    response.status(200).send(categoryData);
});

/**
 * @description Route to retrieve all products from a given category
 * @returns Json object containing array of products for a given category
 */
router.get('/products/:category', async (request, response, next) => {
    var requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving products for category ${requestedCategory}`)
    const doc = db.collection(constants.CATEGORIES).doc(requestedCategory)
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category ${requestedCategory} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()
    logger.debug(`Returning products from category ${requestedCategory} to client.`);
    response.status(200).send(categoryData[constants.PRODUCTS]);
});

/**
 * @description Route to retrieve all active categories from firestore
 * @returns Json object containing all categories
 */
router.get("/all/active", async (request, response) => {
    logger.info("Retrieving all active categories from firestore");
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES)
        .where(constants.IS_ACTIVE, '==', true)
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.CATEGORY] = category.id
        categoryData[constants.CREATED_DATE] = categoryData[constants.CREATED_DATE].toDate()
        categoryData[constants.LAST_UPDATED_DATE] = categoryData[constants.LAST_UPDATED_DATE].toDate()
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData)
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    logger.debug('Returning categories to client.');
    response.status(200).send(categories)
});

/**
 * @description Route to retrieve all inactive categories from firestore
 * @returns Json object containing all categories
 */
router.get("/all/inactive", async (request, response) => {
    logger.info("Retrieving all inactive categories from firestore");
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES)
        .where(constants.IS_ACTIVE, '==', false)
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.CATEGORY] = category.id
        categoryData[constants.CREATED_DATE] = categoryData[constants.CREATED_DATE].toDate()
        categoryData[constants.LAST_UPDATED_DATE] = categoryData[constants.LAST_UPDATED_DATE].toDate()
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData)
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    logger.debug('Returning categories to client.');
    response.status(200).send(categories)
});

/**
 * @description Route to add categories in Firestore
 * @returns 201 - Created
 * @throws 400 if category already exists or 404 if required params are missing
 */
router.post('/', isAdmin, async (request, response, next) => {
    logger.info(`Creating category in firestore....`);
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
    var categoryName = request.body.category.toLocaleLowerCase()
    logger.info(`Creating category ${categoryName} in firestore....`);
    const doc = db.collection(constants.CATEGORIES).doc(categoryName);
    const category = await doc.get()
    if (category.exists) {
        const err = new Error(`The category ${categoryName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = {}
    data[constants.DESCRIPTION] = request.body.description
    data[constants.IS_ACTIVE] = true
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    data[constants.PRODUCTS] = []
    await db.collection(constants.CATEGORIES).doc(categoryName).set(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} added new category ${categoryName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`${categoryName} document Created`)
    data[constants.CATEGORY] = categoryName
    response.status(201).json(data)
});

/**
 * @description Route to update category
 * @returns 204, No Content
 * @throws 404/400 if category does not exist or has wrong params resp.
 */
router.put('/', isAdmin, async (request, response, next) => {
    logger.debug(`Updating category in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category does not exists, return 404
    var categoryName = request.body.category
    logger.info(`Updating category ${categoryName} in firestore....`);
    const categoryRef = db.collection(constants.CATEGORIES).doc(categoryName);
    const category = await categoryRef.get()
    if (!category.exists) {
        const err = new Error(`Requested category ${categoryName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = request.body
    delete data[constants.CATEGORY]
    data[constants.LAST_UPDATED_DATE] = new Date()
    await categoryRef.update(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} updated category ${categoryName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Updated category ${categoryName}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete categories
 * @returns  deleted category
 * @throws 400 if category does not exist
 */
router.delete('/:category', isAdmin, async (request, response, next) => {
    var categoryName = request.params.category.toLocaleLowerCase()
    logger.info(`Deleting category ${categoryName} from firestore`)

    const categoryRef = db.collection(constants.CATEGORIES).doc(categoryName);
    const category = await categoryRef.get()
    if (!category.exists) {
        const error = new Error(`Category ${categoryName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    await categoryRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} deleted category ${categoryName}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Deleted category ${categoryName}`)
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
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required()
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50),
                isActive: joi.bool()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;
module.exports.addOrUpdateCategory = functions.firestore
    .document(`/${constants.CATEGORIES}/{categoryName}`)
    .onWrite(async (change, context) => {
        const categoryName = context.params.categoryName
        if (!change.after._fieldsProto) {
            logger.debug(`Category ${change.before.id} has been deleted`)
            deleteAllProductsFromCategory(change.before)
        } else if(change.before._fieldsProto && change.after._fieldsProto) {
            logger.debug(`Category ${change.before.id} has been updated`)
            var oldData = change.before.data()
            var newData = change.after.data()
            if(oldData.isActive !== newData.isActive) {
                logger.debug(`Status of category ${categoryName} changed from ${oldData.isActive} to ${newData.isActive}`)
                changeStatusOfAllProducts(change.after)
            } else {
                return
            }
        }
    });

async function changeStatusOfAllProducts(updatedCategory) {
    var categoryName = updatedCategory.id
    var status = updatedCategory.data().isActive;
    console.log(`Updating status of all products in category ${categoryName} to ${status}`)
    const productCollection = db.collection(constants.PRODUCTS)
        .where(constants.CATEGORY, '==', categoryName)
    const productSnapshot = await productCollection.get()
    let batch = db.batch()
    productSnapshot.docs.forEach((product) => {
        
        console.log(`Retrieving product ref for ${product.id}`)
        //const productRef = db.collection(constants.PRODUCT).doc(product.id)
        batch.update(product.ref, {'isActive': status})
        
    })
    await batch.commit();
    console.log(`Updated status of all products in category ${categoryName}`)
}

async function deleteAllProductsFromCategory(deletedCategory) {
    var categoryName = deletedCategory.id
    const productCollection = db.collection(constants.PRODUCTS)
        .where(constants.CATEGORY, '==', categoryName)
    const productSnapshots = await productCollection.get()
    let batch = db.batch()
    productSnapshots.docs.forEach((product) => {
        batch.delete(product.ref);
    })
    await batch.commit();
    console.log(`Deleted products from category ${categoryName}`)
}

