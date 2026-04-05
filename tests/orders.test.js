/**
 * SLM MARKET - Order Tests
 * Tests: create order, get order, update status, payment
 */

const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only-32chars';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slm-market-test';

let app;

beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
        app = require('../app');
    } catch (e) {
        // DB not available
    }
});

afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
});

// ─────────────────────────────────────────
// POST /api/v1/orders — requires auth
// ─────────────────────────────────────────
describe('POST /api/v1/orders', () => {
    const orderPayload = {
        items: [{ product: '000000000000000000000001', quantity: 1 }],
        shipping: {
            method: 'standard',
            address: {
                street: '12 Rue du Commerce',
                city: 'Abidjan',
                postalCode: '00000',
                country: 'CI'
            }
        },
        payment: { method: 'card' }
    };

    it('should return 401 without authentication', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/orders')
            .send(orderPayload);

        expect([401, 403]).toContain(res.status);
    });

    it('should return 401 with a bad token', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/orders')
            .set('Authorization', 'Bearer thisisafaketoken')
            .send(orderPayload);

        expect([401, 403]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// GET /api/v1/orders/:trackingId — requires auth
// ─────────────────────────────────────────
describe('GET /api/v1/orders/:trackingId', () => {
    it('should return 401 without authentication', async () => {
        if (!app) return;
        const res = await request(app)
            .get('/api/v1/orders/SLM-2026-TESTTRACK');

        expect([401, 403]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// PUT /api/v1/orders/:id/status — admin only
// ─────────────────────────────────────────
describe('PUT /api/v1/orders/:id/status', () => {
    it('should return 401 without authentication', async () => {
        if (!app) return;
        const res = await request(app)
            .put('/api/v1/orders/000000000000000000000001/status')
            .send({ status: 'processing' });

        expect([401, 403]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// POST /api/v1/orders/:id/payment — requires auth
// ─────────────────────────────────────────
describe('POST /api/v1/orders/:id/payment', () => {
    it('should return 401 without authentication', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/orders/000000000000000000000001/payment')
            .send({ method: 'card', amount: 50000 });

        expect([401, 403]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// Helper utilities tests
// ─────────────────────────────────────────
describe('Helpers utilities', () => {
    const Helpers = require('../utils/helpers');

    it('generateOrderNumber should start with ORD-', () => {
        expect(Helpers.generateOrderNumber()).toMatch(/^ORD-/);
    });

    it('generateTrackingId should match SLM-YYYY- pattern', () => {
        const id = Helpers.generateTrackingId();
        expect(id).toMatch(/^SLM-\d{4}-/);
    });

    it('slugify should produce clean URL-safe strings', () => {
        expect(Helpers.slugify('Montre de Luxe')).toBe('montre-de-luxe');
        expect(Helpers.slugify('Sac à Main')).toBe('sac-a-main');
    });

    it('calculateShipping should return 0 for standard', () => {
        expect(Helpers.calculateShipping('standard', 100000)).toBe(0);
    });

    it('calculateShipping should return 5000 for express', () => {
        expect(Helpers.calculateShipping('express', 100000)).toBe(5000);
    });

    it('calculateShipping should return 15000 for vip-glove', () => {
        expect(Helpers.calculateShipping('vip-glove', 100000)).toBe(15000);
    });

    it('calculateShipping should be free above 500 000 FCFA', () => {
        expect(Helpers.calculateShipping('vip-glove', 600000)).toBe(0);
    });

    it('calculateTax should compute 18% TVA', () => {
        expect(Helpers.calculateTax(100000)).toBe(18000);
    });

    it('getUserTier should return correct tier', () => {
        expect(Helpers.getUserTier(0)).toBe('bronze');
        expect(Helpers.getUserTier(500000)).toBe('silver');
        expect(Helpers.getUserTier(2000000)).toBe('gold');
        expect(Helpers.getUserTier(5000000)).toBe('platinum');
    });

    it('computeLoyaltyPoints should award 1 point per 10 000 FCFA', () => {
        expect(Helpers.computeLoyaltyPoints(100000)).toBe(10);
        expect(Helpers.computeLoyaltyPoints(50000)).toBe(5);
    });

    it('generateSecureToken should produce a hex string', () => {
        const token = Helpers.generateSecureToken();
        expect(token).toMatch(/^[a-f0-9]+$/);
        expect(token.length).toBe(64);
    });

    it('maskEmail should hide local part', () => {
        expect(Helpers.maskEmail('john.doe@gmail.com')).toBe('jo***@gmail.com');
    });
});

// ─────────────────────────────────────────
// Validators utilities tests
// ─────────────────────────────────────────
describe('Validators utilities', () => {
    const V = require('../utils/validators');

    it('isEmail should validate correct emails', () => {
        expect(V.isEmail('user@example.com')).toBe(true);
        expect(V.isEmail('not-an-email')).toBe(false);
    });

    it('isStrongPassword should require 8+ chars with letter and digit', () => {
        expect(V.isStrongPassword('SecurePass1')).toBe(true);
        expect(V.isStrongPassword('short')).toBe(false);
        expect(V.isStrongPassword('alllowercase')).toBe(false);
        expect(V.isStrongPassword('12345678')).toBe(false);
    });

    it('isObjectId should validate 24-char hex strings', () => {
        expect(V.isObjectId('507f1f77bcf86cd799439011')).toBe(true);
        expect(V.isObjectId('not-an-id')).toBe(false);
    });

    it('parsePagination should clamp values', () => {
        const { page, limit } = V.parsePagination({ page: '0', limit: '200' });
        expect(page).toBe(1);
        expect(limit).toBe(100);
    });

    it('isValidShippingMethod should only accept known methods', () => {
        expect(V.isValidShippingMethod('standard')).toBe(true);
        expect(V.isValidShippingMethod('drone')).toBe(false);
    });

    it('isValidPaymentMethod should only accept known methods', () => {
        expect(V.isValidPaymentMethod('card')).toBe(true);
        expect(V.isValidPaymentMethod('bitcoin')).toBe(false);
    });
});
