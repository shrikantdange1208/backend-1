const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const formatDate = require('../common/dateFormatter')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const { isAdmin } = require('../middleware/auth');
const audit = require('./audit')
const firebase = require('firebase/functions');
const functions = require('firebase-functions');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

router.post('/addProduct', isAdmin, async(request, response, next) => {
    logger.info(`Adding product to inventory....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.ADD_PRODUCT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const { branch, product, operationalQuantity } = request.body
    const branchRef = db.collection(constants.BRANCHES).doc(branch);
    const branchSnapshot = await branchRef.get()
    if (!branchSnapshot.exists) {
        const error = new Error(`Branch ${branch} is not present. Transaction will not go through.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const transactionRef = db.collection(constants.BRANCHES).doc(branch).collection('transactions')
    const lastTransaction = await transactionRef
                                .where(constants.PRODUCT, '==', product)
                                .orderBy('date', 'desc')
                                .limit(1)
                                .get();
    
    let initialQuantity = 0
    lastTransaction.forEach((transaction) => {
        initialQuantity = transaction.data()[constants.CLOSING_QUANTITY]
    })
    let closingQuantity = initialQuantity + operationalQuantity
    const data = {}
     data[constants.INITIAL_QUANTITY] = initialQuantity
     data[constants.OPERATIONAL_QUANTITY] = operationalQuantity
     data[constants.CLOSING_QUANTITY] = closingQuantity
     data[constants.PRODUCT] = product
     data[constants.USER] = request.user.email
     data[constants.DATE] = new Date()
     await transactionRef.add(data)
    const branchInventory = branchSnapshot.data()[constants.INVENTORY]
    
    let availableQuantity = 0
    if(branchInventory.hasOwnProperty(product)) {
        initialQuantity = branchInventory[product][constants.AVAILABLE_QUANTITY]   
    }
    availableQuantity = initialQuantity + operationalQuantity
    
    
    
    const transactions = await db.collection(constants.BRANCHES).doc(branch).collection('transactions').get()
    console.log(transactions.size)
    response.status(201).json({"message": "Added transaction"})
});

module.exports = router;

/**
 * Validates the request body.
 * @param {*} body request body
 * @param {*} type identifier to determine which request is to be validated
 */
function validateParams(body, type) {
    let schema;
    switch (type) {
        case constants.ADD_PRODUCT:
            schema = joi.object({
                branch: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                product: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                operationalQuantity: joi.number()
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
