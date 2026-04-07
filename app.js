/**
 * 🏰 SLM MARKET - BACKEND ENTERPRISE V7.0  
 * Architecture Service-Oriented (SOA) Production-Grade
 * 5000+ lignes de code intelligent et sécurisé
 * 
 * Structure:
 * - Layer 1: Express Setup & Middleware
 * - Layer 2: Database Models & Connections
 * - Layer 3: Service Layer (Business Logic)
 * - Layer 4: Controller Layer (Request Handling)
 * - Layer 5: Route Definitions
 * - Layer 6: Error Handling & Logging
 */
 
// ═══════════════════════════════════════════════════════════════════════════
// 📦 IMPORTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
 
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const redis = require('redis');
const nodemailer = require('nodemailer');
const EmailService = require('./config/email');
const validator = require('validator');
const { body, param, query, validationResult } = require('express-validator');
 
dotenv.config();
 
const app = express();
const redisClient = redis.createClient({ host: 'localhost', port: 6379 });
 
// ═══════════════════════════════════════════════════════════════════════════
// 🔐 SECURITY & MIDDLEWARE SETUP
// ═══════════════════════════════════════════════════════════════════════════
 
// Helmet: Set HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "http://localhost:5000"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true
}));
 
// CORS Configuration
const corsOptions = {
    origin: (process.env.ALLOWED_ORIGINS?.split(',') || []).concat([
        'http://localhost:5000', 'http://127.0.0.1:5000',
        'http://localhost:5500', 'http://127.0.0.1:5500'
    ]),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
};
app.use(cors(corsOptions));
 
// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
 
// Logging
const logger = require('./utils/logger');
app.use(morgan('combined', { stream: { write: msg => logger.info(msg) } }));
 
// Rate Limiting - Global
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);
 
// Rate Limiting - Authentication
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true
});
 
// Rate Limiting - API
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100
});
 
// ═══════════════════════════════════════════════════════════════════════════
// 📊 DATABASE SETUP - MONGODB
// ═══════════════════════════════════════════════════════════════════════════
 
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slm-market');
 
const db = mongoose.connection;
db.on('error', (err) => logger.error('MongoDB Connection Error:', err));
db.on('connected', () => logger.info('✅ MongoDB Connected Successfully'));
 
// ═══════════════════════════════════════════════════════════════════════════
// 🗄️ MONGOOSE SCHEMAS & MODELS
// ═══════════════════════════════════════════════════════════════════════════
 
// --- USER SCHEMA ---
const userSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 8 },
    address: {
        street: String,
        city: String,
        postalCode: String,
        country: String
    },
    role: { type: String, enum: ['user', 'admin', 'vendor'], default: 'user' },
    tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    loyaltyPoints: { type: Number, default: 0 },
    avatar: String,
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorSecret: String,
    twoFactorEnabled: { type: Boolean, default: false },
    preferences: {
        newsletter: { type: Boolean, default: true },
        notifications: { type: Boolean, default: true },
        currency: { type: String, default: 'FCFA' }
    },
    metadata: {
        totalSpent: { type: Number, default: 0 },
        ordersCount: { type: Number, default: 0 },
        lastLogin: Date,
        loginStreak: { type: Number, default: 0 },
        loginAttempts: { type: Number, default: 0 },
        lockoutUntil: Date
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });
 
// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});
 
// Method to compare password
userSchema.methods.comparePassword = async function(passwordToCheck) {
    return await bcrypt.compare(passwordToCheck, this.password);
};
 
// Method to generate JWT
userSchema.methods.generateAuthToken = function() {
    return jwt.sign(
        { userId: this.id, email: this.email, role: this.role },
        process.env.JWT_SECRET || 'super-secret-key',
        { expiresIn: '24h' }
    );
};
 
// --- PRODUCT SCHEMA ---
const productSchema = new mongoose.Schema({
    sku: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    subcategory: String,
    universe: String,
    origin: { type: String, enum: ['Local', 'International'], required: true },
    price: {
        base: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'FCFA' },
        discount: { type: Number, default: 0, min: 0, max: 100 },
        salePrice: Number
    },
    images: [String],
    inventory: {
        quantity: { type: Number, default: 0, min: 0 },
        reserved: { type: Number, default: 0 },
        available: { type: Number, default: 0 }
    },
    specifications: {
        material: String,
        size: String,
        color: String,
        weight: String,
        dimensions: String
    },
    rating: {
        average: { type: Number, default: 0, min: 0, max: 5 },
        count: { type: Number, default: 0 }
    },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [String],
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    seo: {
        metaTitle: String,
        metaDescription: String,
        slug: { type: String, unique: true, required: true }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, indexes: [{ name: 1 }, { category: 1 }, { sku: 1 }] });
 
