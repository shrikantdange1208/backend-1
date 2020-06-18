module.exports = function validateParams(schema, body) {
    return schema.validate(body);
}