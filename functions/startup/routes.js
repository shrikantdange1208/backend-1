const express = require('express');
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
const audits = require('../api/audit');
const branch = require('../api/branch');
const httperror = require('../middleware/error');
module.exports = function(app) {
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/api/categories', categories);
    app.use('/api/products', products);
    app.use('/api/operations', operations);
    app.use('/api/units', units);
    app.use('/api/audits', audits);
    app.use('/api/branch', branch);
    app.use(httperror);
}