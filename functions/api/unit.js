const constants = require('../common/constants')
const validate = require('../common/validator')
const utils = require('../common/utils')
const logger = require('../middleware/logger')
const { isAdmin } = require('../middleware/auth');
const audit = require('./audit')
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const db = admin.firestore();

/**
 * @description Route to retireve all units from firestore
 * @returns Json object containing all products
 */
router.get("/", async (request, response, next) => {
    logger.info("Retrieving all units from firestore");
    const units = {
        "units": []
    }
    let unitCollection = db.collection(constants.UNITS);
    let snapshot = await unitCollection.get()
    snapshot.forEach(unit => {
        var unitData = unit.data()
        unitData[constants.ID] = unit.id
        unitData[constants.NAME] = utils.capitalize(unitData[constants.NAME])
        unitData = utils.formatDate(unitData)
        units.units.push(unitData);
    })
    units[constants.TOTAL_UNITS] = snapshot.size;
    logger.debug('Returning all units to client.');
    response.status(200).send(units);
});

/**
 * @description Route to retrieve single unit data from firestore
 * @returns Json object containing requested unit
 * @throws 400 if the branch does not exists in firestore
 */
router.get('/:id', async (request, response, next) => {
    var unitId = request.params.id
    logger.info(`Retrieving unit from firestore`)
    const doc = db.collection(constants.UNITS).doc(unitId);
    const unit = await doc.get()
    if (!unit.exists) {
        const error = new Error(`Requested unit is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    var unitData = unit.data()
    unitData[constants.ID] = unit.id
    unitData[constants.NAME] = utils.capitalize(unitData[constants.NAME])
    unitData = utils.formatDate(unitData)
    logger.debug(`Returning details for unit ${unitData[constants.NAME]} to client.`);
    response.status(200).send(unitData);
});

/**
 * @description Route to add units Firestore
 * @returns Created unit
 * @throws 400 if unit already exists or if required params are missing
 */
router.post('/', isAdmin, async (request, response, next) => {
    logger.info(`Creating unit in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.CREATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If unit already exists, return 400
    var unitName = request.body.name.toLocaleLowerCase()
    logger.info(`Creating unit ${unitName} in firestore....`);
    const unitSnapshot = await db.collection(constants.UNITS)
                    .where(constants.NAME, '==', unitName)
                    .get()
    
    if (unitSnapshot.size > 0) {
        const err = new Error(`The unit ${unitName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }
    let data = request.body
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    const unitRef = await db.collection(constants.UNITS).add(data)

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} created new unit ${utils.capitalize(unitName)}`
    audit.logEvent(eventMessage, request)

    logger.debug(`${unitName} document created`)
    response.status(201).json({'id': unitRef.id, ...data})
});

/**
 * @description Route to update unit
 * @returns 204, No Content
 * @throws 404/400 if unit does not exist or has wrong params resp.
 */
router.put('/', isAdmin, async (request, response, next) => {
    logger.debug(`Updating unit in firestore....`);

    // Validate parameters
    const { error } = validateParams(request.body, constants.UPDATE)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If unit does not exists, return 404
    var unitId = request.body.id
    logger.info(`Updating unit with ID ${unitId} in firestore....`);
    const unitRef = db.collection(constants.UNITS).doc(unitId);
    const unit = await unitRef.get()
    if (!unit.exists) {
        const err = new Error(`Requested unit with ID ${unitId} is not present in Firestore.`)
        err.statusCode = 404
        next(err)
        return;
    }
    const oldData = unit.data()
    let newData = request.body
    delete newData[constants.ID]
    newData[constants.LAST_UPDATED_DATE] = new Date()
    delete newData[constants.CREATED_DATE]
    await unitRef.set(newData, { merge: true })
    newData[constants.CREATED_DATE] = oldData[constants.CREATED_DATE]
    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} updated unit ${oldData[constants.NAME]}`
    audit.logEvent(eventMessage, request, oldData, newData)

    logger.debug(`Updated unit ${oldData[constants.NAME]}`)
    response.sendStatus(204)
})

/**
 * @description Route to delete units
 * @returns  deleted unit
 * @throws 400 if unit for product does not exist
 */
router.delete('/:id', isAdmin, async(request, response, next) => {
    var unitId = request.params.id
    logger.info(`Deleting unit with ID ${unitId} from firestore`)
    
    const unitRef = db.collection(constants.UNITS).doc(unitId);
    const unit = await unitRef.get()
    if (!unit.exists) {
        const error = new Error(`Unit with ID ${unitId} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    const unitData = unit.data()
    await unitRef.delete()

    // Add event in Audit
    const eventMessage = `User ${request.user.firstName} deleted unit ${unitData[constants.NAME]}`
    audit.logEvent(eventMessage, request)

    logger.debug(`Deleted unit ${unitData[constants.NAME]}`)
    response.status(200).json({"message": "deleted successfully"})
})

/**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  */
 function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.CREATE:
            schema = joi.object({
                name: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required(),
                isActive: joi.bool()
                    .required()
            })
            break
        case constants.UPDATE:
                schema = joi.object({
                    id: joi.string()
                        .min(1)
                        .max(30)
                        .required(),
                    name: joi.string()
                        .min(1)
                        .max(30),
                    description: joi.string()
                        .min(1)
                        .max(50),
                    lastUpdatedDate: joi.date(),
                    createdDate: joi.date(),
                    isActive: joi.bool()
                })
                break
    }
    return validate(schema, body)
}

module.exports = router;