var express = require('express')
var router = express.Router()
const admin = require('firebase-admin')
const db = admin.firestore()
const joi = require('@hapi/joi')
const validate = require('../common/validator')
const formatDate = require('../common/dateFormatter')
/*
1.Creates a new role along with its permissions, status and description
*/
router.post('/', async (req, res, next) => {
    const { error } = validateInput(req.body, 'CREATE')
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { id } = req.body
    delete req.body.id
    await db.collection('roles').doc(id).set({
        ...req.body,
        createdDate: new Date(),
        lastUpdatedDate: new Date(),
        label: id.toUpperCase()
    })
    res.status(201).send({ 'message': 'created successfully' })
})

/*
1.Returns all roles in roles collection along with permissions, description, status.
2.Admin and System are the roles supported currently.
*/
router.get('/', async (req, res, next) => {
    let rolesRef = db.collection('roles')
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
router.get('/:role', async (req, res, next) => {
    let rolesRef = db.collection('roles').doc(req.params.role)
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
router.put('/', async (req, res, next) => {
    if(req.body.createdDate){
        delete req.body.createdDate
    }
    const { error } = validateInput(req.body, 'UPDATE')
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { id } = req.body
    delete req.body.id
    await db.collection('roles').doc(id).update({
        ...req.body,
        lastUpdatedDate: new Date()
    })
    res.status(204).send({ 'message': 'updated successfully' })

})

/*
1.Deletes the role record
*/
router.delete('/:role', async (req, res, next) => {
    const { error } = validateInput({ id: req.params.role }, 'DELETE')
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    await db.collection('roles').doc(req.params.role).delete()
    res.status(200).send({ 'message': 'deleted successfully' })
})

function validateInput(body, type) {
    let schema
    switch (type) {

        case 'CREATE':
            schema = joi.object().keys({
                id: joi.string().regex(/^[a-z]{5,10}$/).required(),
                description: joi.string().regex(/^[a-z A-Z]{5,40}$/).required(),
                permissions: joi.array().items(joi.string().required()).required(),
                isActive: joi.bool()
            })
            break
        case 'UPDATE':
            schema = joi.object().keys({
                id: joi.string().regex(/^[a-z]{5,10}$/).required(),
                description: joi.string().regex(/^[a-z A-Z]{5,40}$/).optional(),
                permissions: joi.array().items(joi.string().required()).required(),
                isActive: joi.bool(),
                label: joi.string().regex(/^[A-Z]{5,10}$/),
                lastUpdatedDate: joi.date()
            })
            break
        case 'DELETE':
            schema = joi.object().keys({
                id: joi.string().regex(/^[a-z]{5,10}$/).required(),
            })
            break
    }
    return validate(schema, body)
}
module.exports = router