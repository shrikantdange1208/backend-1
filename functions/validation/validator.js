module.exports = function validateSchema(schema, body) {
    return schema.validate(body);
}