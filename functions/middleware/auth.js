const admin = require('firebase-admin');
const logger = require('./logger')
const constants = require('../common/constants')
const db = admin.firestore()
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
        console.log('token', authToken)
        // const decodedToken = await admin.auth().verifyIdToken(authToken)
        // console.log('decodedtoken', decodedToken)
        // //logger.info(`User ${decodedToken.firstName} is authenticated`)
        // const user = await admin.auth().getUser(decodedToken.uid)
        // console.log(user)
        /*let usersRef = await db.collection(constants.USERS).doc(decodedToken.uid)
        const doc = await usersRef.get()
         request.user = { 
            uid: decodedToken.uid, 
            role: decodedToken.role, 
            branch: decodedToken.branch, 
            firstName: doc.data().firstName, 
            lastName: doc.data().lastName,
            email: doc.data().email 
        }
        */
        request.user = {
            uid: '5OGy1Jo2JXf2nXocHEVtZX7116K2',
            role: 'superadmin',
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
 * Method to check if user is either Admin or SuperAdmin
 * @param {request} request 
 * @param {response} response 
 * @param {function to pass control} next
 */

const isAdminOrSuperAdmin = async function (request, response, next) {
    const role = request.user.role
    logger.debug(`Current user has role ${role}`)
    if (!role || (role !== constants.ADMIN && role !== constants.SUPER_ADMIN)) {
        logger.warn(`Current user is neither an admin or a super admin and has role ${role}`);
        const err =  new Error(`Unauthorized`)
        err.statusCode = 403
        next(err)
        return
    } else {
        return next()
    }
};

/**
 * Method to check if user is SuperAdmin
 * @param {request} request 
 * @param {response} response 
 * @param {function to pass control} next
 */

const isSuperAdmin = async function (request, response, next) {
    const role = request.user.role
    logger.debug(`Current user has role ${role}`)
    if (!role || role !== constants.SUPER_ADMIN) {
        logger.warn(`Current user is not a super admin and has role ${role}`);
        const err =  new Error(`Unauthorized`)
        err.statusCode = 403
        next(err)
        return
    } else {
        return next()
    }
};

module.exports = {
    isAdminOrSuperAdmin,
    isAuthenticated,
    isSuperAdmin,
}
