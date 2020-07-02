var express = require('express')
var router = express.Router()
const admin = require('firebase-admin')
const db = admin.firestore()
const logger = require('../middleware/logger')
const joi = require('@hapi/joi')
const validate = require('../common/validator')
const formatDate = require('../common/dateFormatter')
const constants = require('../common/constants')
const functions = require('firebase-functions')
const audit = require('./audit')
const { isAdmin } = require('../middleware/auth')
/*
branch: koramangala,
fromBranch: sarjapur,
product: bread,
quantity: 5
}*/
router.post('/request', async (req, res, next) => {
    const { branch, fromBranch, product, quantity } = req.body
    const branchDocRef = await db.collection(constants.BRANCHES).doc(branch).collection(constants.PENDING_TRANSACTIONS).add({
        product,
        quantity,
        fromBranch,
        operation: 'transferIn',
        date: new Date(),
        user: req.user.email
      })
    const id = branchDocRef.id
    await db.collection(constants.BRANCHES).doc(fromBranch).collection(constants.PENDING_TRANSACTIONS).doc(id).set({
        product,
        quantity,
        toBranch: branch,
        operation: 'transferOut',
        date: new Date(),
        user: req.user.email
      })
      res.status(200).send({transactionId : id})
})

module.exports = router