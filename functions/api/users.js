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
This rest api is invoked during signup of users
1.Gets the user uid using email
2.Saves the user record in users collection
3.Sets the custom claims for the uid
*/
router.post('/', isAdmin, async (req, res, next) => {
    const { error } = validateInput(req.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return
    }
    const { role, branch } = req.body
    const user = await admin.auth().getUserByEmail(req.body.email)
    const { uid } = user
    let usersRef = db.collection(constants.USERS).doc(uid)
    const doc = await usersRef.get()
    if (doc.exists) {
        const err = new Error(`${req.body.email} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return
    }
    const response = {
        ...req.body,
        createdDate: new Date(),
        lastUpdatedDate: new Date()
    }
    await usersRef.set({
        ...response
    })
    await admin.auth().setCustomUserClaims(uid, {
        role: role.toLocaleLowerCase(), branch
    })
    logger.info(`${req.body.email} added to users list and claims have been set`)

    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} created new user ${req.body.firstName}`
    audit.logEvent(eventMessage, req)

    res.status(201).send({ id: uid, ...response })
})

/*
1.Returns all users in users collection.
*/
router.get('/', async (req, res) => {
    let usersRef = db.collection(constants.USERS)
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
    let usersRef = db.collection(constants.USERS).doc(req.params.id)
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
    const { role, branch, id } = req.body
    delete req.body.id
    let usersRef = db.collection(constants.USERS).doc(id)
    const doc = await usersRef.get()
    if (!doc.exists) {
        const error = new Error(`Requested ${id} is not present in firestore`)
        error.statusCode = 404
        next(error)
        return
    }
    await usersRef.update({
        ...req.body,
        lastUpdatedDate: new Date()
    })
    if (role && branch) {
        await admin.auth().setCustomUserClaims(id, {
            role: role.toLocaleLowerCase(),
            branch
        })
    }
    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} updated user ${req.body.firstName}`
    audit.logEvent(eventMessage, req)

    res.sendStatus(204)
})

/*
1.Deletes the user record
*/
router.delete('/:id', isAdmin, async (req, res, next) => {
    let usersRef = db.collection(constants.USERS).doc(req.params.id)
    const doc = await usersRef.get()

    if (!doc.exists) {
        const error = new Error(`${req.params.id} not found in firestore`)
        error.statusCode = 404
        next(error)
        return
    }
    await db.collection(constants.USERS).doc(req.params.id).delete()

    // Fire and forget audit log
    const eventMessage = `User ${req.user.firstName} deleted user ${req.body.firstName}`
    audit.logEvent(eventMessage, req)

    res.status(200).send({ 'message': 'deleted successfully' })
})

function validateInput(body, type) {
    let schema
    switch (type) {
        case constants.CREATE:
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
        case constants.UPDATE:
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
    }
    return validate(schema, body)
}

module.exports = router


module.exports.modifyUsers = functions.firestore
    .document(`/${constants.USERS}/{userId}`)
    .onWrite(async (change, context) => {
        if (!change.before._fieldsProto) {
            await addUserToBranch(change.after)
        } else if (!change.after._fieldsProto) {
            await deleteUserFromBranch(change.before)
        } else {
            var oldData = change.before.data()
            var newData = change.after.data()
            if (oldData.branch !== newData.branch) {
                await deleteUserFromBranch(change.before)
                await addUserToBranch(change.after)
            }
        }
    })

async function addUserToBranch(user) {
    try {
        var { firstName, lastName, branch } = user.data()
        const branchRef = db.doc(`${constants.BRANCHES}/${branch.toLocaleLowerCase()}`)
        const doc = await branchRef.get()
        // Check if branch is present in the collection
        if (!doc.exists) {
            throw new Error(`Branch ${branch} is not present in firestore!!!!`)
        }
        const user = `${firstName} ${lastName}`
        const users = doc.data().users
        users.push(user)
        await branchRef.update({ users })
        console.log(`Added ${user} to ${branch}`)
    }
    catch (error) {
        console.log(error)
    }
}

async function deleteUserFromBranch(user) {
    try {
        var { firstName, lastName, branch } = user.data()
        const branchRef = db.doc(`${constants.BRANCHES}/${branch.toLocaleLowerCase()}`)
        const doc = await branchRef.get()
        // Check if branch is present in the collection
        if (!doc.exists) {
            throw new Error(`Branch ${branch} is not present in firestore!!!!`)
        }
        const user = `${firstName} ${lastName}`
        const users = doc.data().users
        var index = users.indexOf(user)
        if (index > -1) {
            users.splice(index, 1)
            await branchRef.update({ users })
            console.log(`Deleted ${user} from ${branch}`)
        }
    }
    catch (error) {
        console.log(error)
    }
}