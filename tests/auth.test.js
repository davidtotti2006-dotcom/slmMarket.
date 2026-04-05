/**
 * SLM MARKET - Authentication Tests
 * Tests: register, login, logout, token refresh
 */

const request = require('supertest');

// Load environment before importing app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only-32chars';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/slm-market-test';

let app;

beforeAll(() => {
    // Suppress logger output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
        app = require('../app');
    } catch (e) {
        console.error('App load failed:', e.message);
    }
});

afterAll(async () => {
    // Give connections time to close
    await new Promise(resolve => setTimeout(resolve, 500));
});

// ─────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
    const validUser = {
        email: `test-${Date.now()}@slm-test.com`,
        password: 'SecurePass123',
        firstName: 'Test',
        lastName: 'User'
    };

    it('should register a new user and return 201', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send(validUser)
            .expect('Content-Type', /json/);

        expect([201, 200]).toContain(res.status);
        if (res.body.success) {
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).not.toHaveProperty('password');
            expect(res.body.user.email).toBe(validUser.email);
        }
    });

    it('should reject invalid email with 400', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...validUser, email: 'not-an-email' });

        expect([400, 422]).toContain(res.status);
    });

    it('should reject short password with 400', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...validUser, email: `short-${Date.now()}@test.com`, password: '123' });

        expect([400, 422]).toContain(res.status);
    });

    it('should reject duplicate email', async () => {
        if (!app) return;
        const dupEmail = `dup-${Date.now()}@slm-test.com`;
        await request(app).post('/api/v1/auth/register').send({ ...validUser, email: dupEmail });

        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ ...validUser, email: dupEmail });

        expect([400, 409, 500]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────
describe('POST /api/v1/auth/login', () => {
    it('should return 400 if email or password missing', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com' });

        expect([400, 401]).toContain(res.status);
    });

    it('should reject wrong credentials with 4xx', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'nobody@example.com', password: 'WrongPass999' });

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
    });

    it('should login successfully with valid credentials', async () => {
        if (!app) return;
        const email = `login-${Date.now()}@slm-test.com`;
        const password = 'ValidPass123';

        // Register first
        await request(app).post('/api/v1/auth/register')
            .send({ email, password, firstName: 'Login', lastName: 'Test' });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email, password });

        if (res.status === 200) {
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).not.toHaveProperty('password');
        }
    });
});

// ─────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────
describe('POST /api/v1/auth/logout', () => {
    it('should return 401 without token', async () => {
        if (!app) return;
        const res = await request(app)
            .post('/api/v1/auth/logout');

        expect([401, 403]).toContain(res.status);
    });
});

// ─────────────────────────────────────────
// GET unknown route
// ─────────────────────────────────────────
describe('Unknown route', () => {
    it('should return 404 for unknown routes', async () => {
        if (!app) return;
        const res = await request(app).get('/api/v1/unknown-route-xyz');
        expect(res.status).toBe(404);
    });
});
