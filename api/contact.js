/* ============================================
   /api/contact.js — Serverless Function Vercel
   Reçoit le formulaire, valide, envoie un email via Resend
   ============================================
   À placer dans /api/contact.js (à la racine du projet)
   Variables d'environnement requises (à définir sur Vercel) :
     - RESEND_API_KEY      (clé API Resend)
     - CONTACT_TO_EMAIL    (email qui reçoit les messages)
     - CONTACT_FROM_EMAIL  (email expéditeur, doit être validé chez Resend)
     - TURNSTILE_SECRET    (optionnel, secret Cloudflare Turnstile)
   ============================================ */
import {
    readMessages,
    writeMessages,
    generateMessageId
} from './_helpers.js';

export const config = {
    runtime: 'nodejs'
};

export default async function handler(req, res) {

    // === CORS (autorise uniquement le site officiel) ===
    res.setHeader('Access-Control-Allow-Origin', '*'); // À restreindre au domaine final en prod
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // === Méthode autorisée : POST uniquement ===
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Méthode non autorisée' });
    }

    try {
        const data = typeof req.body === 'string'
            ? JSON.parse(req.body)
            : req.body;

        // ============================================
        // 1. VALIDATION CÔTÉ SERVEUR
        // (toujours revalider, ne jamais faire confiance au client)
        // ============================================
        const errors = [];

        if (!data.firstname || data.firstname.trim().length < 2) {
            errors.push('Prénom requis');
        }
        if (!data.lastname || data.lastname.trim().length < 2) {
            errors.push('Nom requis');
        }
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Email invalide');
        }
        if (!data.message || data.message.trim().length < 10) {
            errors.push('Message trop court');
        }

        if (errors.length > 0) {
            return res.status(400).json({ success: false, error: errors.join(', ') });
        }

        // ============================================
        // 2. VÉRIFICATION CLOUDFLARE TURNSTILE
        // (anti-bot — facultatif, à activer après config)
        // ============================================
        const turnstileSecret = process.env.TURNSTILE_SECRET;
        if (turnstileSecret && data.turnstileToken) {
            const verifyResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    secret: turnstileSecret,
                    response: data.turnstileToken
                })
            });
            const verifyData = await verifyResp.json();
            if (!verifyData.success) {
                return res.status(403).json({ success: false, error: 'Vérification anti-bot échouée' });
            }
        }

        // ============================================
        // 3. CONSTRUCTION DE L'EMAIL
        // ============================================
        const subjectLabel = getSubjectLabel(data.subject);

        const emailHtml = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
          <h1 style="font-size: 20px; border-bottom: 2px solid #E63A11; padding-bottom: 10px;">
            Nouveau message — Site Mc.Johnson &amp; Partners
          </h1>

          <h2 style="font-size: 14px; color: #6b6b6b; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px;">
            Coordonnées
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #6b6b6b;">Nom complet</td><td style="padding: 6px 0;"><strong>${escapeHtml(data.firstname)} ${escapeHtml(data.lastname)}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #6b6b6b;">Email</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
            ${data.phone ? `<tr><td style="padding: 6px 0; color: #6b6b6b;">Téléphone</td><td style="padding: 6px 0;"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td></tr>` : ''}
            ${data.company ? `<tr><td style="padding: 6px 0; color: #6b6b6b;">Société</td><td style="padding: 6px 0;">${escapeHtml(data.company)}</td></tr>` : ''}
            ${subjectLabel ? `<tr><td style="padding: 6px 0; color: #6b6b6b;">Type de projet</td><td style="padding: 6px 0;">${escapeHtml(subjectLabel)}</td></tr>` : ''}
          </table>

          <h2 style="font-size: 14px; color: #6b6b6b; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px;">
            Message
          </h2>
          <div style="background: #f5f5f0; padding: 16px; border-left: 3px solid #E63A11; white-space: pre-wrap; line-height: 1.6;">
${escapeHtml(data.message)}
          </div>

          <p style="margin-top: 32px; font-size: 12px; color: #999;">
            Reçu via le formulaire de contact du site mcjohnson-partners.com
          </p>
        </body>
      </html>
    `;
        const newMessage = {
            id: generateMessageId(),
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone: data.phone || '',
            company: data.company || '',
            subject: data.subject || '',
            subjectLabel,
            message: data.message,
            createdAt: new Date().toISOString(),
            read: false
        };

        const { messages, sha } = await readMessages();

        messages.unshift(newMessage);

        await writeMessages(
            messages.slice(0, 500),
            sha,
            `[admin] Nouveau message : ${data.firstname} ${data.lastname}`
        );
        // ============================================
        // 4. ENVOI VIA RESEND
        // ============================================
        const resendKey = process.env.RESEND_API_KEY;
        const toEmail = process.env.CONTACT_TO_EMAIL;
        const fromEmail = process.env.CONTACT_FROM_EMAIL;

        if (!resendKey || !toEmail || !fromEmail) {
            console.error('Variables d\'environnement manquantes');
            return res.status(500).json({ success: false, error: 'Configuration serveur incomplète' });
        }

        const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `Site Mc.Johnson <${fromEmail}>`,
                to: toEmail,
                reply_to: data.email,
                subject: `[Site] Nouveau contact — ${data.firstname} ${data.lastname}`,
                html: emailHtml
            })
        });

        if (!resendResp.ok) {
            const errorBody = await resendResp.text();
            console.error('Erreur Resend :', errorBody);
            throw new Error('Échec envoi email');
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Erreur API contact :', error);
        return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
}

// ============================================
// UTILITAIRES
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSubjectLabel(value) {
    const labels = {
        'residentiel': 'Projet résidentiel',
        'tertiaire': 'Bâtiment tertiaire  / bureaux',
        'hotellerie': 'Hôtellerie / tourisme',
        'infrastructure': 'Infrastructure / équipement public',
        'urbanisme': 'Urbanisme / aménagement',
        'conseil': 'Conseil en investissement',
        'autre': 'Autre'
    };
    return labels[value] || '';
}