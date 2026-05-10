/* ============================================
   /api/admin-auth.js — Authentification admin
   Reçoit email + password, vérifie, renvoie un token signé
   ============================================
   Variables d'env requises (sur Vercel) :
     - ADMIN_EMAIL          (email autorisé)
     - ADMIN_PASSWORD       (mot de passe)
     - ADMIN_TOKEN_SECRET   (chaîne aléatoire 32+ chars pour signer le token)
   ============================================ */

import crypto from 'crypto';

export const config = {
    runtime: 'nodejs'
};

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Méthode non autorisée' });
    }

    try {
        const { email, password } = req.body || {};

        // ============================================
        // Validation des entrées
        // ============================================
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
        }

        // ============================================
        // Vérification des credentials
        // On utilise crypto.timingSafeEqual pour éviter
        // les attaques par mesure de temps (timing attacks)
        // ============================================
        const expectedEmail = process.env.ADMIN_EMAIL || '';
        const expectedPassword = process.env.ADMIN_PASSWORD || '';
        const secret = process.env.ADMIN_TOKEN_SECRET || '';

        if (!expectedEmail || !expectedPassword || !secret) {
            console.error('Variables d\'environnement admin manquantes');
            return res.status(500).json({ success: false, error: 'Configuration serveur incomplète' });
        }

        // Comparaison sécurisée (constant-time)
        const emailMatch = safeCompare(email.toLowerCase().trim(), expectedEmail.toLowerCase().trim());
        const passwordMatch = safeCompare(password, expectedPassword);

        if (!emailMatch || !passwordMatch) {
            // Petit délai aléatoire pour ralentir le brute-force
            await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
            return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
        }

        // ============================================
        // Génération du token (format simple façon JWT)
        // Structure : base64(payload).signature
        // ============================================
        const payload = {
            email: email.toLowerCase().trim(),
            exp: Date.now() + (24 * 60 * 60 * 1000) // expire dans 24h
        };

        const token = createToken(payload, secret);

        return res.status(200).json({
            success: true,
            token: token,
            expiresAt: payload.exp
        });

    } catch (error) {
        console.error('Erreur admin-auth :', error);
        return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
}

// ============================================
// UTILITAIRES — exportés pour réutilisation
// ============================================

/**
 * Comparaison constant-time (résiste aux timing attacks)
 */
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}

/**
 * Crée un token signé (mini JWT maison)
 */
export function createToken(payload, secret) {
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', secret)
        .update(payloadStr)
        .digest('base64url');
    return `${payloadStr}.${signature}`;
}

/**
 * Vérifie un token signé. Renvoie le payload si valide, null sinon.
 */
export function verifyToken(token, secret) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;

    // Vérifier la signature
    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payloadStr)
        .digest('base64url');

    if (!safeCompare(signature, expectedSig)) return null;

    // Décoder le payload
    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    // Vérifier l'expiration
    if (!payload.exp || Date.now() > payload.exp) return null;

    return payload;
}