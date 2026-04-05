/**
 * SLM MARKET - Helper Utilities
 * General-purpose helper functions
 */

const crypto = require('crypto');

const Helpers = {
    /**
     * Generate a unique order number
     */
    generateOrderNumber() {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    },

    /**
     * Generate a unique tracking ID
     */
    generateTrackingId() {
        const year = new Date().getFullYear();
        const rand = Math.random().toString(36).substr(2, 9).toUpperCase();
        return `SLM-${year}-${rand}`;
    },

    /**
     * Generate a unique SKU
     */
    generateSKU(prefix = 'PRD') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    },

    /**
     * Generate a unique user ID
     */
    generateUserId() {
        return `USR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Generate URL-friendly slug from a string
     */
    slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    },

    /**
     * Format price with FCFA currency
     */
    formatPrice(amount, currency = 'FCFA') {
        return `${Number(amount).toLocaleString('fr-FR')} ${currency}`;
    },

    /**
     * Calculate shipping cost based on method
     */
    calculateShipping(method, subtotal) {
        if (subtotal >= 500000) return 0; // Free shipping above threshold
        const rates = {
            'standard': 0,
            'express': 5000,
            'vip-glove': 15000
        };
        return rates[method] ?? 0;
    },

    /**
     * Calculate tax (18% TVA Côte d'Ivoire)
     */
    calculateTax(subtotal, rate = 0.18) {
        return Math.ceil(subtotal * rate);
    },

    /**
     * Compute loyalty points from order total
     */
    computeLoyaltyPoints(total) {
        return Math.floor(total / 10000);
    },

    /**
     * Determine user tier based on total spend
     */
    getUserTier(totalSpent) {
        if (totalSpent >= 5000000) return 'platinum';
        if (totalSpent >= 2000000) return 'gold';
        if (totalSpent >= 500000)  return 'silver';
        return 'bronze';
    },

    /**
     * Paginate a Mongoose query result
     */
    paginationMeta(total, page, limit) {
        return {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1
        };
    },

    /**
     * Generate a secure random token (for email verification etc.)
     */
    generateSecureToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    },

    /**
     * Mask sensitive data for logging
     */
    maskEmail(email) {
        const [local, domain] = email.split('@');
        return `${local.substring(0, 2)}***@${domain}`;
    },

    /**
     * Parse allowed origins from env string
     */
    parseAllowedOrigins(envString, fallback = ['http://localhost:5500']) {
        if (!envString) return fallback;
        return envString.split(',').map(o => o.trim()).filter(Boolean);
    }
};

module.exports = Helpers;
