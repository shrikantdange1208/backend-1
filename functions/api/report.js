const constants = require('../common/constants');
const { getInventory } = require('./inventory')
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth')
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const url = require('url');
const utils = require('../common/utils');
const db = admin.firestore();

/**
 * @description Route to generate report for all products for a given branch
 * @returns Json object containing report for all products for a given branch
 */
router.get("/:branchId", isAdminOrSuperAdmin, async (request, response, next) => {
    var branchId = request.params.branchId
    var { fromDate, toDate } = request.query;

    //  Return error if fromDate is not supplied
    if (!fromDate) {
        const error = new Error(`fromDate query param is required.`)
        error.statusCode = 400
        next(error)
        return;
    }
    fromDate = new Date(fromDate)

    // If toDate is not passed, set it to current date
    if (!toDate) {
        toDate = new Date()
    } else {
        toDate = new Date(toDate)
    }

    // Check if branch is valid
    console.info(`Generating report for branch ${branchId} for period ${fromDate} to ${toDate}`)
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branch = await branchRef.get()
    if (!branch.exists) {
        const error = new Error(`Requested branch is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }

    // Add branch info to the report
    const branchReport = addBranchData(branch, fromDate, toDate)

    // Get Previous and Next Dates for calculation
    fromDate = utils.prevDate(fromDate)
    toDate = utils.nextDate(toDate)

    // Get current inventory for the given branch
    const branchInventory = await getInventory(branchRef, branchId, false)
    const inventoryProducts = branchInventory[constants.INVENTORY]

    // Calculate report for each product in inventory
    var totalProducts = 0
    const promises = []
    for (const product of inventoryProducts) {
        const productPromise = getReportForProduct(branchRef, product, fromDate, toDate)
        promises.push(productPromise)
    }

    // Wait for completing all promises
    Promise.all(promises)
        .then(reports => {
            reports.forEach(productReport => {
                if (hasTransactionRecordBeforeToDate(productReport)) {
                    branchReport[constants.REPORT].push(productReport)
                    totalProducts = totalProducts + 1
                }
            })
            branchReport[constants.TOTAL_PRODUCTS] = totalProducts
            response.status(200).json(branchReport)
        })
})

/**
 * Method to check if product had a transaction before toDate
 * @param {*} productReport 
 */
function hasTransactionRecordBeforeToDate(productReport) {
    if(productReport[constants.INITIAL_QUANTITY] === 0 
        && productReport[constants.CLOSING_QUANTITY] === 0) {
            return false
        }
    return true
}

/**
 * Utility method to add branch data
 * @param {*} branch 
 * @param {*} fromDate 
 * @param {*} toDate 
 */
function addBranchData(branch, fromDate, toDate) {
    const branchReport = {}
    branchReport[constants.BRANCH] = branch.id
    branchReport[constants.NAME] = branch.data()[constants.NAME]
    branchReport[constants.FROM_DATE] = fromDate
    branchReport[constants.TO_DATE] = toDate
    branchReport[constants.REPORT] = []
    return branchReport
}

/**
 * Method to generate report for a given product for a particular branch
 * @param {*} branchDocument 
 * @param {*} product 
 * @param {*} fromDate fromDate - 1 //toInclude fromDate transactions 
 * @param {*} toDate toDate + 1 //toInclude toDate transactions 
 */
async function getReportForProduct(branchDocument, product, fromDate, toDate) {

    let productTransactionRef = await branchDocument
        .collection(constants.TRANSACTIONS)
        .where(constants.PRODUCT, '==', product[constants.PRODUCT])
        .where(constants.DATE, '>', fromDate)
        .where(constants.DATE, '<', toDate)
        .orderBy(constants.DATE)
        .get()

    delete product[constants.IS_BELOW_THRESHOLD]
    delete product[constants.AVAILABLE_QUANTITY]
    
    if (productTransactionRef.size > 0) {
        console.debug(`Transactions found between date range ${fromDate} and ${toDate} for product ${product[constants.PRODUCT]}`)
        getReportForProductFromTransactions(product, productTransactionRef)
    } else {
        // Transactions not found in th given date range. Use the last transaction to generate the report
        console.debug(`Transactions not found between date range ${fromDate} and ${toDate} for product ${product[constants.PRODUCT]}`)
        const lastTransaction = await branchDocument
            .collection(constants.TRANSACTIONS)
            .where(constants.PRODUCT, '==', product.product)
            .where(constants.DATE, '<=', fromDate)
            .orderBy(constants.DATE, 'desc')
            .limit(1)
            .get();
         getReportForProductFromPreviousTransactions(product, lastTransaction)
    }
    return product
}

/**
 * Utility function to get report for a product from list of transactions
 * @param {*} product 
 * @param {*} productTransactionRef 
 */
function getReportForProductFromTransactions(product, productTransactionRef) {
    const productTransactions = productTransactionRef.docs
    const firstTransactionData = getFirstTransactionData(productTransactions)
    const lastTransactionData = getLastTransactionData(productTransactions)
    product[constants.INITIAL_QUANTITY] = firstTransactionData[constants.INITIAL_QUANTITY]
    calculateQuantities(product, productTransactions)
    product[constants.CLOSING_QUANTITY] = lastTransactionData[constants.CLOSING_QUANTITY]
}

/**
 * Utility function to get report for a product from last found transaction
 * @param {*} product 
 * @param {*} lastTransaction 
 */
function getReportForProductFromPreviousTransactions(product, lastTransaction) {
    product[constants.INITIAL_QUANTITY] = 0
    product[constants.ADDED_QUANTITY] = 0
    product[constants.CONSUMED_QUANTITY] = 0
    product[constants.TRANSFERRED_QUANTITY] = 0
    product[constants.CLOSING_QUANTITY] = 0

    lastTransaction.forEach((transaction) => {
        product[constants.INITIAL_QUANTITY] = transaction.data()[constants.CLOSING_QUANTITY]
        product[constants.CLOSING_QUANTITY] = transaction.data()[constants.CLOSING_QUANTITY]
    })
}
/**
 * Utility method to get first transaction. It gives us the initial quantity for the report
 * @param {*} productTransactions 
 */
function getFirstTransactionData(productTransactions) {
    const firstTransaction = productTransactions[0]
    const firstTransactionData = firstTransaction.data()
    firstTransactionData[constants.DATE] = firstTransactionData[constants.DATE].toDate()
    return firstTransactionData
}

/**
 * Utility method to get last transaction. It gives us the closing quantity for the report
 * @param {*} productTransactions 
 */
function getLastTransactionData(productTransactions) {
    const totalTransactions = productTransactions.length
    const lastTransaction = productTransactions[totalTransactions - 1]
    const lastTransactionData = lastTransaction.data()
    lastTransactionData[constants.DATE] = lastTransactionData[constants.DATE].toDate()
    return lastTransactionData
}

/**
 * Utility method to calculate quantities using operation type.
 * @param {*} productData 
 * @param {*} productTransactions 
 */
function calculateQuantities(productData, productTransactions) {
    var addedQuantity = 0
    var consumedQuantity = 0
    var transferredQuantity = 0
    for (const transaction of productTransactions) {
        const transactionData = transaction.data()
        transactionData[constants.DATE] = transactionData[constants.DATE].toDate()
        switch (transactionData[constants.OPERATION]) {

            case constants.ADD_PRODUCT:
            case constants.TRANSFER_IN:
                addedQuantity = addedQuantity + transactionData[constants.OPERATIONAL_QUANTITY]
                break
            case constants.ISSUE_PRODUCT:
                consumedQuantity = consumedQuantity + transactionData[constants.OPERATIONAL_QUANTITY]
                break
            case constants.TRANSFER_OUT:
                transferredQuantity = transferredQuantity + transactionData[constants.OPERATIONAL_QUANTITY]
                break
            case constants.ADJUSTMENT:
                if (transactionData[constants.CLOSING_QUANTITY] > transactionData[constants.INITIAL_QUANTITY]) {
                    addedQuantity = addedQuantity +
                        (transactionData[constants.CLOSING_QUANTITY] - transactionData[constants.INITIAL_QUANTITY])
                } else {
                    consumedQuantity = consumedQuantity +
                        (transactionData[constants.INITIAL_QUANTITY] - transactionData[constants.CLOSING_QUANTITY])
                }
                break
        }
    }
    productData[constants.ADDED_QUANTITY] = addedQuantity
    productData[constants.CONSUMED_QUANTITY] = consumedQuantity
    productData[constants.TRANSFERRED_QUANTITY] = transferredQuantity
}

module.exports = router;
