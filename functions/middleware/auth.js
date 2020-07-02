const express = require('express');
const admin = require('firebase-admin');
const logger = require('./logger')
const constants = require('../common/constants')

/**
 * Middleware to verify whether the user is authenticated
 * @param {request} request 
 * @param {response} response 
 * @param {function to pass control} next
 */
const isAuthenticated = async function (request, response, next) {
    const errMessage = 'Authorization token not found in header or is in invalid format!!'
    const { authorization } = request.headers
    try {
        if (!authorization || !authorization.startsWith('Bearer')) {
            logger.warn(errMessage)
            throw new Error(constants.UNAUTHORIZED)
        }
        const split = authorization.split('Bearer ')
        if (split.length !== 2) {
            logger.warn(errMessage)
            throw new Error(constants.UNAUTHORIZED)
        }
        const authToken = split[1]
        // const decodedToken = await admin.auth().verifyIdToken(authToken)
        //logger.info(`User ${decodedToken.firstName} is authenticated`)
        // request.user = { 
        //     uid: decodedToken.uid, 
        //     role: customClaims.role, 
        //     branch: customClaims.branch, 
        //     firstName: decodedToken.firstName, 
        //     lastName: decodedToken.lastName,
        //     email: decodedToken.email 
        // }

        // TODO: Remove this
        request.user = {
            uid: '5OGy1Jo2JXf2nXocHEVtZX7116K2',
            role: 'admin',
            branch: 'kormangala',
            firstName: 'Walter',
            lastName: 'White',
            email: 'walter@white.com'
        }

        request.user = {
            uid: '5OGy1Jo2JXf2nXocHEVtZX7116K2',
            role: 'admin',
            branch: 'kormangala',
            firstName: 'Jesse',
            lastName: 'Pinkman',
            email: 'jesse@pinkman.com'
        }
        return next()
    } catch (err) {
        // logger.error(`In Catch of IsAuthenticated`)
        // logger.error(`${err.message}`)
        err.message = constants.UNAUTHENTICATED
        err.statusCode = 401
        next(err)
        return;
    }
};

/**
 * Method to check if user is Admin
 * @param {request} request 
 * @param {response} response 
 * @param {function to pass control} next
 */

const isAdmin = async function (request, response, next) {
    const role = request.user.role
    logger.debug(`Current user has role ${role}`)
    if (!role || role !== constants.ADMIN) {
        logger.warn(`Current user is not a admin and has role ${role}`);
        const err =  new Error(`Unauthorized`)
        err.statusCode = 403
        next(err)
        return
    } else {
        return next()
    }
};

module.exports = {
    isAdmin: isAdmin,
    isAuthenticated: isAuthenticated
}
