var express = require('express')
var router = express.Router()
const admin = require('firebase-admin')
const db = admin.firestore()
const formatDate = require('../common/dateFormatter')

/*
1.Returns all permissions in permissions collection.
*/
router.get('/', async (req, res) => {

    let permissionsRef = db.collection('permissions')
    const snapshot = await permissionsRef.get()
    const allPermissions = []
    snapshot.forEach(doc => {
        const permissions = formatDate(doc.data())
        allPermissions.push({ id: doc.id, ...permissions })
    })
    const response = {
        permissions: allPermissions,
        totalPermissions: allPermissions.length
    }
    res.status(200).send(response)
})

module.exports = router