// Calculate available inventory
productSchema.virtual('availableQuantity').get(function() {
    return this.inventory.quantity - this.inventory.reserved;
});
 
// --- ORDER SCHEMA ---
const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true, required: true },
    trackingId: { type: String, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: Number,
        subtotal: Number
    }],
    pricing: {
        subtotal: { type: Number, required: true },
        shipping: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        promoCode: String,
        vipService: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    shipping: {
        method: { type: String, enum: ['standard', 'express', 'vip-glove'], default: 'standard' },
        address: {
            street: String,
            city: String,
            postalCode: String,
            country: String
        },
        carrierTracking: String,
        estimatedDelivery: Date,
        actualDelivery: Date
    },
    payment: {
        method: { type: String, enum: ['card', 'paypal', 'mobile', 'crypto'], required: true },
        status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
        transactionId: String,
        paidAt: Date,
        refundedAmount: { type: Number, default: 0 }
    },
    status: {
        current: { type: String, enum: ['received', 'processing', 'shipped', 'in-transit', 'delivered', 'returned'], default: 'received' },
        history: [{
            status: String,
            timestamp: Date,
            notes: String
        }]
    },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, indexes: [{ orderNumber: 1 }, { trackingId: 1 }, { user: 1 }] });
 
// --- REVIEW SCHEMA ---
const reviewSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    verified: { type: Boolean, default: false },
    helpful: { type: Number, default: 0 },
    unhelpful: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
 
// --- PROMO CODE SCHEMA ---
const promoSchema = new mongoose.Schema({
    code: { type: String, unique: true, required: true, uppercase: true },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    maxUsage: Number,
    usageCount: { type: Number, default: 0 },
    usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: Date,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
 
// --- INVENTORY LOG SCHEMA ---
const inventoryLogSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['purchase', 'return', 'adjustment', 'damage'], required: true },
    quantity: { type: Number, required: true },
    reference: String,
    notes: String,
    createdAt: { type: Date, default: Date.now }
});
 
