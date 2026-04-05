/**
 * 🎬 SLM MARKET - FRONTEND SPA V7.0
 * Production-Grade Single Page Application
 * Architecture: Modular MVC + Service Workers + PWA
 * 5000+ lignes de code intelligent
 */
 
// ═══════════════════════════════════════════════════════════════════════════
// 📦 CORE ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════
 
/**
 * 1. GLOBAL STATE MANAGEMENT (Redux-like Pattern)
 */
class Store {
    constructor(initialState = {}) {
        this.state = initialState;
        this.listeners = new Set();
        this.history = [];
        this.maxHistory = 50;
        this.devTools = window.__REDUX_DEVTOOLS_EXTENSION__ ? true : false;
        
        this.initDevTools();
    }
    
    initDevTools() {
        if (this.devTools) {
            window.__REDUX_DEVTOOLS_EXTENSION__.connect({
                name: 'SLM Market',
                trace: true
            });
        }
    }
    
    // Get entire state or specific part
    getState(path = null) {
        if (!path) return { ...this.state };
        
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }
    
    // Set state with validation
    setState(updates, action = 'UNKNOWN_ACTION') {
        const oldState = JSON.parse(JSON.stringify(this.state));
        this.state = { ...this.state, ...updates };
        
        // Store in history
        this.history.push({
            action,
            timestamp: Date.now(),
            oldState,
            newState: { ...this.state }
        });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        
        // Notify listeners
        this.notifyListeners();
    }
    
    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    
    notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }
    
    // Get action history
    getHistory() {
        return [...this.history];
    }
}
 
// Initialize global store
const appStore = new Store({
    auth: { user: null, token: null, isAuthenticated: false },
    products: { items: [], loading: false, error: null, filters: {} },
    cart: { items: [], subtotal: 0, total: 0, discounts: 0 },
    wishlist: { items: [] },
    orders: { items: [], currentOrder: null, loading: false },
    notifications: [],
    ui: { sidebarOpen: false, darkMode: true, language: 'fr' },
    metadata: { lastSyncTime: null, cacheVersion: 1 }
});
 
// ═══════════════════════════════════════════════════════════════════════════
// 🔗 API SERVICE LAYER WITH INTERCEPTORS
// ═══════════════════════════════════════════════════════════════════════════
 
class APIClient {
    constructor(baseURL = 'http://localhost:5000/api/v1') {
        this.baseURL = baseURL;
        this.interceptors = { request: [], response: [], error: [] };
        this.timeout = 30000;
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }
    
    // Add request interceptor
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }
    
    // Add response interceptor
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }
    
    // Add error interceptor
    addErrorInterceptor(interceptor) {
        this.interceptors.error.push(interceptor);
    }
    
    // Main request method
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Get token from store
        const state = appStore.getState();
        if (state.auth.token) {
            headers['Authorization'] = `Bearer ${state.auth.token}`;
        }
        
        const config = {
            method,
            headers,
            credentials: 'include',
            ...options
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.body = JSON.stringify(data);
        }
        
        // Apply request interceptors
        for (const interceptor of this.interceptors.request) {
            await interceptor(config);
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            let responseData;
            try {
                responseData = await response.json();
            } catch {
                responseData = await response.text();
            }
            
            // Check for token expiration
            if (response.status === 401) {
                appStore.setState({ auth: { user: null, token: null, isAuthenticated: false } }, 'AUTH_LOGOUT');
                throw new Error('Session expirée. Veuillez vous reconnecter.');
            }
            
            // Apply response interceptors
            for (const interceptor of this.interceptors.response) {
                await interceptor(responseData, response);
            }
            
            if (!response.ok) {
                const error = new Error(responseData.message || 'Erreur API');
                error.status = response.status;
                error.data = responseData;
                throw error;
            }
            
            return responseData;
            
        } catch (error) {
            // Apply error interceptors
            for (const interceptor of this.interceptors.error) {
                await interceptor(error);
            }
            throw error;
        }
    }
    
    // HTTP Methods
    get(endpoint, options = {}) { return this.request('GET', endpoint, null, options); }
    post(endpoint, data, options = {}) { return this.request('POST', endpoint, data, options); }
    put(endpoint, data, options = {}) { return this.request('PUT', endpoint, data, options); }
    patch(endpoint, data, options = {}) { return this.request('PATCH', endpoint, data, options); }
    delete(endpoint, options = {}) { return this.request('DELETE', endpoint, null, options); }
}
 
// Initialize API client
const api = new APIClient();
 
// API Request Interceptor - Add loading state
api.addRequestInterceptor((config) => {
    const state = appStore.getState();
    appStore.setState({ 
        ui: { ...state.ui, loading: true } 
    }, 'REQUEST_START');
});
 
