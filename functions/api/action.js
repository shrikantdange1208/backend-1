const constants = require('../common/constants')
const validate = require('../common/validator')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();
const audit = require('./audit')

/**
 * Route to perform addProduct transaction
 * @returns 201 Created
 */
router.post('/addProduct', async (request, response, next) => {
    console.info('Adding product to inventory....');
    // Validate parameters
    console.debug('Validating params.')
    const { error } = validateParams(request.body, constants.ADD_PRODUCT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ADD_PRODUCT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()

    var transactionId = ""
    try {
        transactionId = await createTransaction(data)
    } catch (error) {
        next(error)
        return;
    }
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Route to perform issueProduct transaction
 * @returns 201 Created
 */
router.post('/issueProduct', async (request, response, next) => {
    console.info('Issuing product from the inventory....');
    // Validate parameters
    console.debug('Validating params.')
    const { error } = validateParams(request.body, constants.ISSUE_PRODUCT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ISSUE_PRODUCT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()

    var transactionId = ""
    try {
        transactionId = await createTransaction(data)
    } catch (error) {
        next(error)
        return;
    }
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Route to perform adjustment transaction
 * @returns 201 Created
 */
router.post('/adjustment', async (request, response, next) => {
    console.info('Adjusting product value in the inventory....');
    // Validate parameters
    console.debug('Validating params.')
    const { error } = validateParams(request.body, constants.ADJUSTMENT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(error)
        return;
    }

    const data = request.body
    data[constants.OPERATION] = constants.ADJUSTMENT
    data[constants.USER] = request.user.email
    data[constants.DATE] = new Date()


    var transactionId = ""
    try {
        transactionId = await createTransaction(data)
    } catch (error) {
        next(error)
        return;
    }
    response.status(201).json({ 'transactionId': transactionId })
});

/**
 * Route to request products from a branch
 * @returns 201 Created
 */
router.post('/requestProduct', async (req, res, next) => {
    console.info('Requesting product...');
    const { error } = validateParams(req.body, constants.REQUEST)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }
    const { toBranch, fromBranch, toBranchName, fromBranchName, product, productName, operationalQuantity, note } = req.body
    const toBranchRef = db.collection(constants.BRANCHES).doc(toBranch);
    const fromBranchRef = db.collection(constants.BRANCHES).doc(fromBranch);
    const docs = await db.getAll(toBranchRef, fromBranchRef)
    const toBranchDoc = docs[0]
    const fromBranchDoc = docs[1]

    if (!toBranchDoc.exists || !fromBranchDoc.exists) {
        const error = new Error('Branch does not exist. Can not request products')
        error.statusCode = 404
        next(error)
        return
    }
    const branchDocRef = await db.collection(constants.BRANCHES).doc(toBranch).collection(constants.TRANSFER_REQUESTS).add({
        product,
        productName,
        operationalQuantity,
        fromBranchName,
        fromBranch,
        operation: constants.TRANSFER_IN,
        note,
        date: new Date(),
        user: req.user.email,
        state: constants.PENDING
    })
    const id = branchDocRef.id
    await db.collection(constants.BRANCHES).doc(fromBranch).collection(constants.TRANSFER_REQUESTS).doc(id).set({
        product,
        productName,
        operationalQuantity,
        toBranchName,
        toBranch,
        note,
        operation: constants.TRANSFER_OUT,
        date: new Date(),
        user: req.user.email,
        state: constants.PENDING
    })
    console.info(`Created transfer request ${id} with state: PENDING`);
    res.status(201).send({ transferRequestsId: id })
})

/**
 * Route to accept the transfer of products to a branch
 * @returns 201 Created
 */
router.post('/transferProduct', async (req, res, next) => {
    console.info('Accepting and transfering product to requested branch...');
    const { error } = validateParams(req.body, constants.ACCEPT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }
    const { toBranch, fromBranch, toBranchName, fromBranchName, operationalQuantity, product, productName, transferRequestsId, note, user } = req.body

    //check if branches exist
    const toBranchRef = db.collection(constants.BRANCHES).doc(toBranch);
    const fromBranchRef = db.collection(constants.BRANCHES).doc(fromBranch);
    const docs = await db.getAll(toBranchRef, fromBranchRef)
    const toBranchDoc = docs[0]
    const fromBranchDoc = docs[1]

    if (!toBranchDoc.exists || !fromBranchDoc.exists) {
        const error = new Error('Branch does not exist. Can not transfer out products')
        error.statusCode = 404
        next(error)
        return
    }

    const toBranchTransferReqRef = toBranchRef.collection(constants.TRANSFER_REQUESTS).doc(transferRequestsId)
    const fromBranchTransferReqRef = fromBranchRef.collection(constants.TRANSFER_REQUESTS).doc(transferRequestsId)
    const transferReqDocs = await db.getAll(toBranchTransferReqRef, fromBranchTransferReqRef)
    const toBranchTransferReqDoc = transferReqDocs[0]
    const fromBranchTransferReqDoc = transferReqDocs[1]

    //create transferOut transaction
    const fromBranchData = {
        date: new Date(),
        branch: fromBranch, //needed branch to reuse createTransaction fn
        product,
        productName,
        operationalQuantity,
        toBranch,
        toBranchName,
        operation: constants.TRANSFER_OUT,
        note,
        transactionId: transferRequestsId,
        user: req.user.email //updating user to the one who accepts
    }
    fromBranchTransaction = createTransaction(fromBranchData)

    //create transferIn transaction
    const toBranchData = {
        date: new Date(),
        branch: toBranch,
        product,
        productName,
        operationalQuantity,
        fromBranch,
        fromBranchName,
        operation: constants.TRANSFER_IN,
        note,
        transactionId: transferRequestsId,
        user //updating user to the one who actually requested
    }
    toBranchTransaction = createTransaction(toBranchData)

    const fromBranchTransactionId = await fromBranchTransaction
    const toBranchTransactionId = await toBranchTransaction
    console.log(`Created transactions in ${toBranchName} and ${fromBranchName}`)

    if (toBranchTransferReqDoc.exists) {
        const toBranchData = {
            ...toBranchTransferReqDoc.data(),
            date: new Date(),
            state: constants.ACCEPTED
        }
        await toBranchTransferReqRef.set(toBranchData, {merge: true})
    }
    if (fromBranchTransferReqDoc.exists) {
        const fromBranchData = {
            ...fromBranchTransferReqDoc.data(),
            date: new Date(),
            state: constants.ACCEPTED
        }
        await fromBranchTransferReqRef.set(fromBranchData, {merge: true})
    }
    console.log('Updated transfer request state to ACCEPTED')
    res.status(201).send({ transactionId: transferRequestsId, toBranchTransactionId, fromBranchTransactionId })
})

/**
 * Route to move products from headoffice to a branch(without request)
 * @returns 201 Created
 */
router.post('/moveProduct', async (req, res, next) => {
    console.info('Moving products from headoffice to a branch...');
    const { error } = validateParams(req.body, constants.MOVE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }
    const { toBranch, fromBranch, toBranchName, fromBranchName, product, productName, operationalQuantity, note } = req.body

    //check if branches exist
    const toBranchRef = db.collection(constants.BRANCHES).doc(toBranch);
    const fromBranchRef = db.collection(constants.BRANCHES).doc(fromBranch);
    const docs = await db.getAll(toBranchRef, fromBranchRef)
    const toBranchDoc = docs[0]
    const fromBranchDoc = docs[1]

    if (!toBranchDoc.exists || !fromBranchDoc.exists) {
        const error = new Error('Branch does not exist. Can not transfer out products')
        error.statusCode = 404
        next(error)
        return
    }

    //create transferOut transaction
    const fromBranchData = {
        date: new Date(),
        branch: fromBranch,
        operationalQuantity,
        product,
        productName,
        note,
        toBranchName,
        user: req.user.email,
        operation: constants.TRANSFER_OUT
    }
    fromBranchTransaction = createTransaction(fromBranchData)

    //create transferIn transaction
    const toBranchData = {
        date: new Date(),
        branch: toBranch,
        operationalQuantity,
        product,
        productName,
        note,
        fromBranchName,
        user: req.user.email,
        operation: constants.TRANSFER_IN
    }
    toBranchTransaction = createTransaction(toBranchData)

    const fromBranchTransactionId = await fromBranchTransaction
    const toBranchTransactionId = await toBranchTransaction
    console.log(`Created transactions in ${toBranchName} and ${fromBranchName}`)

    res.status(201).send({ fromBranchTransactionId, toBranchTransactionId })
})

/**
 * Route to reject product by headoffice
 * @returns 200
 */
router.post('/rejectRequest', async (req, res, next) => {
    console.info('Rejecting request to transfer product...');
    const { error } = validateParams(req.body, constants.REJECT)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }
    const { toBranch, fromBranch, fromBranchName, productName, transferRequestsId } = req.body
    const toBranchRef = db.collection(constants.BRANCHES).doc(toBranch)
    const fromBranchRef = db.collection(constants.BRANCHES).doc(fromBranch)
    //check if pending requests exist
    const toBranchTransferReqRef = toBranchRef.collection(constants.TRANSFER_REQUESTS).doc(transferRequestsId)
    const fromBranchTransferReqRef = fromBranchRef.collection(constants.TRANSFER_REQUESTS).doc(transferRequestsId)
    const transferReqDocs = await db.getAll(toBranchTransferReqRef, fromBranchTransferReqRef)
    const toBranchTransferReqDoc = transferReqDocs[0]
    const fromBranchTransferReqDoc = transferReqDocs[1]
    if (!toBranchTransferReqDoc.exists || !fromBranchTransferReqDoc.exists) {
        const error = new Error('No transfer requests to reject')
        error.statusCode = 404
        next(error)
        return
    }
    const toBranchData = {
        ...toBranchTransferReqDoc.data(),
        date: new Date(),
        state: constants.REJECTED
    }
    const fromBranchData = {
        ...fromBranchTransferReqDoc.data(),
        date: new Date(),
        state: constants.REJECTED
    } 
    //update state in transferRequests collection
    await toBranchTransferReqRef.set(toBranchData, {merge: true})
    await fromBranchTransferReqRef.set(fromBranchData, {merge: true})
    console.log('Updated transfer request state to REJECTED')
    // Fire and forget audit log
    const eventMessage = `User ${req.user.name} rejected request from ${fromBranchName} for ${productName}`
    audit.logEvent(eventMessage, req)

    res.status(200).send({ message: 'Rejected successfully' })
})

function validateParams(body, type) {
    let schema
    switch (type) {
        case constants.ADD_PRODUCT:
        case constants.ISSUE_PRODUCT:
        case constants.ADJUSTMENT:
            schema = joi.object({
                branch: joi.string().min(1).max(30).required(),
                product: joi.string().min(1).max(30).required(),
                productName: joi.string().min(1).max(30).required(),
                operationalQuantity: joi.number().integer().strict().required(),
                note: joi.string()
            })
            break
        case constants.REQUEST:
        case constants.MOVE:
            schema = joi.object({
                toBranch: joi.string().alphanum().length(20).required(),
                fromBranch: joi.string().alphanum().length(20).required(),
                fromBranchName: joi.string().min(1).max(30).required(),
                toBranchName: joi.string().min(1).max(30).required(),
                product: joi.string().alphanum().length(20).required(),
                productName: joi.string().min(1).max(30).required(),
                operationalQuantity: joi.number().integer().strict().required(),
                note: joi.string()
            })
            break
        case constants.ACCEPT:
            schema = joi.object({
                toBranch: joi.string().alphanum().length(20).required(),
                fromBranch: joi.string().alphanum().length(20).required(),
                fromBranchName: joi.string().min(1).max(30).required(),
                toBranchName: joi.string().min(1).max(30).required(),
                product: joi.string().alphanum().length(20).required(),
                productName: joi.string().min(1).max(30).required(),
                operationalQuantity: joi.number().integer().strict().required(),
                note: joi.string(),
                transferRequestsId: joi.string().alphanum().length(20).required(),
                user: joi.string().email({ minDomainSegments: 2 }).required()
            })
            break
        case constants.REJECT:
            schema = joi.object({
                toBranch: joi.string().alphanum().length(20).required(),
                fromBranch: joi.string().alphanum().length(20).required(),
                fromBranchName: joi.string().min(1).max(30).required(),
                toBranchName: joi.string().min(1).max(30).required(),
                product: joi.string().alphanum().length(20).required(),
                productName: joi.string().min(1).max(30).required(),
                transferRequestsId: joi.string().alphanum().length(20).required(),
            })
            break
    }
    return validate(schema, body)

}

module.exports = router;

/**
 * Method to create a new transaction
 * @param {data for the transaction} data
 */
const createTransaction = async function (data) {
    const branchId = data[constants.BRANCH]
    delete data[constants.BRANCH]
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const branchSnapshot = await branchRef.get()
    if (!branchSnapshot.exists) {
        const error = new Error(`Requested branch is not present. Transaction will not go through.`)
        error.statusCode = 404
        next(error)
        return;
    }

    // Get the last transaction for the product to get the intialQuantity for current transaction
    const transactionRef = branchRef.collection(constants.TRANSACTIONS)
    try {
        const lastTransaction = await transactionRef
            .where(constants.PRODUCT, '==', data[constants.PRODUCT])
            .orderBy(constants.DATE, 'desc')
            .limit(1)
            .get();

        let initialQuantity = 0
        lastTransaction.forEach((transaction) => {
            initialQuantity = transaction.data()[constants.CLOSING_QUANTITY]
        })
        data[constants.INITIAL_QUANTITY] = initialQuantity
        data[constants.CLOSING_QUANTITY] = getClosingQuantity(data[constants.OPERATION], initialQuantity,
            data[constants.OPERATIONAL_QUANTITY])
        const resultTransaction = await transactionRef.add(data)
        return resultTransaction.id
    } catch (error) {
        throw error
    }
}

/**
 * Method to calculate closing quantity for the current transaction
 * @param {} operation
 * @param {*} initialQuantity
 * @param {*} operationalQuantity
 */
function getClosingQuantity(operation, initialQuantity, operationalQuantity) {
    switch (operation) {
        case constants.ADD_PRODUCT:
        case constants.TRANSFER_IN:
            return initialQuantity + operationalQuantity
        case constants.ISSUE_PRODUCT:
        case constants.TRANSFER_OUT:
            if (operationalQuantity > initialQuantity) {
                const error = new Error(`Requested quantity ${operationalQuantity} is greater than the available quantity ${initialQuantity}`)
                error.statusCode = 400
                console.error(error)
                throw error
            }
            return initialQuantity - operationalQuantity
        case constants.ADJUSTMENT:
            if (operationalQuantity < 0) {
                const error = new Error(`Quantity cannot be set to negative value: ${operationalQuantity}`)
                error.statusCode = 400
                console.error(error)
                throw error
            }
            return operationalQuantity
    }
}