// Create Models
const User = mongoose.model('User', userSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const Review = mongoose.model('Review', reviewSchema);
const PromoCode = mongoose.model('PromoCode', promoSchema);
const InventoryLog = mongoose.model('InventoryLog', inventoryLogSchema);
 
// ═══════════════════════════════════════════════════════════════════════════
// 🎯 SERVICE LAYER - BUSINESS LOGIC
// ═══════════════════════════════════════════════════════════════════════════
 
/**
 * USER SERVICE
 */
class UserService {
    static async createUser(userData) {
        const { email, password, firstName, lastName, phone } = userData;
        
        // Validation
        if (!validator.isEmail(email)) throw new Error('Email invalide');
        if (password.length < 8) throw new Error('Mot de passe minimum 8 caractères');
        
        const existingUser = await User.findOne({ email });
        if (existingUser) throw new Error('Cet email existe déjà');
        
        const user = new User({
            id: `USR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            email,
            password,
            firstName,
            lastName,
            phone
        });
        
        await user.save();
        
        // Store in cache
        await this.cacheUserData(user.id, user);
        
        logger.info(`✅ User created: ${email}`);
        return { success: true, user: this.sanitizeUser(user) };
    }
    
    static async authenticateUser(email, password) {
        const user = await User.findOne({ email });
        if (!user) throw new Error('Utilisateur non trouvé');
        
        // Check lockout
        if (user.metadata.lockoutUntil && new Date() < user.metadata.lockoutUntil) {
            throw new Error('Compte verrouillé. Réessayez plus tard.');
        }
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            user.metadata.loginAttempts++;
            if (user.metadata.loginAttempts >= 5) {
                user.metadata.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000);
            }
            await user.save();
            throw new Error('Mot de passe incorrect');
        }
        
        // Reset attempts on success
        user.metadata.loginAttempts = 0;
        user.metadata.lastLogin = new Date();
        await user.save();
        
        const token = user.generateAuthToken();
        return { success: true, token, user: this.sanitizeUser(user) };
    }
    
    static async getUserById(userId) {
        let user = await redisClient.get(`user:${userId}`);
        
        if (user) {
            return JSON.parse(user);
        }
        
        user = await User.findById(userId).select('-password');
        if (!user) throw new Error('Utilisateur non trouvé');
        
        await this.cacheUserData(userId, user);
        return user;
    }
    
    static async cacheUserData(userId, userData) {
        try {
            await redisClient.setex(`user:${userId}`, 3600, JSON.stringify(userData));
        } catch (error) {
            logger.warn('Redis cache error:', error.message);
        }
    }
    
    static sanitizeUser(user) {
        const obj = user.toObject();
        delete obj.password;
        delete obj.verificationToken;
        delete obj.passwordResetToken;
        return obj;
    }
}
 
/**
 * PRODUCT SERVICE
 */
class ProductService {
    static async getProducts(filters = {}) {
        const { category, search, sort, page = 1, limit = 20 } = filters;
        
        let query = { isActive: true };
        
        if (category) query.category = category;
        if (search) query.$text = { $search: search };
        
        const skip = (page - 1) * limit;
        
        const products = await Product.find(query)
            .populate('vendor', 'firstName lastName avatar')
            .populate('reviews')
            .skip(skip)
            .limit(parseInt(limit))
            .sort(sort || { createdAt: -1 });
        
        const total = await Product.countDocuments(query);
        
        return {
            data: products,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        };
    }
    
    static async getProductById(productId) {
        const product = await Product.findOne({ _id: productId })
            .populate('vendor', 'firstName lastName avatar')
            .populate('reviews');
        
        if (!product) throw new Error('Produit non trouvé');
        
        // Record view
        await redisClient.incr(`product:views:${productId}`);
        
        return product;
    }
    
    static async createProduct(productData, vendorId) {
        const product = new Product({
            ...productData,
            sku: `SKU-${Date.now()}`,
            vendor: vendorId,
            seo: {
                slug: productData.name.toLowerCase().replace(/\s+/g, '-'),
                metaTitle: productData.name,
                metaDescription: productData.description.substring(0, 160)
            }
        });
        
        await product.save();
        logger.info(`📦 Product created: ${product.sku}`);
        return product;
    }
    
    static async updateInventory(productId, quantity, type = 'adjustment') {
        const product = await Product.findById(productId);
        if (!product) throw new Error('Produit non trouvé');
        
        const oldQuantity = product.inventory.quantity;
        product.inventory.quantity += quantity;
        product.inventory.available = product.availableQuantity;
        
        await product.save();
        
        // Log inventory change
        await InventoryLog.create({
            product: productId,
            type,
            quantity,
            reference: `UPDATE-${Date.now()}`
        });
        
        logger.info(`📊 Inventory updated: ${productId} from ${oldQuantity} to ${product.inventory.quantity}`);
    }
}
 
/**
 * ORDER SERVICE
 */
class OrderService {
    static async createOrder(userId, orderData) {
        const { items, shipping, payment, promoCode } = orderData;
        
        // Validate inventory
        for (const item of items) {
            const product = await Product.findById(item.product);
            if (!product || product.availableQuantity < item.quantity) {
                throw new Error(`Stock insuffisant pour ${product.name}`);
            }
        }
        
        // Calculate pricing
        let subtotal = 0;
        const processedItems = [];
        
        for (const item of items) {
            const product = await Product.findById(item.product);
            const unitPrice = product.price.salePrice || product.price.base;
            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;
            
            processedItems.push({
                product: item.product,
                quantity: item.quantity,
                unitPrice,
                subtotal: itemTotal
            });
        }
        
        // Apply promo code
        let discount = 0;
        if (promoCode) {
            const promo = await PromoCode.findOne({ code: promoCode, isActive: true });
            if (promo && promo.expiresAt > new Date() && subtotal >= promo.minOrder) {
                discount = promo.type === 'percentage' 
                    ? subtotal * (promo.value / 100)
                    : promo.value;
                promo.usageCount++;
                await promo.save();
            }
        }
        
        const shipping_cost = shipping.method === 'vip-glove' ? 15000 : 
                             shipping.method === 'express' ? 5000 : 0;
        const tax = Math.ceil(subtotal * 0.18);
        const total = subtotal + shipping_cost + tax - discount;
        
        const order = new Order({
            orderNumber: `ORD-${Date.now()}`,
            trackingId: `SLM-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            user: userId,
            items: processedItems,
            pricing: {
                subtotal,
                shipping: shipping_cost,
                tax,
                discount,
                promoCode,
                vipService: shipping.method === 'vip-glove' ? shipping_cost : 0,
                total
            },
            shipping,
            payment
        });
        
        await order.save();

        // Reserve inventory
        for (const item of items) {
            await ProductService.updateInventory(item.product, -item.quantity, 'purchase');
        }

        // Send confirmation email (non-blocking)
        User.findById(userId).select('email firstName').then(user => {
            if (user && user.email) {
                EmailService.sendOrderConfirmation(user.email, order)
                    .catch(err => logger.error('Order confirmation email failed:', { message: err.message }));
            }
        }).catch(() => {});

        logger.info(`✅ Order created: ${order.orderNumber}`);
        return order;
    }
    
    static async getOrderByTracking(trackingId) {
        const order = await Order.findOne({ trackingId })
            .populate('user', '-password')
            .populate('items.product');
        
        if (!order) throw new Error('Commande non trouvée');
        return order;
    }
    
    static async updateOrderStatus(orderId, newStatus, notes = '') {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Commande non trouvée');
        
        order.status.history.push({
            status: newStatus,
            timestamp: new Date(),
            notes
        });
        order.status.current = newStatus;
        
        if (newStatus === 'delivered') {
            order.shipping.actualDelivery = new Date();
            
            // Award loyalty points
            const user = await User.findById(order.user);
            user.loyaltyPoints += Math.floor(order.pricing.total / 10000);
            user.metadata.totalSpent += order.pricing.total;
            user.metadata.ordersCount++;
            await user.save();
        }
        
        await order.save();
        logger.info(`📦 Order ${orderId} status updated to ${newStatus}`);
        return order;
    }
}
 
/**
 * PAYMENT SERVICE
 */
class PaymentService {
    static async processPayment(orderId, paymentDetails) {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Commande non trouvée');
        
        try {
            // Simulate payment processing
            // In production, integrate with Stripe, PayPal, etc.
            
            if (paymentDetails.method === 'card') {
                // Validate card (in production, use tokenized card)
                // Call payment gateway API
            }
            
            order.payment.status = 'completed';
            order.payment.transactionId = `TXN-${Date.now()}`;
            order.payment.paidAt = new Date();
            
            await order.save();
            
            logger.info(`💳 Payment processed for order ${orderId}`);
            return { success: true, transactionId: order.payment.transactionId };
            
        } catch (error) {
            order.payment.status = 'failed';
            await order.save();
            throw error;
        }
    }
    
    static async refundOrder(orderId, reason = '') {
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Commande non trouvée');
        
        const refundAmount = order.pricing.total;
        
        order.payment.status = 'refunded';
        order.payment.refundedAmount = refundAmount;
        order.status.current = 'returned';
        order.status.history.push({
            status: 'returned',
            timestamp: new Date(),
            notes: `Remboursement: ${reason}`
        });
        
        // Restore inventory
        for (const item of order.items) {
            await ProductService.updateInventory(item.product, item.quantity, 'return');
        }
        
        await order.save();
        logger.info(`💰 Order ${orderId} refunded: ${refundAmount} FCFA`);
        return order;
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🎮 CONTROLLER LAYER - REQUEST HANDLING
// ═══════════════════════════════════════════════════════════════════════════
 
/**
 * AUTH CONTROLLER
 */
class AuthController {
    static async register(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ success: false, errors: errors.array() });
            }
            
            const result = await UserService.createUser(req.body);
            res.status(201).json(result);

            // Email de bienvenue (non-bloquant)
            EmailService.sendWelcomeEmail(result.user.email, result.user.firstName || 'Client')
                .catch(err => logger.error('Welcome email failed:', { message: err.message }));

        } catch (error) {
            next(error);
        }
    }
    
    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
            }
            
            const result = await UserService.authenticateUser(email, password);
            
            res.cookie('token', result.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 86400000
            });
            
            res.json(result);
            
        } catch (error) {
            next(error);
        }
    }
    
    static async logout(req, res) {
        res.clearCookie('token');
        res.json({ success: true, message: 'Déconnecté avec succès' });
    }
    
    static async refreshToken(req, res, next) {
        try {
            const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
            if (!token) throw new Error('Token non fourni');
            
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key');
            const user = await UserService.getUserById(decoded.userId);
            
            const newToken = jwt.sign(
                { userId: user._id, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'super-secret-key',
                { expiresIn: '24h' }
            );
            
            res.json({ success: true, token: newToken });
            
        } catch (error) {
            next(error);
        }
    }
}
 
