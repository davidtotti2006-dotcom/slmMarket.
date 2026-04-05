/**
 * SLM MARKET - Validation Utilities
 * Reusable input validation helpers
 */

const validator = require('validator');

const Validators = {
    /**
     * Check if a string is a valid email
     */
    isEmail(email) {
        return typeof email === 'string' && validator.isEmail(email);
    },

    /**
     * Check password strength: min 8 chars, at least 1 letter & 1 digit
     */
    isStrongPassword(password) {
        return (
            typeof password === 'string' &&
            password.length >= 8 &&
            /[a-zA-Z]/.test(password) &&
            /[0-9]/.test(password)
        );
    },

    /**
     * Check Ivory Coast / international phone number
     */
    isPhone(phone) {
        return typeof phone === 'string' && /^\+?[\d\s\-()]{8,20}$/.test(phone);
    },

    /**
     * Check positive number
     */
    isPositiveNumber(value) {
        return typeof value === 'number' && value >= 0;
    },

    /**
     * Check MongoDB ObjectId format
     */
    isObjectId(id) {
        return /^[a-f\d]{24}$/i.test(String(id));
    },

    /**
     * Sanitize a string: trim & strip dangerous characters
     */
    sanitizeString(str, maxLength = 500) {
        if (typeof str !== 'string') return '';
        return validator.escape(str.trim()).substring(0, maxLength);
    },

    /**
     * Validate order items array
     */
    isValidOrderItems(items) {
        if (!Array.isArray(items) || items.length === 0) return false;
        return items.every(item =>
            item.product &&
            this.isObjectId(item.product) &&
            Number.isInteger(item.quantity) &&
            item.quantity >= 1
        );
    },

    /**
     * Validate shipping method
     */
    isValidShippingMethod(method) {
        return ['standard', 'express', 'vip-glove'].includes(method);
    },

    /**
     * Validate payment method
     */
    isValidPaymentMethod(method) {
        return ['card', 'paypal', 'mobile', 'crypto'].includes(method);
    },

    /**
     * Validate pagination query params
     */
    parsePagination(query) {
        const page = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
        return { page, limit };
    }
};

module.exports = Validators;
