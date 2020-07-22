const constants = require('../common/constants')
const { getInventory } = require('./inventory')
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all data for the dashboard from firestore
 * If the user is Admin or SuperAdmin return all dashboard data from all Branches
 * If the user is Branch Userreturn dashboard data from that specific branch
 * @returns Json object containing all metadata
 */
router.get("/", async (request, response, next) => {

    const userRole = request.user.role
    console.debug(`Retrieving Dashboard data for ${userRole.toUpperCase()} user`)
    if (userRole === constants.ADMIN || userRole === constants.SUPER_ADMIN) {

        //Get dashboard data for all branches
        const dashboardDataForAllBranches = {}
        const dashboardData = await getDashboardDataForAdminUser()
        dashboardData.forEach(dashboard => {
            const branchId = dashboard[constants.BRANCH]
            delete dashboard[constants.BRANCH]
            dashboardDataForAllBranches[branchId] = dashboard
        })
        console.debug('Retrieved dashboard data for all the branches')    
        response.status(200).json(dashboardDataForAllBranches)

    } else if (userRole === constants.BRANCH) {
        
        // Get dashboard data for branch 
        const branchId = request.user.branch
        console.log(`Retrieving Dashboard data for branch ${branchId}`)
        const dashboardData = await getDashboardDataForBranchUser(branchId)
        response.status(200).json(dashboardData)
    }
    
})

/**
 * @description Method to generate dashboard data for admin users
 * Internally calls getDashboardDataForBranchUser method for all branches
 */
async function getDashboardDataForAdminUser() {
    
    const branchDocuments = await db.collection(constants.BRANCHES).listDocuments()
    var dashboardPromises = []
    branchDocuments.map(branch => {
        const p1 = getDashboardDataForBranchUser(branch.id)
        dashboardPromises.push(p1)  
    })
    return Promise.all(dashboardPromises)
}

/**
 * @description Method to generate dashboard data for branch user
 * Gets the data for just the users branch
 * @param {*} branchId 
 */
async function getDashboardDataForBranchUser(branchId) {
    var dashboardData = {}
    dashboardData[constants.BRANCH] = branchId
    const branchRef = db.collection(constants.BRANCHES).doc(branchId);
    const productsBelowThresholdPromise = getProductsUnderThreshold(branchRef)
    const recentTransactionsPromise = getRecentTransactions(branchRef)
    const pendingRequestsPromise = getPendingRequests(branchRef)

    dashboardData[constants.PRODUCTS_BELOW_THRESHOLD] = await productsBelowThresholdPromise
    dashboardData[constants.RECENT_ACTIVITY] = await recentTransactionsPromise
    dashboardData[constants.PENDING_REQUESTS] = await pendingRequestsPromise
    return dashboardData
}

/**
 * Method to retrieve products under threshold for a given branch
 * @param {*} branchId 
 */
async function getProductsUnderThreshold(branchRef) {
    const products = await getInventory(branchRef, branchRef.id, true)
    return products.inventory
}

/**
 * Method to retrieve recent transactions for a given branch
 * @param {*} branchRef 
 */
async function getRecentTransactions(branchRef) {
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

/**
 * Method to retrieve pending requests for a given branch
 * @param {} branchRef 
 */
async function getPendingRequests(branchRef) {
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