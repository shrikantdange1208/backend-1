const logger = require('./logger');

module.exports = function(err, request, response, next) {
    err.statusCode = err.statusCode || 500;
    if(err.statusCode === 500) {
       err.status =  'Internal Server Error'
       logger.error(err.stack);
    } else {
        err.status = err.message || 'Internal Server Error';
    }
    logger.error(err)
    response.status(err.statusCode).json({
        status: err.statusCode,
        message: err.status
    });
}