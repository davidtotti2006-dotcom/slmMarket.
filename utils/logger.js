/**
 * SLM MARKET - Logger System
 * Structured logging with file + console output
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERROR_FILE = path.join(LOG_DIR, 'error.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const COLORS = {
    reset: '\x1b[0m',
    info:  '\x1b[36m',  // cyan
    warn:  '\x1b[33m',  // yellow
    error: '\x1b[31m',  // red
    debug: '\x1b[35m'   // magenta
};

function formatMessage(level, message, data = {}) {
    const ts = new Date().toISOString();
    const dataStr = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    return `[${ts}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

function writeToFile(filePath, line) {
    try {
        fs.appendFileSync(filePath, line + '\n');
    } catch (e) {
        // Silent fail — never crash the app because of logging
    }
}

const logger = {
    info(message, data = {}) {
        const line = formatMessage('info', message, data);
        console.log(`${COLORS.info}${line}${COLORS.reset}`);
        writeToFile(LOG_FILE, line);
    },

    warn(message, data = {}) {
        const line = formatMessage('warn', message, data);
        console.warn(`${COLORS.warn}${line}${COLORS.reset}`);
        writeToFile(LOG_FILE, line);
    },

    error(message, data = {}) {
        const line = formatMessage('error', message, data);
        console.error(`${COLORS.error}${line}${COLORS.reset}`);
        writeToFile(LOG_FILE, line);
        writeToFile(ERROR_FILE, line);
    },

    debug(message, data = {}) {
        if (process.env.NODE_ENV !== 'production') {
            const line = formatMessage('debug', message, data);
            console.log(`${COLORS.debug}${line}${COLORS.reset}`);
            writeToFile(LOG_FILE, line);
        }
    },

    // Express stream adapter for morgan
    stream: {
        write(message) {
            logger.info(message.trim());
        }
    }
};

module.exports = logger;
