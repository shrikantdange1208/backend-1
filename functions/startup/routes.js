const express = require('express');
const cors = require('cors')({origin: true});
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
const audits = require('../api/audit');
const branches = require('../api/branch');
const users = require('../api/users');
const roles = require('../api/roles');
const permissions = require('../api/permissions');
const inventories = require('../api/inventory');
const { isAuthenticated } = require('../middleware/auth');
const httperror = require('../middleware/error');

module.exports = function(app) {
    app.use(cors);
    app.use(isAuthenticated)
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/api/categories', categories);
    app.use('/api/products', products);
    app.use('/api/operations', operations);
    app.use('/api/units', units);
    app.use('/api/audits', audits);
    app.use('/api/branches', branches);
    app.use('/api/users', users);
    app.use('/api/roles', roles);
    app.use('/api/permissions', permissions);
    app.use('/api/inventories', inventories);
    app.use(httperror);
}