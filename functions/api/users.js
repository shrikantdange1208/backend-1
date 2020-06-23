var express = require('express')
var router = express.Router()
const admin = require('firebase-admin')
const db = admin.firestore()
const logger = require('../middleware/logger')
const joi = require('@hapi/joi')
const validate = require('../common/validator')
const formatDate = require('../common/dateFormatter')
/*
This rest api is invoked during signup of users
1.Gets the user uid using email
2.Saves the user record in users collection
3.Sets the custom claims for the uid
*/
router.post('/', async (req, res, next) => {
    const { error } = validateInput(req.body, 'CREATE')
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { role, branch } = req.body
    const user = await admin.auth().getUserByEmail(req.body.email)
    const { uid } = user
    await db.collection('users').doc(uid).set({
        ...req.body,
        createdDate: new Date(),
        lastUpdatedDate: new Date()
    })
    await admin.auth().setCustomUserClaims(uid, {
        role, branch
    })
    logger.info(`${req.body.email} added to users list and claims have been set`)
    res.status(201).send({ 'message': 'created successfully' })
})

/*
1.Returns all users in users collection.
*/
router.get('/', async (req, res) => {
    let usersRef = db.collection('users')
    const snapshot = await usersRef.get()
    const allUsers = []
    snapshot.forEach(doc => {
        const users = formatDate(doc.data())
        allUsers.push({ id: doc.id, ...users })
    })
    const response = {
        users: allUsers,
        totalUsers: allUsers.length
    }
    res.status(200).send(response)
})

/*
1.Returns a specific user
*/
router.get('/:id', async (req, res, next) => {
    let usersRef = db.collection('users').doc(req.params.id)
    const doc = await usersRef.get()

    if (!doc.exists) {
        const error = new Error(`${req.params.id} not found in firestore`)
        error.statusCode = 404
        next(error)
        return
    } else {
        const user = formatDate(doc.data())
        res.status(200).send({ id: doc.id, ...user })
    }
})
/*
1.Gets the user uid using email
2.Updates the user record in users collection - only role and branch can be updated
3.Sets/updates the custom claims for the uid
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
    const { role, branch, id } = req.body
    delete req.body.id
    await db.collection('users').doc(id).update({
        ...req.body,
        lastUpdatedDate: new Date()
    })
    if (role && branch) {
        await admin.auth().setCustomUserClaims(id, {
            role,
            branch
        })
    }
    res.status(204).send({ 'message': 'updated successfully' })
})

/*
1.Deletes the user record
*/
router.delete('/:id', async (req, res, next) => {
    const { error } = validateInput({ id: req.params.id }, 'DELETE')
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    await db.collection('users').doc(req.params.id).delete()
    res.status(200).send({ 'message': 'deleted successfully' })
})

function validateInput(body, type) {
    let schema
    switch (type) {
        case 'CREATE':
            schema = joi.object().keys({
                role: joi.string().regex(/^[a-z]{5,10}$/).required(),
                branch: joi.string().regex(/^[a-zA-Z]{5,30}$/).required(),
                firstName: joi.string().min(1).max(30).required(),
                lastName: joi.string().min(1).max(30).required(),
                contact: joi.string().length(10).required(),
                isActive: joi.bool().default(true),
                email: joi.string().email({ minDomainSegments: 2 }).required()
            })
            break
        case 'UPDATE':
            schema = joi.object().keys({
                id: joi.string().alphanum().min(28).max(30).required(),
                role: joi.string().regex(/^[a-z]{5,10}$/).required(),
                branch: joi.string().regex(/^[a-zA-Z]{5,30}$/).required(),
                firstName: joi.string().min(1).max(30),
                lastName: joi.string().min(1).max(30),
                contact: joi.string().length(10),
                isActive: joi.bool(),
                email: joi.string().email({ minDomainSegments: 2 }),
                lastUpdatedDate: joi.date()
            })
            break
        case 'DELETE':
            schema = joi.object().keys({
                id: joi.string().alphanum().min(28).max(30).required(),
            })
            break
    }
    return validate(schema, body)
}

module.exports = router