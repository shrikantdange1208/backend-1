const constants = require('../config/constants')
const validate = require('../validation/validation')
const logger = require('../middleware/logger');
const config = require('config');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const cors = require('cors');
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
    let categoryCollection = db.collection(constants.CATEGORY);
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryInfo = {}
        var categoryData = category.data()
        categoryInfo[constants.CATEGORY] = category.id,
        categoryInfo[constants.DESCRIPTION] = categoryData.description,
        categoryInfo[constants.IS_ACTIVE] = categoryData.isActive,
        categoryInfo[constants.CREATED_DATE] = categoryData.createdDate.toDate(),
        categoryInfo[constants.LAST_UPDATED_DATE] = categoryData.lastUpdatedDate.toDate()
        categories.categories.push(categoryInfo);
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    logger.debug('Returning categories to client.');
    response.status(200).send(categories);
});

/**
 * @description Route to retrieve single category data from firestore
 * @returns Json object containing requested category
 * @throws 400 if the product does not exists in firestore
 */
router.get('/:category', async (request, response, next) => {
    var  requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving category ${requestedCategory} from firestore`)
    var categoryInfo = {}
    const doc = db.collection(constants.CATEGORY).doc(requestedCategory);
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category ${requestedCategory} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()
    categoryInfo[constants.CATEGORY] = category.id
    categoryInfo[constants.DESCRIPTION] = categoryData.description
    categoryInfo[constants.IS_ACTIVE] = categoryData.isActive
    categoryInfo[constants.CREATED_DATE] = categoryData.createdDate.toDate()
    categoryInfo[constants.LAST_UPDATED_DATE] = categoryData.lastUpdatedDate.toDate()
    logger.debug(`Returning details for category ${requestedCategory} to client.`);
    response.status(200).send(categoryInfo);
});

/**
 * @description Route to retrieve all products from a given category
 * @returns Json object containing array of products for a given category
 */
router.get('/products/:category', async (request, response, next) => {
    var  requestedCategory = request.params.category.toLocaleLowerCase()
    logger.info(`Retrieving products for category ${requestedCategory}`)
    var categoryProducts = []
    const doc = db.collection(constants.CATEGORY).doc(requestedCategory);
    const category = await doc.get()
    if (!category.exists) {
        const error = new Error(`Requested category ${requestedCategory} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var categoryData = category.data()    
    categoryProducts = categoryData.products;
    logger.debug(`Returning products from category ${requestedCategory} to client.`);
    response.status(200).send(categoryProducts);    
});

/**
 * @description Route to retireve all active/inactive categories from firestore
 * @returns Json object containing all categories
 */
router.get("/:active/categories", async (request, response) => {
    logger.info("Retrieving all active/inactive categories from firestore");
    var status = JSON.parse(request.params.active.toLocaleLowerCase());
    const categories = {
        "categories": []
    }
    let categoryCollection = db.collection(constants.CATEGORY)
        .where(constants.IS_ACTIVE, '==', status)
    let snapshot = await categoryCollection.get()
    snapshot.forEach(category => {
        var categoryInfo = {}
        var categoryData = category.data()
        categoryInfo[constants.CATEGORY] = category.id,
        categoryInfo[constants.DESCRIPTION] = categoryData.description,
        categoryInfo[constants.IS_ACTIVE] = categoryData.isActive,
        categoryInfo[constants.CREATED_DATE] = categoryData.createdDate.toDate(),
        categoryInfo[constants.LAST_UPDATED_DATE] = categoryData.lastUpdatedDate.toDate()
        categories.categories.push(categoryInfo);
    })
    categories[constants.TOTAL_CATEGORIES] = snapshot.size;
    logger.debug('Returning categories to client.');
    response.status(200).send(categories);
});

/**
 * @description Route to add categories in Firestore
 * @returns Created category
 * @throws 400 if category already exists or if required params are missing
 */
