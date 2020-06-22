const express = require('express');
const categories = require('../api/category');
const products = require('../api/product');
const operations = require('../api/operation');
const units = require('../api/unit');
const httperror = require('../middleware/error');
module.exports = function(app) {
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.use('/categories', categories);
    app.use('/products', products);
    app.use('/operations', operations);
    app.use('/units', units);
    app.use(httperror);
}