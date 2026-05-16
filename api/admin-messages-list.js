// api/admin-messages-list.js
// GET /api/admin-messages-list — liste tous les messages de contact (inbox admin)

import { verifyToken, readMessages } from './_helpers.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.ADMIN_TOKEN_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Configuration manquante' });
    }
    if (!verifyToken(req.headers.authorization, secret)) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    try {
        const { messages, sha } = await readMessages();
        return res.status(200).json({
            messages,
            _meta: { sha, total: messages.length, unread: messages.filter(m => !m.read).length }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}