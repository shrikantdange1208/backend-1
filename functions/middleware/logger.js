
require('express-async-errors');
const {createlogger, transports} = require('winston');
const winston = require('winston');
const logger = createlogger({
    level: 'debug',
    transports: [
        new transports.Console({
            format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.colorize({ all: true }),
            )
        }),
        new transports.File({filename: "logfile.log"}) 
    ],
    exceptionHandlers: [
        new transports.File({ filename: 'exceptions.log'})
    ],
    handleExceptions: true
})
module.exports = logger