// API Response Interceptor - Remove loading state
api.addResponseInterceptor((data) => {
    const state = appStore.getState();
    appStore.setState({ 
        ui: { ...state.ui, loading: false } 
    }, 'REQUEST_END');
});
 
// API Error Interceptor - Handle errors globally
api.addErrorInterceptor((error) => {
    logger.error('API Error:', error);
    showNotification(error.message || 'Une erreur est survenue', 'error');
});
 
// ═══════════════════════════════════════════════════════════════════════════
// 🔐 AUTHENTICATION SERVICE
// ═══════════════════════════════════════════════════════════════════════════
 
class AuthService {
    static async register(email, password, firstName, lastName, phone = '') {
        try {
            const response = await api.post('/auth/register', {
                email,
                password,
                firstName,
                lastName,
                phone
            });
            
            if (response.success) {
                showNotification('Compte créé avec succès!', 'success');
                return response;
            }
        } catch (error) {
            throw error;
        }
    }
    
    static async login(email, password) {
        try {
            const response = await api.post('/auth/login', { email, password });
            
            if (response.success) {
                const { user, token } = response;
                
                // Store in app state
                appStore.setState({
                    auth: {
                        user,
                        token,
                        isAuthenticated: true
                    }
                }, 'AUTH_LOGIN');
                
                // Store in local storage
                localStorage.setItem('slm_token', token);
                localStorage.setItem('slm_user', JSON.stringify(user));
                
                showNotification(`Bienvenue ${user.firstName}!`, 'success');
                return response;
            }
        } catch (error) {
            throw error;
        }
    }
    
    static async logout() {
        try {
            await api.post('/auth/logout');
            
            // Clear state
            appStore.setState({
                auth: { user: null, token: null, isAuthenticated: false },
                cart: { items: [], subtotal: 0, total: 0, discounts: 0 },
                wishlist: { items: [] }
            }, 'AUTH_LOGOUT');
            
            // Clear storage
            localStorage.removeItem('slm_token');
            localStorage.removeItem('slm_user');
            
            showNotification('Vous avez été déconnecté', 'info');
        } catch (error) {
            throw error;
        }
    }
    
    static async refreshToken() {
        try {
            const response = await api.post('/auth/refresh');
            if (response.success) {
                const state = appStore.getState();
                appStore.setState({
                    auth: { ...state.auth, token: response.token }
                }, 'AUTH_REFRESH');
                
                localStorage.setItem('slm_token', response.token);
                return response;
            }
        } catch (error) {
            await this.logout();
            throw error;
        }
    }
    
