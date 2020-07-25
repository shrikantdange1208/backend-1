const admin = require('firebase-admin');
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
            console.warn(errMessage)
            throw new Error(constants.UNAUTHORIZED)
        }
        const split = authorization.split('Bearer ')
        if (split.length !== 2) {
            console.warn(errMessage)
            throw new Error(constants.UNAUTHORIZED)
        }
        const authToken = split[1]
        const decodedToken = await admin.auth().verifyIdToken(authToken)
        console.info(`${decodedToken.email} is authenticated`)
        const user = await admin.auth().getUser(decodedToken.uid)
        const { role, branch, firstName, lastName } = user.customClaims
         request.user = { 
            uid: decodedToken.uid, 
            role: role, 
            branch: branch, 
            name: firstName + ' ' + lastName, 
            email: decodedToken.email 
        }
        //TODO:when auth piece working is confirmed
        // request.user = {
        //     uid: '5OGy1Jo2JXf2nXocHEVtZX7116K2',
        //     role: 'branch',
        //     branch: 'nmnpHFEB45FtMLQzqEBj',
        //     name: 'Jesse Pinkman',
        //     email: 'jesse@pinkman.com'
        // }
        return next()
    } catch (err) {
        // console.error(`In Catch of IsAuthenticated`)
        // console.error(`${err.message}`)
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
    console.debug(`Current user has role ${role}`)
    if (!role || (role !== constants.ADMIN && role !== constants.SUPER_ADMIN)) {
        console.warn(`Current user is neither an admin or a super admin and has role ${role}`);
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
    console.debug(`Current user has role ${role}`)
    if (!role || role !== constants.SUPER_ADMIN) {
        console.warn(`Current user is not a super admin and has role ${role}`);
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
