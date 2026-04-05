/**
 * SLM MARKET - Email Configuration (Brevo / Nodemailer)
 * Transactional email service
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const EmailService = {
    /**
     * Send order confirmation email
     */
    async sendOrderConfirmation(userEmail, order) {
        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `Confirmation de commande ${order.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #ff6a00;">S.L.M Market</h1>
                    <h2>Votre commande est confirmée !</h2>
                    <p>Numéro de commande: <strong>${order.orderNumber}</strong></p>
                    <p>Tracking ID: <strong>${order.trackingId}</strong></p>
                    <p>Total: <strong>${order.pricing.total.toLocaleString()} FCFA</strong></p>
                    <hr>
                    <p style="color: #888; font-size: 12px;">S.L.M Market — Conciergerie Privée</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Order confirmation sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email send error:', { message: error.message });
        }
    },

    /**
     * Send welcome email after registration
     */
    async sendWelcomeEmail(userEmail, firstName) {
        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: 'Bienvenue sur S.L.M Market',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #ff6a00;">Bienvenue, ${firstName} !</h1>
                    <p>Votre compte S.L.M Market a été créé avec succès.</p>
                    <p>Découvrez notre catalogue de produits exclusifs.</p>
                    <hr>
                    <p style="color: #888; font-size: 12px;">S.L.M Market — Conciergerie Privée</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Welcome email sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email send error:', { message: error.message });
        }
    },

    /**
     * Send order status update email
     */
    async sendStatusUpdate(userEmail, orderNumber, status) {
        const statusLabels = {
            processing: 'En traitement',
            shipped: 'Expédiée',
            'in-transit': 'En transit',
            delivered: 'Livrée'
        };

        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `Mise à jour commande ${orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #ff6a00;">S.L.M Market</h1>
                    <p>Votre commande <strong>${orderNumber}</strong> est maintenant:
                       <strong>${statusLabels[status] || status}</strong></p>
                    <hr>
                    <p style="color: #888; font-size: 12px;">S.L.M Market — Conciergerie Privée</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Status update email sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email send error:', { message: error.message });
        }
    },

    /**
     * Verify SMTP connection
     */
    async verifyConnection() {
        try {
            await transporter.verify();
            logger.info('✅ SMTP connection verified');
            return true;
        } catch (error) {
            logger.warn('SMTP not available:', { message: error.message });
            return false;
        }
    }
};

module.exports = EmailService;
