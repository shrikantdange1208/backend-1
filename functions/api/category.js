const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth')
const audit = require('./audit')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const functions = require('firebase-functions')
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all categories from firestore
 * @returns Json object containing all categories
 */
router.get("/", async (request, response) => {
    console.info("Retrieving all categories from firestore");
    const categories = await getAllCategories()
    console.debug('Returning categories to client.');
    response.status(200).send(categories);
});

/**
 * Utility method to retrieve all categories from firestore
 */
const getAllCategories = async function() {
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES);
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.NAME] = utils.capitalize(categoryData[constants.NAME])
        categoryData[constants.ID] = category.id
        categoryData = utils.formatDate(categoryData)
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData);
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size; 
    return categories
}

/**
 * @description Route to retrieve single category data from firestore
 * @returns Json object containing requested category
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var categoryId = request.params.id
    console.info(`Retrieving category from firestore`)
    const doc = db.collection(constants.CATEGORIES).doc(categoryId);
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()
    categoryData[constants.ID] = category.id
    categoryData[constants.NAME] = utils.capitalize(categoryData[constants.NAME])
    categoryData = utils.formatDate(categoryData)
    delete categoryData[constants.PRODUCTS]
    console.debug(`Returning details for category ${categoryData[constants.NAME]} to client.`);
    response.status(200).send(categoryData);
});

/**
 * @description Route to retrieve all products from a given category
 * @returns Json object containing array of products for a given category
 */
router.get('/products/:id', async (request, response, next) => {
    var categoryId = request.params.id
    console.info(`Retrieving products for given category`)
    const doc = db.collection(constants.CATEGORIES).doc(categoryId)
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()
    console.debug(`Returning products from category ${categoryData[constants.NAME]} to client.`);
    response.status(200).send(categoryData[constants.PRODUCTS]);
});

/**
 * @description Route to retrieve all active categories from firestore
 * @returns Json object containing all categories
 */
router.get("/all/active", async (request, response) => {
    console.info("Retrieving all active categories from firestore");
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES)
        .where(constants.IS_ACTIVE, '==', true)
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.ID] = category.id
        categoryData[constants.NAME] = utils.capitalize(categoryData[constants.NAME])
        categoryData = utils.formatDate(categoryData)
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData)
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    console.debug('Returning categories to client.');
    response.status(200).send(categories)
});

/**
 * @description Route to retrieve all inactive categories from firestore
 * @returns Json object containing all categories
 */
router.get("/all/inactive", async (request, response) => {
    console.info("Retrieving all inactive categories from firestore");
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORIES)
        .where(constants.IS_ACTIVE, '==', false)
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryData = category.data()
        categoryData[constants.ID] = category.id
        categoryData[constants.NAME] = utils.capitalize(categoryData[constants.NAME])
        categoryData = utils.formatDate(categoryData)
        delete categoryData[constants.PRODUCTS]
        categories.categories.push(categoryData)
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    console.debug('Returning categories to client.');
    response.status(200).send(categories)
});

/**
 * @description Route to add categories in Firestore
 * @returns 201 - Created
 * @throws 400 if category already exists or 404 if required params are missing
 */
