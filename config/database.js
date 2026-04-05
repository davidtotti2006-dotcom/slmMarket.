/**
 * SLM MARKET - Database Configuration
 * MongoDB connection with retry logic
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slm-market';

const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
};

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI, options);
        logger.info(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    } catch (error) {
        logger.error('❌ MongoDB connection failed:', { message: error.message });
        // Retry after 5s
        setTimeout(connectDB, 5000);
    }
}

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — attempting reconnect...');
    setTimeout(connectDB, 3000);
});

mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', { message: err.message });
});

module.exports = { connectDB, mongoose };
