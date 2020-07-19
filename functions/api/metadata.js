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
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth');
const functions = require('firebase-functions')
const audit = require('./audit')
const express = require('express')
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all metadata from firestore
 * @returns Json object containing all metadata
 */
router.get("/", async (request, response) => {
    const metadata = {
        "metadata": []
    }
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

    Promise.all(metadataPromises)
        .then(metadatas => {
            metadatas.forEach(colMetadata => {
                metadata[constants.METADATA].push(colMetadata)
            })
            console.info('Returning all metadata to the client')
            response.status(200).json(metadata)
        })

});

module.exports = router;