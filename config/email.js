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

// ── Shared header / footer ────────────────────────────────────────────────────
const header = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ff6a00;border-radius:12px 12px 0 0;">
  <tr>
    <td style="padding:32px 40px;">
      <h1 style="margin:0;color:#fff;font-size:28px;letter-spacing:1px;font-family:'Georgia',serif;">
        S.L.M Market
      </h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:2px;text-transform:uppercase;">
        Conciergerie Privée
      </p>
    </td>
  </tr>
</table>`;

const footer = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:0 0 12px 12px;margin-top:0;">
  <tr>
    <td style="padding:24px 40px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;">
        © 2026 S.L.M Market — Conciergerie Privée · Côte d'Ivoire
      </p>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.3);font-size:11px;">
        Cet email vous a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </td>
  </tr>
</table>`;

const wrapper = (content) => `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;max-width:600px;">
          <tr><td>${header}</td></tr>
          <tr><td style="padding:40px;">${content}</td></tr>
          <tr><td>${footer}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// ── Email Service ─────────────────────────────────────────────────────────────
const EmailService = {

    /**
     * Send order confirmation email
     */
    async sendOrderConfirmation(userEmail, order) {
        const itemsRows = (order.items || []).map(item => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;">
                ${item.name || item.product?.name || 'Produit'}
                <span style="color:#888;font-size:12px;">× ${item.quantity}</span>
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;
                         font-weight:700;color:#1a1a2e;font-size:14px;white-space:nowrap;">
                ${(item.price || 0).toLocaleString('fr-FR')} FCFA
              </td>
            </tr>`).join('');

        const content = `
            <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;">Commande confirmée ✓</h2>
            <p style="margin:0 0 28px;color:#666;font-size:15px;">
              Merci pour votre confiance ! Votre commande a bien été reçue.
            </p>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#fff8f3;border:1px solid #ffe0cc;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;color:#888;font-size:13px;width:140px;">Numéro commande</td>
                      <td style="padding:4px 0;color:#1a1a2e;font-weight:700;font-size:14px;">${order.orderNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#888;font-size:13px;">Tracking ID</td>
                      <td style="padding:4px 0;color:#ff6a00;font-weight:700;font-size:14px;letter-spacing:1px;">${order.trackingId}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#888;font-size:13px;">Statut</td>
                      <td style="padding:4px 0;">
                        <span style="background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:700;
                                     padding:3px 10px;border-radius:20px;">En traitement</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Articles -->
            ${itemsRows ? `
            <h3 style="margin:0 0 12px;color:#1a1a2e;font-size:15px;text-transform:uppercase;letter-spacing:1px;">
              Détail de la commande
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              ${itemsRows}
            </table>` : ''}

            <!-- Total -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#1a1a2e;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 24px;color:rgba(255,255,255,0.7);font-size:14px;">Total payé</td>
                <td style="padding:16px 24px;text-align:right;color:#ff6a00;
                           font-size:20px;font-weight:700;white-space:nowrap;">
                  ${(order.pricing?.total || 0).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#666;font-size:13px;line-height:1.7;">
              Vous serez notifié par email à chaque étape de votre livraison.<br>
              Pour suivre votre commande, utilisez votre <strong>Tracking ID : ${order.trackingId}</strong>.
            </p>`;

        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `✓ Commande ${order.orderNumber} confirmée — S.L.M Market`,
            html: wrapper(content)
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Order confirmation sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email sendOrderConfirmation error:', { message: error.message });
            throw error;
        }
    },

    /**
     * Send welcome email after registration
     */
    async sendWelcomeEmail(userEmail, firstName) {
        const content = `
            <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;">Bienvenue, ${firstName} !</h2>
            <p style="margin:0 0 28px;color:#666;font-size:15px;">
              Votre compte S.L.M Market a été créé avec succès. Vous faites maintenant partie
              d'une expérience shopping exclusive en Côte d'Ivoire.
            </p>

            <!-- Avantages -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="padding:12px 16px;background:#fff8f3;border-radius:8px 8px 0 0;
                           border:1px solid #ffe0cc;border-bottom:none;">
                  <span style="font-size:20px;">🛍️</span>
                  <strong style="color:#1a1a2e;font-size:14px;margin-left:8px;">Catalogue exclusif</strong>
                  <p style="margin:4px 0 0 36px;color:#666;font-size:13px;">
                    Des produits sélectionnés avec soin pour vous.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;background:#fff8f3;
                           border:1px solid #ffe0cc;border-top:none;border-bottom:none;">
                  <span style="font-size:20px;">📦</span>
                  <strong style="color:#1a1a2e;font-size:14px;margin-left:8px;">Suivi en temps réel</strong>
                  <p style="margin:4px 0 0 36px;color:#666;font-size:13px;">
                    Suivez vos commandes étape par étape.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px;background:#fff8f3;border-radius:0 0 8px 8px;
                           border:1px solid #ffe0cc;border-top:none;">
                  <span style="font-size:20px;">💎</span>
                  <strong style="color:#1a1a2e;font-size:14px;margin-left:8px;">Programme fidélité</strong>
                  <p style="margin:4px 0 0 36px;color:#666;font-size:13px;">
                    Gagnez des points à chaque achat.
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:28px;">
              <a href="http://localhost:5000"
                 style="display:inline-block;background:#ff6a00;color:#fff;
                        text-decoration:none;padding:14px 40px;border-radius:8px;
                        font-size:15px;font-weight:700;letter-spacing:0.5px;">
                Découvrir le catalogue →
              </a>
            </div>

            <p style="margin:0;color:#aaa;font-size:13px;text-align:center;">
              Des questions ? Contactez notre support via le chat sur le site.
            </p>`;

        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `Bienvenue sur S.L.M Market, ${firstName} !`,
            html: wrapper(content)
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Welcome email sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email sendWelcomeEmail error:', { message: error.message });
            throw error;
        }
    },

    /**
     * Send order status update email
     */
    async sendStatusUpdate(userEmail, orderNumber, status) {
        const statusConfig = {
            processing: {
                label: 'En traitement',
                icon: '⚙️',
                color: '#1565c0',
                bg: '#e3f2fd',
                message: 'Notre équipe prépare votre commande avec soin.'
            },
            shipped: {
                label: 'Expédiée',
                icon: '🚚',
                color: '#6a1b9a',
                bg: '#f3e5f5',
                message: 'Votre commande est en route vers vous !'
            },
            'in-transit': {
                label: 'En transit',
                icon: '📍',
                color: '#e65100',
                bg: '#fff3e0',
                message: 'Votre commande est proche de sa destination.'
            },
            delivered: {
                label: 'Livrée',
                icon: '✅',
                color: '#2e7d32',
                bg: '#e8f5e9',
                message: 'Votre commande a été livrée. Merci de votre confiance !'
            }
        };

        const cfg = statusConfig[status] || {
            label: status,
            icon: '📦',
            color: '#333',
            bg: '#f5f5f5',
            message: 'Le statut de votre commande a été mis à jour.'
        };

        const content = `
            <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:22px;">Mise à jour de commande</h2>
            <p style="margin:0 0 28px;color:#666;font-size:15px;">
              Votre commande <strong>${orderNumber}</strong> vient d'être mise à jour.
            </p>

            <!-- Statut card -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:${cfg.bg};border:1px solid ${cfg.color}33;
                          border-radius:12px;margin-bottom:28px;">
              <tr>
                <td style="padding:28px;text-align:center;">
                  <div style="font-size:48px;margin-bottom:12px;">${cfg.icon}</div>
                  <div style="display:inline-block;background:${cfg.color};color:#fff;
                              font-size:14px;font-weight:700;letter-spacing:1px;text-transform:uppercase;
                              padding:8px 24px;border-radius:20px;margin-bottom:12px;">
                    ${cfg.label}
                  </div>
                  <p style="margin:0;color:#555;font-size:14px;">${cfg.message}</p>
                </td>
              </tr>
            </table>

            <!-- Commande ref -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f9f9f9;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:16px 24px;color:#888;font-size:13px;">Numéro de commande</td>
                <td style="padding:16px 24px;text-align:right;color:#1a1a2e;
                           font-weight:700;font-size:14px;">${orderNumber}</td>
              </tr>
            </table>

            <p style="margin:0;color:#aaa;font-size:13px;text-align:center;">
              Pour toute question, contactez notre support depuis votre espace client.
            </p>`;

        const mailOptions = {
            from: `"S.L.M Market" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: userEmail,
            subject: `${cfg.icon} Commande ${orderNumber} — ${cfg.label}`,
            html: wrapper(content)
        };

        try {
            await transporter.sendMail(mailOptions);
            logger.info(`📧 Status update email sent to ${userEmail}`);
        } catch (error) {
            logger.error('Email sendStatusUpdate error:', { message: error.message });
            throw error;
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