router.post('/', isAdminOrSuperAdmin, async (request, response, next) => {
    console.info(`Creating category in firestore....`);
    // Validate parameters
    console.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category already exists, return 400
    var categoryName = request.body.name.toLocaleLowerCase()
    console.info(`Creating category ${categoryName} in firestore....`);
    const categorySnapshot = await db.collection(constants.CATEGORIES)
                            .where(constants.NAME, '==', categoryName)
                            .get()
    if (categorySnapshot.size > 0) {
        const err = new Error(`The category ${categoryName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }

    let data = request.body
    data[constants.NAME] = categoryName
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    data[constants.PRODUCTS] = []
    const categoryRef = await db.collection(constants.CATEGORIES).add(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.name} added new category ${categoryName}`
    audit.logEvent(eventMessage, request)

    console.debug(`Created category ${categoryName}`)
    response.status(201).json({'id': categoryRef.id, ...data})
});

/**
 * @description Route to update category
 * @returns 204, No Content
 * @throws 404/400 if category does not exist or has wrong params resp.
 */
router.put('/', isAdminOrSuperAdmin, async (request, response, next) => {
    console.debug(`Updating category in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category does not exists, return 404
    var categoryId = request.body.id
    console.info(`Updating category in firestore....`);
    const categoryRef = db.collection(constants.CATEGORIES).doc(categoryId);
    const category = await categoryRef.get()
    if (!category.exists) {
        const err = new Error(`Requested category is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    const oldData = category.data()
    let newData = request.body
    delete newData[constants.ID]
    newData[constants.NAME] = newData[constants.NAME].toLocaleLowerCase()
    newData[constants.LAST_UPDATED_DATE] = new Date()
    delete newData[constants.CREATED_DATE]
    await categoryRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]
    
    // Add event in Audit
    const eventMessage = `User ${request.user.name} updated category ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, request, oldData, newData)

    console.debug(`Updated category ${oldData[constants.NAME]}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete categories
 * @returns  deleted category
 * @throws 400 if category does not exist
 */
router.delete('/:id', isSuperAdmin, async (request, response, next) => {
    var categoryId = request.params.id
    console.info(`Deleting category with ID ${categoryId} from firestore`)

    const categoryRef = db.collection(constants.CATEGORIES).doc(categoryId);
    const category = await categoryRef.get()
    if (!category.exists) {
        const error = new Error(`Category with ID ${categoryId} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const categoryData = category.data()
    await categoryRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.name} deleted category ${categoryData[constants.NAME]}`
    audit.logEvent(eventMessage, request)

    console.debug(`Deleted category ${categoryData[constants.NAME]}`)
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
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
        case constants.UPDATE:
            schema = joi.object({
                id: joi.string()
                    .required(),
                name: joi.string()
                    .min(1)
                    .max(30),
                description: joi.string()
                    .min(1)
                    .max(50),
                isActive: joi.bool(),
                products: joi.array()
                    .items(joi.string().allow('')),
                lastUpdatedDate: joi.date(),
                createdDate: joi.date()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;
module.exports.getAllCategories = getAllCategories

module.exports.addOrUpdateCategory = functions.firestore
    .document(`/${constants.CATEGORIES}/{categoryName}`)
    .onWrite(async (change, context) => {
        const categoryName = context.params.categoryName
        if (!change.before._fieldsProto) {
            console.debug(`New category ${change.after.id} has been created`)
        } else if (!change.after._fieldsProto) {
            var data = change.before.data()
            console.debug(`Category ${data[constants.NAME]} has been deleted`)
            deleteAllProductsFromCategory(change.before)
        } else {
            console.debug(`Category ${change.before.id} has been updated`)
            var oldData = change.before.data()
            var newData = change.after.data()
            if(oldData.isActive !== newData.isActive) {
                console.debug(`Status of category ${categoryName} changed from ${oldData.isActive} to ${newData.isActive}`)
                changeStatusOfAllProducts(change.after)
            } else {
                return
            }
        }
    });

async function changeStatusOfAllProducts(updatedCategory) {
    var categoryId = updatedCategory.id
    var categoryData = updatedCategory.data()
    var status = categoryData[constants.IS_ACTIVE];
    console.log(`Updating status of all products in category ${categoryData[constants.NAME]} to ${status}`)
    const productCollection = db.collection(constants.PRODUCTS)
        .where(constants.CATEGORY, '==', categoryId)
    const productSnapshot = await productCollection.get()
    let batch = db.batch()
    productSnapshot.docs.forEach((product) => {
        console.log(`Retrieving product ref for ${product.id}`)
        batch.update(product.ref, {'isActive': status})
    })
    await batch.commit();
    console.log(`Updated status of all products in category ${categoryData[constants.NAME]}`)
}

async function deleteAllProductsFromCategory(deletedCategory) {
    var categoryId = deletedCategory.id
    const productCollection = db.collection(constants.PRODUCTS)
        .where(constants.CATEGORY, '==', categoryId)
    const productSnapshots = await productCollection.get()
    let batch = db.batch()
    productSnapshots.docs.forEach((product) => {
        batch.delete(product.ref);
    })
    await batch.commit();
    console.log(`Deleted products from category ${deletedCategory.data()[constants.NAME]}`)
}

