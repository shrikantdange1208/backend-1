require('express-async-errors');
const {createLogger, transports} = require('winston');
const winston = require('winston');

process.on('unhandledRejection', (err) => {
    throw err;
});

const logger = createLogger({
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
