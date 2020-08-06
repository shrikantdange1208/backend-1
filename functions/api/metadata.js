const constants = require('../common/constants')
const { getAllBranches } = require('./branch')
const { getAllCategories } = require('./category')
const { getAllProducts } = require('./product')
const { getAllOperations } = require('./operation')
const { getAllUnits } = require('./unit')
const { getAllRoles } = require('./roles')
const { getAllUsers } = require('./users')
const express = require('express')
const router = express.Router();


/**
 * @description Route to retireve all metadata from firestore
 * @returns Json object containing all metadata
 */
router.get("/", async (request, response) => {
    console.info('Retrieving all metadata from firestore')
    const metadataResponse = {}
    const metadataPromises = []
    
    const branchPromise = getAllBranches()
    metadataPromises.push(branchPromise)
    
    const categoryPromise = getAllCategories()
    metadataPromises.push(categoryPromise)

    const productPromise = getAllProducts()
    metadataPromises.push(productPromise)

    const rolesPromise = getAllRoles()
    metadataPromises.push(rolesPromise)

    const operationPromise = getAllOperations()
    metadataPromises.push(operationPromise)

    const unitPromise = getAllUnits()
    metadataPromises.push(unitPromise)

    const usersPromise = getAllUsers()
    metadataPromises.push(usersPromise)

    Promise.all(metadataPromises)
        .then(promiseArray => {
            promiseArray.forEach(collectionData => {
                addCollectionDataToResponse(metadataResponse, collectionData)
            })
            console.info('Returning all metadata to the client')
            response.status(200).json(metadataResponse)
        })

});

/**
 * Utility function to create response object
 * @param {*} metadata 
 * @param {*} collectionData 
 */
function addCollectionDataToResponse(metadata, collectionData) {
    if (collectionData.hasOwnProperty(constants.BRANCHES)) {
        metadata[constants.BRANCHES] = collectionData[constants.BRANCHES]
    } else if (collectionData.hasOwnProperty(constants.CATEGORIES)) {
        metadata[constants.CATEGORIES] = collectionData[constants.CATEGORIES]
    } else if (collectionData.hasOwnProperty(constants.PRODUCTS)) {
        metadata[constants.PRODUCTS] = collectionData[constants.PRODUCTS]
    } else if (collectionData.hasOwnProperty(constants.ROLES)) {
        metadata[constants.ROLES] = collectionData[constants.ROLES]
    } else if (collectionData.hasOwnProperty(constants.OPERATIONS)) {
        metadata[constants.OPERATIONS] = collectionData[constants.OPERATIONS]
    } else if (collectionData.hasOwnProperty(constants.UNITS)) {
        metadata[constants.UNITS] = collectionData[constants.UNITS]
    } else if (collectionData.hasOwnProperty(constants.USERS)) {
        metadata[constants.USERS] = collectionData[constants.USERS]
    }
}

module.exports = router;