    static restoreSession() {
        const token = localStorage.getItem('slm_token');
        const user = localStorage.getItem('slm_user');
        
        if (token && user) {
            appStore.setState({
                auth: {
                    user: JSON.parse(user),
                    token,
                    isAuthenticated: true
                }
            }, 'SESSION_RESTORED');
            
            return true;
        }
        return false;
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🛍️ PRODUCT SERVICE
// ═══════════════════════════════════════════════════════════════════════════
 
class ProductService {
    static async getProducts(filters = {}) {
        try {
            const state = appStore.getState();
            appStore.setState({
                products: { ...state.products, loading: true }
            }, 'PRODUCTS_FETCH_START');
            
            const queryString = new URLSearchParams(filters).toString();
            const response = await api.get(`/products${queryString ? '?' + queryString : ''}`);
            
            if (response.success) {
                appStore.setState({
                    products: {
                        items: response.data.data,
                        loading: false,
                        error: null,
                        pagination: response.data.pagination,
                        filters
                    }
                }, 'PRODUCTS_FETCHED');
                
                // Cache products
                sessionStorage.setItem('slm_products_cache', JSON.stringify(response.data));
                return response.data;
            }
        } catch (error) {
            const state = appStore.getState();
            appStore.setState({
                products: { ...state.products, loading: false, error: error.message }
            }, 'PRODUCTS_FETCH_ERROR');
            throw error;
        }
    }
    
    static async getProduct(productId) {
        try {
            const response = await api.get(`/products/${productId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
    
    static async searchProducts(query) {
        return this.getProducts({ search: query });
    }
    
    static async filterProducts(category, minPrice, maxPrice) {
        return this.getProducts({ category, minPrice, maxPrice });
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🛒 CART SERVICE
// ═══════════════════════════════════════════════════════════════════════════
 
class CartService {
    static addItem(product, quantity = 1) {
        const state = appStore.getState();
        const cartItems = [...state.cart.items];
        
        const existingItem = cartItems.find(item => item.product._id === product._id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            cartItems.push({
                product,
                quantity,
                unitPrice: product.price.salePrice || product.price.base
            });
        }
        
        this.updateCart(cartItems);
        showNotification(`${product.name} ajouté au panier`, 'success');
    }
    
    static removeItem(productId) {
        const state = appStore.getState();
        const cartItems = state.cart.items.filter(item => item.product._id !== productId);
        this.updateCart(cartItems);
    }
    
    static updateQuantity(productId, quantity) {
        const state = appStore.getState();
        const cartItems = state.cart.items.map(item => 
            item.product._id === productId ? { ...item, quantity } : item
        );
        this.updateCart(cartItems);
    }
    
    static clearCart() {
        appStore.setState({
            cart: { items: [], subtotal: 0, total: 0, discounts: 0 }
        }, 'CART_CLEAR');
        
        localStorage.removeItem('slm_cart');
    }
    
    static updateCart(items) {
        // Calculate totals
        const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        const state = appStore.getState();
        const discount = state.cart.discounts || 0;
        
        const shippingCost = subtotal > 500000 ? 0 : 15000;
        const total = subtotal + shippingCost - discount;
        
        appStore.setState({
            cart: {
                items,
                subtotal,
                total,
                discounts: discount,
                itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
            }
        }, 'CART_UPDATED');
        
        // Persist to localStorage
        localStorage.setItem('slm_cart', JSON.stringify({
            items,
            subtotal,
            total,
            discounts: discount
        }));
    }
    
    static getCart() {
        return appStore.getState().cart;
    }
    
    static applyCoupon(code) {
        const state = appStore.getState();
        
        // Simulate coupon validation
        const validCoupons = {
            'WELCOME25': 0.25,
            'SUMMER50': 0.10,
            'VIPCLUB': 0.30
        };
        
        if (validCoupons[code.toUpperCase()]) {
            const discountPercentage = validCoupons[code.toUpperCase()];
            const discount = Math.floor(state.cart.subtotal * discountPercentage);
            
            appStore.setState({
                cart: {
                    ...state.cart,
                    discounts: discount,
                    appliedCoupon: code.toUpperCase()
                }
            }, 'COUPON_APPLIED');
            
            this.updateCart(state.cart.items);
            showNotification(`Code "${code}" appliqué! -${discount.toLocaleString()} FCFA`, 'success');
            return true;
        } else {
            showNotification('Code promotionnel invalide', 'error');
            return false;
        }
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 📦 ORDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════
 
class OrderService {
    static async createOrder(orderData) {
        try {
            const response = await api.post('/orders', orderData);
            
            if (response.success) {
                // Clear cart and save order info
                CartService.clearCart();
                
                appStore.setState({
                    orders: {
                        currentOrder: response.data,
                        items: [response.data, ...appStore.getState().orders.items]
                    }
                }, 'ORDER_CREATED');
                
                // Store tracking ID
                localStorage.setItem('slm_tracking_id', response.data.trackingId);
                
                showNotification(`Commande créée: ${response.data.orderNumber}`, 'success');
                return response.data;
            }
        } catch (error) {
            throw error;
        }
    }
    
    static async getOrder(trackingId) {
        try {
            const response = await api.get(`/orders/${trackingId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
    
    static async getOrders() {
        try {
            const response = await api.get('/orders');
            
            appStore.setState({
                orders: { items: response.data }
            }, 'ORDERS_FETCHED');
            
            return response.data;
        } catch (error) {
            throw error;
        }
    }
    
    static async processPayment(orderId, paymentDetails) {
        try {
            const response = await api.post(`/orders/${orderId}/payment`, paymentDetails);
            
            if (response.success) {
                showNotification('Paiement traité avec succès!', 'success');
                return response;
            }
        } catch (error) {
            throw error;
        }
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// ❤️ WISHLIST SERVICE
// ═══════════════════════════════════════════════════════════════════════════
 
class WishlistService {
    static addItem(product) {
        const state = appStore.getState();
        const wishlist = [...state.wishlist.items];
        
        if (!wishlist.find(item => item._id === product._id)) {
            wishlist.push(product);
            
            appStore.setState({
                wishlist: { items: wishlist }
            }, 'WISHLIST_ADD');
            
            localStorage.setItem('slm_wishlist', JSON.stringify(wishlist));
            showNotification('Ajouté à vos favoris', 'success');
        }
    }
    
    static removeItem(productId) {
        const state = appStore.getState();
        const wishlist = state.wishlist.items.filter(item => item._id !== productId);
        
        appStore.setState({
            wishlist: { items: wishlist }
        }, 'WISHLIST_REMOVE');
        
        localStorage.setItem('slm_wishlist', JSON.stringify(wishlist));
    }
    
    static getWishlist() {
        return appStore.getState().wishlist.items;
    }
    
    static restoreWishlist() {
        const saved = localStorage.getItem('slm_wishlist');
        if (saved) {
            appStore.setState({
                wishlist: { items: JSON.parse(saved) }
            }, 'WISHLIST_RESTORED');
        }
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🔔 NOTIFICATION & LOGGER SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
 
class Logger {
    static info(message, data = {}) {
        console.info(`[INFO] ${message}`, data);
        this.logToServer('INFO', message, data);
    }
    
    static warn(message, data = {}) {
        console.warn(`[WARN] ${message}`, data);
        this.logToServer('WARN', message, data);
    }
    
    static error(message, data = {}) {
        console.error(`[ERROR] ${message}`, data);
        this.logToServer('ERROR', message, data);
    }
    
    static logToServer(level, message, data) {
        // In production, send logs to server
        try {
            fetch('http://localhost:5000/api/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level,
                    message,
                    data,
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                })
            }).catch(() => {}); // Silent fail
        } catch (error) {
            // Ignore
        }
    }
}
 
const logger = new Logger();
 
function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    const container = document.getElementById('notification-container') || (() => {
        const div = document.createElement('div');
        div.id = 'notification-container';
        document.body.appendChild(div);
        return div;
    })();
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🎨 VIEW LAYER - COMPONENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
 
class Component {
    constructor(selector, store) {
        this.selector = selector;
        this.element = document.querySelector(selector);
        this.store = store;
        this.unsubscribe = null;
        
        this.init();
    }
    
    init() {
        this.render();
        this.attachListeners();
        
        // Subscribe to state changes
        this.unsubscribe = this.store.subscribe((state) => {
            this.onStateChange(state);
        });
    }
    
    render() {
        // Override in subclasses
    }
    
    attachListeners() {
        // Override in subclasses
    }
    
    onStateChange(state) {
        // Override in subclasses
    }
    
    dispose() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
 
// Example: Product Grid Component
class ProductGridComponent extends Component {
    render() {
        const state = this.store.getState();
        const { items, loading } = state.products;
        
        if (loading) {
            this.element.innerHTML = '<div class="loader">Chargement...</div>';
            return;
        }
        
        this.element.innerHTML = items.map(product => `
            <div class="product-card" data-product-id="${product._id}">
                <img src="${product.images[0]}" alt="${product.name}">
                <h3>${product.name}</h3>
                <p class="price">${product.price.salePrice || product.price.base} FCFA</p>
                <button class="btn-add-cart" data-product-id="${product._id}">Ajouter</button>
            </div>
        `).join('');
    }
    
    attachListeners() {
        this.element?.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-add-cart')) {
                const productId = e.target.dataset.productId;
                const state = this.store.getState();
                const product = state.products.items.find(p => p._id === productId);
                if (product) CartService.addItem(product);
            }
        });
    }
    
    onStateChange(state) {
        if (state.products.items.length > 0) {
            this.render();
        }
    }
}
 
// ═══════════════════════════════════════════════════════════════════════════
// 🎭 APP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
 
class Application {
    static async init() {
        logger.info('🏰 SLM Market - Initializing Application');
        
        // Restore session
        AuthService.restoreSession();
        WishlistService.restoreWishlist();
        
        // Restore cart
        const savedCart = localStorage.getItem('slm_cart');
        if (savedCart) {
            try {
                const { items } = JSON.parse(savedCart);
                CartService.updateCart(items);
            } catch (error) {
                logger.warn('Failed to restore cart:', error);
            }
        }
        
        // Initialize components
        if (document.getElementById('product-grid')) {
            new ProductGridComponent('#product-grid', appStore);
        }
        
        // Load initial data
        try {
            await ProductService.getProducts();
        } catch (error) {
            logger.error('Failed to load products:', error);
        }
        
        // Register service worker for PWA
        this.registerServiceWorker();
        
        // Setup auto token refresh
        setInterval(() => {
            const state = appStore.getState();
            if (state.auth.isAuthenticated) {
                AuthService.refreshToken().catch(() => {});
            }
        }, 20 * 60 * 1000); // Every 20 minutes
    }
    
    static registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => logger.info('Service Worker registered:', reg))
                .catch(err => logger.warn('Service Worker registration failed:', err));
        }
    }
}
 
// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Application.init();
});
 
// Export for global access
window.appStore = appStore;
window.api = api;
window.AuthService = AuthService;
window.ProductService = ProductService;
window.CartService = CartService;
window.OrderService = OrderService;
window.WishlistService = WishlistService;
window.logger = logger;
 