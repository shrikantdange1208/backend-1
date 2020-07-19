const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const { getAllBranches } = require('./branch')
const { getAllCategories } = require('./category')
const { getAllProducts } = require('./product')
const { getAllOperations } = require('./operation')
const { getAllUnits } = require('./unit')
const { getAllRoles } = require('./roles')
const { getInventory } = require('./inventory')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth');
const functions = require('firebase-functions')
const audit = require('./audit')
const express = require('express');
const { extend } = require('@hapi/joi');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all metadata from firestore
 * @returns Json object containing all metadata
 */
router.get("/", async (request, response, next) => { 
    
    var dashboardData = {}
    const branchId = request.user.branch
    if(request.user.role === constants.ADMIN || request.user.role === constants.SUPER_ADMIN) {
        console.log(`Retrieving Dashboard data for ${request.user.role.toUpperCase()}`)
        dashboardData = await getDashboardDataForAdminUser()
        response.status(200).json(dashboardData)
    } else if (request.user.role === constants.BRANCH) {
        console.log(`Retrieving Dashboard data for ${request.user.role.toUpperCase()} User`)
        dashboardData = await getDashboardDataForBranchUser(branchId)
    }  
})

async function getDashboardDataForAdminUser() {
    var dashboardData = {}
    const branchDocuments = await db.collection(constants.BRANCHES).listDocuments()
    const dashboardPromises = []
    for (const doc of branchDocuments) {
        const p1 = getDashboardDataForBranchUser(doc.id)
        dashboardPromises.push(p1)
    }
    var count = 1
    Promise.all(dashboardPromises)
        .then(branchDashboards => {
            branchDashboards.forEach(branchDashboard => {
                console.log(`COUNT ${count}`)
                count = count + 1
                const branchId = branchDashboard[constants.BRANCH]
                delete branchDashboard[constants.BRANCH]
                dashboardData[branchId] = branchDashboard 
            })
            return dashboardData
        })
}

async function getDashboardDataForBranchUser(branchId) {
    var dashboardData = {}
    dashboardData['branch'] = branchId
    
    const productsBelowThresholdPromise = getProductsUnderThreshold(branchId)
    const recentTransactionsPromise = getRecentTransactions(branchId)
    const pendingRequestsPromise = getPendingRequests(branchId)
    
    dashboardData['productsBelowThreshold'] = await productsBelowThresholdPromise
    dashboardData['recentActivity'] = await recentTransactionsPromise
    dashboardData['pendingRequests'] = await pendingRequestsPromise
    return dashboardData
}


async function getProductsUnderThreshold(branchId) {
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const products = await getInventory(branchRef, branchId, true)
    return products.inventory
}

async function getRecentTransactions(branchId) {
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    let transactionSnapshot = await branchRef
                        .collection(constants.TRANSACTIONS)
                        .orderBy(constants.DATE, 'desc')
                        .limit(10)
                        .get()

    const transactions = []
    transactionSnapshot.forEach(transaction => {
        var transactionData = transaction.data()
        transactionData[constants.DATE] = transactionData[constants.DATE].toDate()
        transactions.push(transactionData)
    })
    return transactions
}

async function getPendingRequests(branchId) {
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    let pendingRequestSnapshot = await branchRef
                        .collection(constants.PENDING_REQUESTS)
                        .orderBy(constants.DATE)
                        .get()

    const pendingRequests = []
    pendingRequestSnapshot.forEach(pendingRequest => {
        var pendingRequestData = pendingRequest.data()
        pendingRequestData[constants.DATE] = pendingRequestData[constants.DATE].toDate()
        pendingRequests.push(pendingRequestData)
    })
    return pendingRequests
}



module.exports = router;