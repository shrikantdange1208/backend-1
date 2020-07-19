const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger');
const { getAllBranches } = require('./branch')
const { getAllCategories } = require('./category')
const formatDate = require('../common/dateFormatter')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const { isAdminOrSuperAdmin, isSuperAdmin } = require('../middleware/auth');
const functions = require('firebase-functions')
const audit = require('./audit')
const express = require('express')
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all branches from firestore
 * @returns Json object containing all branches
 */
router.get("/", async (request, response) => {
    const metadata = {
        "metadata": []
    }
    const branches = await getAllBranches()
    metadata[constants.METADATA].push(branches) 
    const categories = await getAllCategories()
    metadata[constants.METADATA].push(categories)
    logger.debug('Returning branches to client.');
    response.status(200).send(metadata);
});

async function getBranches(params) {
    
}

module.exports = router;