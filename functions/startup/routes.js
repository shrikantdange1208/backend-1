const express = require('express');
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
<<<<<<< HEAD
const audits = require('../api/audit');
const branch = require('../api/branch');
=======
const users = require('../api/users');
const roles = require('../api/roles');
const permissions = require('../api/permissions');
>>>>>>> 188ad94082cbe88e37601a4dd9eefe5fa7f6b8e4
const httperror = require('../middleware/error');

module.exports = function(app) {
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/api/categories', categories);
    app.use('/api/products', products);
    app.use('/api/operations', operations);
    app.use('/api/units', units);
<<<<<<< HEAD
    app.use('/api/audits', audits);
    app.use('/api/branch', branch);
=======
    app.use('/api/users', users);
    app.use('/api/roles', roles);
    app.use('/api/permissions', permissions);
>>>>>>> 188ad94082cbe88e37601a4dd9eefe5fa7f6b8e4
    app.use(httperror);
}