router.post('/', async (request, response, next) => {
    logger.info(`Creating category in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CATEGORY)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category already exists, return 400
    var categoryName = request.body.category.toLocaleLowerCase()
    logger.info(`Creating category ${categoryName} in firestore....`);
    const doc = db.collection(constants.CATEGORY).doc(categoryName);
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
    await db.collection(constants.CATEGORY).doc(categoryName).set(data)
    logger.debug(`${categoryName} document Created`)
    var result = {}
    result[constants.CATEGORY] = categoryName
    result[constants.DESCRIPTION] = data.description
    response.status(200).send(result);    
});

/**
 * @description Route to update description of category
 * @returns  updated category
 * @throws 400 if category does not exist or has wrong params
 */
router.put('/desc', async (request, response, next) => {
    logger.info(`Updating description for category in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.DESCRIPTION)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category does not exists, return 400
    var categoryName = request.body.category
    logger.info(`Updating description for category ${categoryName} in firestore....`);
    const categoryRef = db.collection(constants.CATEGORY).doc(categoryName);
    const category = await categoryRef.get()
    if (!category.exists) {
        const err = new Error(`Requested category ${categoryName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.DESCRIPTION] = request.body.description
    data[constants.LAST_UPDATED_DATE] = new Date()
    await categoryRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.CATEGORY] = categoryName
    data = JSON.parse(JSON.stringify( data, [constants.CATEGORY,constants.DESCRIPTION]));
    logger.debug(`Updated description of category ${categoryName} to ${request.body.description}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to update status of category
 * @returns  updated category
 * @throws 400 if category does not exist or has wrong params
 */
router.put('/status', async (request, response, next) => {
    logger.info(`Updating status for category in firestore....`);
    
    // Validate parameters
    const { error } = validateParams(request.body, constants.STATUS)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If category does not exists, return 400
    var categoryName = request.body.category.toLocaleLowerCase()
    logger.info(`Updating description for category ${categoryName} in firestore....`);
    const categoryRef = db.collection(constants.CATEGORY).doc(categoryName);
    const category = await categoryRef.get()
    if (!category.exists) {
        const err = new Error(`Requested category ${categoryName} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    let data = {}
    data[constants.IS_ACTIVE] = request.body.isActive
    data[constants.LAST_UPDATED_DATE] = new Date()
    await categoryRef.update(data)
    delete data[constants.LAST_UPDATED_DATE]
    data[constants.CATEGORY] = categoryName
    data = JSON.parse(JSON.stringify( data, [constants.CATEGORY,constants.IS_ACTIVE]));
    logger.debug(`Updated status of category ${categoryName} to ${request.body.isActive}`)
    response
        .status(200)
        .send(data);
})

/**
 * @description Route to delete categories
 * @returns  deleted category
 * @throws 400 if category does not exist
 */
router.delete('/:category', async(request, response, next) => {
    var  categoryName = request.params.category.toLocaleLowerCase()
    logger.info(`Deleting category ${categoryName} from firestore`)
    
    const categoryRef = db.collection(constants.CATEGORY).doc(categoryName);
    const category = await categoryRef.get()
    if (!category.exists) {
        const error = new Error(`Category ${categoryName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    let data = {}
    data[constants.CATEGORY] = categoryName
    data[constants.DESCRIPTION] = category.data().description
    
    await categoryRef.delete()
    logger.debug(`Deleted category ${categoryName}`)
    response
        .status(200)
        .send(data);
})

// exports = exports.addProductToCategory =  
//     functions.firestore
// //.document(`constants.PRODUCT/{product}`)
// .document('/product/{productName}')
// .onCreate(async (snapshot, context) => {
//     console.log("New Product Created!!!!!!!")
// });



 /**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  *         category for create category
  *         description for updating description
  *         status for updating status
  */
function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.CATEGORY:
        case constants.DESCRIPTION:
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
        case  constants.STATUS:
            schema = joi.object({
                category: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
    }
    console.log(schema)
    return validate(schema, body)
}

module.exports = router;

/**
 * Firebase trigger function
 * This function is invoked whenever a new product is added.
 * New product is also added in category collection
 */
// module.exports.addProductToCategory = functions.firestore
//     .document(`/${constants.PRODUCT}/{productName}`)
//     .onCreate(async (snapshot, context) => {
//         var newProduct = snapshot.data();
//         var name = snapshot.id
//         var category = newProduct.category;

//         const categoryRef = db.doc(`${constants.CATEGORY}/${category}`);
//         const categorySnapshot = await categoryRef.get()
        
//         // Check if category is present in the collection
//         if(!categorySnapshot.exists) {
//             console.log(`Category ${category} is not present in firestore!!!!`)
//             return;
//         }
//         const products = categorySnapshot.data().products;
//         products.push(name);
//         await categoryRef.update({'products': products})
//         logger.debug(`Product ${newProduct} has been added to category ${category}`)
//     });

//     module.exports.updateProductCategory = functions.firestore
//     .document(`/${constants.PRODUCT}/{productName}`)
//     .onUpdate(async (change, context) => {
//         logger.debug(`Product ${change.before.id} has been updated. `)
//         const before =  change.before.data()
//         const after =  change.after.data()

//         if(before.category != after.category) {
//             productCategoryChanged(change, context)
//         }

//         if(before.isActive != after.isActive) {
//             productStatusChanged(change, context)
//         }
//     });

// async function productCategoryChanged(before, context) {
//     console.log(`Previous category : ${constants.CATEGORY}/${before.before.data()[constants.CATEGORY]}`)
//     const prevCategoryRef = db.doc(`${constants.CATEGORY}/${before.before.data()[constants.CATEGORY]}`);
//     const categorySnapshot = await prevCategoryRef.get()
//     const prevCategoryProducts = categorySnapshot.data()[constants.PRODUCTS];
//     console.log(prevCategoryProducts)
//     const index = prevCategoryProducts.indexOf(before.before.id)
//     if(index > -1) {
//         prevCategoryProducts.splice(index, 1)
//     }
//     console.log(prevCategoryProducts)
//     await prevCategoryRef.update({'products': prevCategoryProducts})

//     console.log(`New category : ${constants.CATEGORY}/${before.after.data()[constants.CATEGORY]}`)
//     const newCategoryRef = db.doc(`${constants.CATEGORY}/${before.after.data()[constants.CATEGORY]}`);
//     const newCategorySnapshot = await newCategoryRef.get()
//     const newCategoryProducts = newCategorySnapshot.data()[constants.PRODUCTS];
//     newCategoryProducts.push(before.before.id);
//     await newCategoryRef.update({'products': newCategoryProducts})
// }

// async function productStatusChanged(change, context) {

// }

