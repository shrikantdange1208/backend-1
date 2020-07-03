var express = require('express')
var router = express.Router()
const admin = require('firebase-admin')
const db = admin.firestore()
const joi = require('@hapi/joi')
const validate = require('../common/validator')
const formatDate = require('../common/dateFormatter')
const constants = require('../common/constants')
const { isAdmin } = require('../middleware/auth')
const audit = require('./audit')
/*
1.Creates a new role along with its permissions, status and description
*/
router.post('/', isAdmin, async (req, res, next) => {
    const { error } = validateInput(req.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { name } = req.body
    let rolesRef = db.collection(constants.ROLES).where('name','==', name)
    const snapshot = await rolesRef.get()
    if (!snapshot.empty) {
        const err = new Error(`Role ${name} already exists. Please update if needed.`)
        err.statusCode = 404
        next(err)
        return
    }
    const data = {
        ...req.body,
        createdDate: new Date(),
        lastUpdatedDate: new Date()
    }
    const response = await db.collection(constants.ROLES).add({
        ...data
    })
    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} created new role ${name}`
    audit.logEvent(eventMessage, req)

    res.status(201).send({ id: response.id, ...data })
})

/*
1.Returns all roles in roles collection along with permissions, description, status.
2.Admin and System are the roles supported currently.
*/
router.get('/', async (req, res, next) => {
    let rolesRef = db.collection(constants.ROLES)
    const snapshot = await rolesRef.get()
    const allRoles = []
    snapshot.forEach(doc => {
        const roles = formatDate(doc.data())
        allRoles.push({ id: doc.id, ...roles })
    })
    const response = {
        roles: allRoles,
        totalRoles: allRoles.length
    }
    res.status(200).send(response)
})

/*
1.Returns a specific role and its permissions, description, status
*/
router.get('/:id', async (req, res, next) => {
    let rolesRef = db.collection(constants.ROLES).doc(req.params.id)
    const doc = await rolesRef.get()
    if (!doc.exists) {
        const error = new Error(`${req.params.role} not found in firestore`)
        error.statusCode = 404
        next(error)
        return
    } else {
        const role = formatDate(doc.data())
        res.status(200).send({ id: doc.id, ...role })
    }
})

/*
1.Updates the role record with given permissions
2.Status of the role, description of role can also be updated
*/
router.put('/', isAdmin, async (req, res, next) => {
    if (req.body.createdDate) {
        delete req.body.createdDate
    }
    const { error } = validateInput(req.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { id } = req.body
    delete req.body.id
    let rolesRef = db.collection(constants.ROLES).doc(id)
    const doc = await rolesRef.get()
    if (!doc.exists) {
        const error = new Error(`Requested ${id} is not present in firestore`)
        error.statusCode = 404
        next(error)
        return
    }
    const oldData = doc.data()
    let newData = req.body
    delete newData[constants.ID]
    delete newData[constants.CREATED_DATE]
    newData[constants.LAST_UPDATED_DATE] = new Date()
    await usersRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]

    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} updated role ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, req, oldData, newData)

    res.sendStatus(204)

})

/*
1.Deletes the role record
*/
router.delete('/:id', isAdmin, async (req, res, next) => {
    let rolesRef = db.collection(constants.ROLES).doc(req.params.id)
    const doc = await rolesRef.get()
    if (!doc.exists) {
        const error = new Error(`${req.params.id} not found in firestore`)
        error.statusCode = 404
        next(error)
        return
    }
    const { name } = doc.data()
    await rolesRef.delete()

    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} deleted role ${name}`
    audit.logEvent(eventMessage, req)

    res.status(200).send({ 'message': 'deleted successfully' })
})

function validateInput(body, type) {
    let schema
    switch (type) {

        case constants.CREATE:
            schema = joi.object().keys({
                name: joi.string().regex(/^[a-zA-Z]{5,10}$/).required(),
                description: joi.string().regex(/^[a-z A-Z]{5,40}$/).required(),
                permissions: joi.array().items(joi.string().required()).required(),
                isActive: joi.bool().required()
            })
            break
        case constants.UPDATE:
            schema = joi.object().keys({
                id: joi.string().alphanum().length(20).required(),
                description: joi.string().regex(/^[a-z A-Z]{5,40}$/).optional(),
                permissions: joi.array().items(joi.string().required()).required(),
                isActive: joi.bool(),
                name: joi.string().regex(/^[a-zA-Z]{5,10}$/),
                lastUpdatedDate: joi.date()
            })
            break
    }
    return validate(schema, body)
}
module.exports = router