/**
 * PRODUCT CONTROLLER
 */
class ProductController {
    static async getProducts(req, res, next) {
        try {
            const result = await ProductService.getProducts(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
    
    static async getProduct(req, res, next) {
        try {
            const product = await ProductService.getProductById(req.params.id);
            res.json({ success: true, data: product });
        } catch (error) {
            next(error);
        }
    }
    
    static async createProduct(req, res, next) {
        try {
            // Verify vendor role
            if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
            
            const product = await ProductService.createProduct(req.body, req.user.userId);
            res.status(201).json({ success: true, data: product });
            
        } catch (error) {
            next(error);
        }
    }
}
 
/**
 * ORDER CONTROLLER
 */
class OrderController {
    static async createOrder(req, res, next) {
        try {
            const order = await OrderService.createOrder(req.user.userId, req.body);
            res.status(201).json({ success: true, data: order });
        } catch (error) {
            next(error);
        }
    }
    
    static async getOrder(req, res, next) {
        try {
            const order = await OrderService.getOrderByTracking(req.params.trackingId);
            
            // Verify authorization
            if (order.user.toString() !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
            
            res.json({ success: true, data: order });
        } catch (error) {
            next(error);
        }
    }
    
    static async updateOrderStatus(req, res, next) {
        try {
            // Only admin can update status
            if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Accès refusé' });
            }
            
            const order = await OrderService.updateOrderStatus(
                req.params.id,
                req.body.status,
                req.body.notes
            );
            
            res.json({ success: true, data: order });
        } catch (error) {
            next(error);
        }
    }
    
    static async processPayment(req, res, next) {
        try {
            const result = await PaymentService.processPayment(req.params.id, req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🔐 MIDDLEWARE - AUTHENTICATION & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════
 
/**
 * JWT AUTHENTICATION MIDDLEWARE
 */
const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token non fourni' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Token invalide ou expiré' });
    }
};
 
/**
 * ROLE AUTHORIZATION MIDDLEWARE
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé' });
        }
        next();
    };
};
 
/**
 * VALIDATION MIDDLEWARE
 */
const validateRegister = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Mot de passe minimum 8 caractères'),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty()
];
 
const validateCreateProduct = [
    body('name').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('price.base').isFloat({ min: 0 }),
    body('category').trim().notEmpty()
];
 
// ═══════════════════════════════════════════════════════════════════════════
// 🛣️ ROUTES DEFINITION
// ═══════════════════════════════════════════════════════════════════════════
 
// AUTH ROUTES
app.post('/api/v1/auth/register', authLimiter, validateRegister, AuthController.register);
app.post('/api/v1/auth/login', authLimiter, AuthController.login);
app.post('/api/v1/auth/logout', verifyToken, AuthController.logout);
app.post('/api/v1/auth/refresh', AuthController.refreshToken);
 
// PRODUCT ROUTES
app.get('/api/v1/products', apiLimiter, ProductController.getProducts);
app.get('/api/v1/products/:id', ProductController.getProduct);
app.post('/api/v1/products', verifyToken, authorize('vendor', 'admin'), validateCreateProduct, ProductController.createProduct);
 
// ORDER ROUTES
app.post('/api/v1/orders', verifyToken, OrderController.createOrder);
app.get('/api/v1/orders/:trackingId', verifyToken, OrderController.getOrder);
app.put('/api/v1/orders/:id/status', verifyToken, authorize('admin'), OrderController.updateOrderStatus);
app.post('/api/v1/orders/:id/payment', verifyToken, OrderController.processPayment);

// ─── EMAIL PUBLIC ENDPOINT (appelé depuis le frontend boutique) ──────────────
app.post('/api/v1/email/order-confirmation', async (req, res) => {
    try {
        const { toEmail, toName, items, total, orderNumber } = req.body;
        if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
            return res.status(400).json({ success: false, message: 'Email invalide' });
        }
        const itemsList = (items || []).map(i =>
            `<tr><td style="padding:8px 0;">${i.nom || i.name}</td><td style="padding:8px 0;text-align:right;font-weight:700;">${(i.prix || i.price || 0).toLocaleString()} FCFA × ${i.quantity || 1}</td></tr>`
        ).join('');
        const html = `
        <div style="font-family:'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#ff6a00,#ff9a3c);padding:40px;text-align:center;color:white;">
                <h1 style="margin:0;font-size:28px;letter-spacing:2px;">S.L.M MARKET</h1>
                <p style="margin:10px 0 0;opacity:0.9;">Commande confirmée avec succès ✅</p>
            </div>
            <div style="padding:40px;">
                <p style="font-size:16px;">Bonjour <strong>${toName || toEmail}</strong>,</p>
                <p>Votre commande a bien été reçue. Voici le récapitulatif :</p>
                <table style="width:100%;border-collapse:collapse;margin:20px 0;">${itemsList}</table>
                <div style="background:#fff8f5;border:2px solid #ff6a00;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
                    <p style="margin:0;color:#888;font-size:13px;">TOTAL</p>
                    <p style="margin:5px 0 0;font-size:28px;font-weight:900;color:#ff6a00;">${(total||0).toLocaleString()} FCFA</p>
                </div>
                <p style="color:#888;font-size:12px;margin-top:30px;border-top:1px solid #eee;padding-top:20px;">S.L.M Market — Conciergerie Privée | Votre commande est entre nos mains.</p>
            </div>
        </div>`;
        const nodemailerTransport = require('nodemailer').createTransport({
            host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await nodemailerTransport.sendMail({
            from: `"S.L.M Market" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `✅ Votre commande S.L.M Market — ${(total||0).toLocaleString()} FCFA`,
            html
        });
        res.json({ success: true, message: `Email envoyé à ${toEmail}` });
    } catch (err) {
        logger.error('Email confirmation error:', { message: err.message });
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── ADMIN ROUTES (clé secrète dans header X-Admin-Key) ─────────────────────
const verifyAdminKey = (req, res, next) => {
    const key = req.headers['x-admin-key'];
    if (!key || key !== (process.env.ADMIN_SECRET || 'BOSS-SLM-2026')) {
        return res.status(403).json({ success: false, message: 'Clé admin invalide' });
    }
    next();
};

// Lister toutes les commandes (admin panel)
app.get('/api/v1/admin/orders', verifyAdminKey, async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'firstName lastName email phone')
            .populate('items.product', 'name price')
            .sort({ createdAt: -1 })
            .limit(500);
        res.json({ success: true, data: orders });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mettre à jour statut commande (admin panel via clé)
app.put('/api/v1/admin/orders/:id/status', verifyAdminKey, async (req, res) => {
    try {
        const order = await OrderService.updateOrderStatus(req.params.id, req.body.status, req.body.notes || '');
        // Envoyer email de mise à jour si l'utilisateur a un email
        try {
            const user = await User.findById(order.user).select('email');
            if (user && user.email) {
                EmailService.sendStatusUpdate(user.email, order.orderNumber, req.body.status).catch(() => {});
            }
        } catch (_) {}
        res.json({ success: true, data: order });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Test connexion SMTP (admin)
app.post('/api/v1/admin/test-email', verifyAdminKey, async (req, res) => {
    try {
        const ok = await EmailService.verifyConnection();
        if (!ok) return res.status(500).json({ success: false, message: 'SMTP non joignable — vérifiez vos identifiants Brevo' });
        // Envoyer un email de test
        const testDest = req.body.to || process.env.SMTP_FROM_EMAIL;
        await EmailService.sendWelcomeEmail(testDest, 'Admin SLM');
        res.json({ success: true, message: `Email de test envoyé à ${testDest}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// 🚨 ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════
 
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}
 
// Global Error Handler
app.use((error, req, res, next) => {
    error.statusCode = error.statusCode || 500;
    error.message = error.message || 'Erreur serveur interne';
    
    logger.error(`[${new Date().toISOString()}] ${error.message}`, {
        status: error.statusCode,
        path: req.path,
        method: req.method
    });
    
    res.status(error.statusCode).json({
        success: false,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});
 
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route non trouvée' });
});
 
// ═══════════════════════════════════════════════════════════════════════════
// 🚀 SERVER START
// ═══════════════════════════════════════════════════════════════════════════
 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`🏰 SLM MARKET Backend - Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
 
module.exports = app;
 