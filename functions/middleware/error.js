const logger = require('./logger');

process.on('unhandledRejection', (err) => {
    throw err;
});

module.exports = function(err, request, response, next) {
    err.statusCode = err.statusCode || 500;
    if(err.statusCode === 500) {
       err.status =  'Internal Server Error'
       console.log(err.stack)
    } else {
        err.status = err.message || 'Internal Server Error';
    }
    logger.error(err)
    response.status(err.statusCode).json({
        message: err.status
    });
}