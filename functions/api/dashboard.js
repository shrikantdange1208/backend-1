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
    const branchId = request.user.branch
    console.debug(`Retrieving Dashboard data for ${userRole.toUpperCase()} user`)
    if (userRole === constants.ADMIN || userRole === constants.SUPER_ADMIN) {
        //Get dashboard data for all branches
        const dashboardDataForAllBranches = await getDashboardDataForAdminUser(branchId)
        console.debug('Retrieved dashboard data for all the branches')    
        response.status(200).json(dashboardDataForAllBranches)

    } else if (userRole === constants.BRANCH) {
        
        // Get dashboard data for branch 
        console.log(`Retrieving Dashboard data for branch ${branchId}`)
        const dashboardData = await getDashboardDataForBranchUser(branchId)
        response.status(200).json(dashboardData)
    }
    
})

/**
 * @description Method to generate dashboard data for admin users
 * Internally calls getDashboardDataForBranchUser method for all branches
 */
async function getDashboardDataForAdminUser(adminBranchId) {

    var dashboardData = {}
    dashboardData[adminBranchId] = {}
    const branchRef = db.collection(constants.BRANCHES).doc(adminBranchId);

    // Get pendingRequests for Admin/SuperAdmin's branch
    const pendingRequests = await getTransferRequests(branchRef)
    dashboardData[adminBranchId]['pendingRequests'] = pendingRequests

    // Get recentTransactions for Admin/SuperAdmin's branch
    const recentTransactions = await getRecentTransactions(branchRef)
    dashboardData[adminBranchId]['recentTransactions'] = recentTransactions
    
    // Get productsBelowThreshold for all the branches
    const branchArray = await getProductsBelowThresholdForAllBranches()
        branchArray.forEach(inventoryData => {
            const currentBranchId = inventoryData['branch']
            delete inventoryData['branch']
            if(adminBranchId !== currentBranchId) {
                dashboardData[currentBranchId] = {}
            }
            dashboardData[currentBranchId]['totalProductsBelowThreshold'] = inventoryData['totalProductsBelowThreshold']
            dashboardData[currentBranchId]['totalProductsInInventory'] = inventoryData['totalProductsInInventory']
            dashboardData[currentBranchId]['productsBelowThreshold'] = inventoryData['productList']
        })
    return dashboardData
}

async function getProductsBelowThresholdForAllBranches() {
    const branchDocuments = await db.collection(constants.BRANCHES).listDocuments()
    var dashboardPromises = []
    branchDocuments.map(async branch => {
        const branchRef = db.collection(constants.BRANCHES).doc(branch.id);
        const p1 = getProductsBelowThreshold(branchRef)
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
    const productsBelowThresholdPromise = getProductsBelowThreshold(branchRef)
    const recentTransactionsPromise = getRecentTransactions(branchRef)
    const transferRequestsPromise = getTransferRequests(branchRef)

    var inventoryData = await productsBelowThresholdPromise
    dashboardData[constants.RECENT_ACTIVITY] = await recentTransactionsPromise
    dashboardData[constants.PENDING_REQUESTS] = await transferRequestsPromise

    dashboardData[constants.TOTAL_PRODUCTS_IN_INVENTORY] = inventoryData["totalProductsInInventory"]
    dashboardData[constants.TOTAL_PRODUCTS_BELOW_THRESHOLD] = inventoryData["totalProductsBelowThreshold"]
    dashboardData[constants.PRODUCTS_BELOW_THRESHOLD] = inventoryData["productList"]
    return dashboardData
}

/**
 * Method to retrieve products under threshold for a given branch
 * @param {*} branchId 
 */
async function getProductsBelowThreshold(branchRef) {
    const allProductsInventory = await getInventory(branchRef, branchRef.id, false)
    const products = allProductsInventory.inventory
    const totalProductsInInventory = products.length
    const productsBelowThreshold = []
    
    var responseCount = 0;
    var totalProductsBelowThresholdCount = 0;

    products.forEach(product => {
        if (product[constants.IS_BELOW_THRESHOLD] === true) {
            totalProductsBelowThresholdCount = totalProductsBelowThresholdCount + 1
            responseCount = responseCount + 1
            if(responseCount <= 5) {
                productsBelowThreshold.push(product)
            }
        }    
    })

    const response = {
        "totalProductsBelowThreshold": totalProductsBelowThresholdCount,
        "totalProductsInInventory": totalProductsInInventory,
        "productList": productsBelowThreshold,
        "branch": branchRef.id
    }

    return response
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
async function getTransferRequests(branchRef) {
    let transferRequestsnapshot = await branchRef
        .collection(constants.TRANSFER_REQUESTS)
        .where('state', '==', constants.PENDING)
        .orderBy(constants.DATE, 'desc')
        .limit(10)
        .get()

    const transferRequests = []
    transferRequestsnapshot.forEach(TransferRequest => {
        var transferRequestData = TransferRequest.data()
        transferRequestData[constants.DATE] = transferRequestData[constants.DATE].toDate()
        transferRequests.push(transferRequestData)
    })
    return transferRequests
}

module.exports = router;