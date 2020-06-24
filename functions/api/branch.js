const constants = require('../config/constants')
const validate = require('../validation/validator')
const logger = require('../middleware/logger');
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
 * @description Route to retireve all products from firestore
 * @returns Json object containing all products
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving all products from firestore");
    const products = {
        "products": []
    
    }
    let transactionCol = await db.collection('branch').doc('sarjapur').collection('transactions').listDocuments();
    transactionCol.forEach(transaction => {
        console.log(transaction)
    })
    
    let transactionCollection = db.collection('branch').doc('sarjapur').collection('transactions');
    let snapshot = await transactionCollection.get()
    snapshot.forEach(transaction => {
        console.log(transaction.data())
    })
    products[constants.TOTAL_PRODUCTS] = snapshot.size;
    logger.debug('Returning product list to client.');
    response.status(200).send("products");
});

module.exports = router;