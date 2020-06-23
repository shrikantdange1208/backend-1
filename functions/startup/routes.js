const express = require('express');
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
const users = require('../api/users');
const roles = require('../api/roles');
const permissions = require('../api/permissions');
const httperror = require('../middleware/error');

module.exports = function(app) {
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/api/categories', categories);
    app.use('/api/products', products);
    app.use('/api/operations', operations);
    app.use('/api/units', units);
    app.use('/api/users', users);
    app.use('/api/roles', roles);
    app.use('/api/permissions', permissions);
    app.use(httperror);
}