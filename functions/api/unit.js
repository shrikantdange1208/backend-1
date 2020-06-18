const constants = require('../config/constants')
const validate = require('../validation/validation')
const logger = require('../middleware/logger');
const config = require('config');
const joi = require('@hapi/joi');
const admin = require('firebase-admin');
const express = require('express');
const router = express.Router();
const cors = require('cors');
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
    let unitCollection = db.collection(constants.UNIT);
    let snapshot = await unitCollection.get()
    snapshot.forEach(unit => {
        var unitInfo = {}
        var unitData = unit.data()
        unitInfo[constants.UNIT] = unit.id
        unitInfo[constants.DESCRIPTION] = unitData.description
        unitInfo[constants.CREATED_DATE] = unitData.createdDate.toDate()
        unitInfo[constants.LAST_UPDATED_DATE] = unitData.lastUpdatedDate.toDate()
        units.units.push(unitInfo);
    })
    units[constants.TOTAL_UNITS] = snapshot.size;
    logger.debug('Returning all units to client.');
    response.status(200).send(units);
});

/**
 * @description Route to add units Firestore
 * @returns Created unit
 * @throws 400 if unit already exists or if required params are missing
 */
router.post('/', async (request, response, next) => {
    logger.info(`Creating unit in firestore....`);
    // Validate parameters
    logger.debug('Validating params.')
    const { error } = validateParams(request.body, constants.ADD)
    if (error) {
        const err = new Error(error.details[0].message)
        err.statusCode = 400
        next(err)
        return;
    }

    // If unit already exists, return 400
    var unitName = request.body.unit.toLocaleLowerCase()
    logger.info(`Creating unit ${unitName} in firestore....`);
    const doc = db.collection(constants.UNIT).doc(unitName);
    const unit = await doc.get()
    if (unit.exists) {
        const err = new Error(`The unit ${unitName} already exists. Please update if needed.`)
        err.statusCode = 400
        next(err)
        return;
    }
    let data = {}
    data[constants.UNIT] = request.body.unit.toLocaleLowerCase()
    data[constants.DESCRIPTION] = request.body.description
    data[constants.CREATED_DATE] = new Date()
    data[constants.LAST_UPDATED_DATE] = new Date()
    await db.collection(constants.UNIT).doc(unitName).set(data)
    
    delete data[constants.CREATED_DATE]
    delete data[constants.LAST_UPDATED_DATE]

    logger.debug(`${unitName} document created`)
    response.status(200).send(data);    
});

/**
 * @description Route to delete units
 * @returns  deleted unit
 * @throws 400 if unit for product does not exist
 */
router.delete('/:unit', async(request, response, next) => {
    var  unitName = request.params.unit.toLocaleLowerCase()
    logger.info(`Deleting unit ${unitName} from firestore`)
    
    const unitRef = db.collection(constants.UNIT).doc(unitName);
    const unit = await unitRef.get()
    if (!unit.exists) {
        const error = new Error(`Unit ${unitName} is not present in Firestore.`)
        error.statusCode = 404
        next(error)
        return;
    }
    let data = {}
    const unitData = unit.data()
    data[constants.UNIT] = unitName
    data[constants.DESCRIPTION] = unitData.description
    await unitRef.delete()
    logger.debug(`Deleted unit ${unitName}`)
    response
        .status(200)
        .send(data);
})

/**
  * Validates the request body.
  * @param {*} body request body
  * @param {*} type identifier to determine which request is to be validated
  *         product for create product
  *         description for updating description
  *         status for updating status
  *         status for updating unit
  */
 function validateParams(body, type) {
    let schema;
    switch(type) {
        case constants.ADD:
            schema = joi.object({
                unit: joi.string()
                    .min(1)
                    .max(30)
                    .required(),
                description: joi.string()
                    .min(1)
                    .max(50)
                    .required()
            })
            break
    }
    return validate(schema, body)
}

module.exports = router;