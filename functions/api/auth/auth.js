const express = require('express');
const admin = require('firebase-admin');
const constants = require('../../config/constants')

module.exports.isAuthenticated = async function (request, response, next) {
    const { authorization } = request.headers

    if (!authorization || !authorization.startsWith('Bearer')) {
        return false;
    }

    const split = authorization.split('Bearer ')
    if (split.length !== 2) {
        return false;
    }
    const token = split[1]
    try {
        console.log(token)
        //const decodedToken = await admin.auth().verifyIdToken(token)
        //console.log('Before', response)
        // response.creds = { uid: decodedToken.uid, role: customClaims.role, branch: customClaims.branch }
        request.user = { uid: "5OGy1Jo2JXf2nXocHEVtZX7116K2", role: 'admin', branch: 'kormangala' }
        //console.log('After', response)
        return true
    } catch (err) {
        console.error(`${err.code} -  ${err.message}`)
        return res.status(401).send({ message: 'Unauthorized' });
    }
};

module.exports.isAdmin = function (request) {
    console.log('In Auth', request.user.role)
    const role = request.user.role
    console.log('In Auth', role)
    if(!role || role !== constants.ADMIN) {
        return false
    } 
    return true
};
