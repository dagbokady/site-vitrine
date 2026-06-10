
// api/admin-messages-update.js
// POST /api/admin-messages-update — marque un message comme lu ou le supprime
// Body : { id: "msg_xxx", action: "mark-read" | "mark-unread" | "delete" }

import { verifyToken, readMessages, writeMessages } from './_helpers.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.ADMIN_TOKEN_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Configuration manquante' });
    }
    if (!verifyToken(req.headers.authorization, secret)) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const { id, action } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID requis' });
    if (!['mark-read', 'mark-unread', 'delete'].includes(action)) {
        return res.status(400).json({ error: 'Action invalide' });
    }

    try {
        const { messages, sha } = await readMessages();
        const index = messages.findIndex(m => m.id === id);
        if (index === -1) return res.status(404).json({ error: 'Message introuvable' });

        let updatedMessages = messages;
        let commitMsg = '';
        if (action === 'delete') {
            const removed = messages[index];
            updatedMessages = messages.filter(m => m.id !== id);
            commitMsg = `[admin] Suppression message ${removed.firstname} ${removed.lastname}`;
        } else {
            updatedMessages[index] = {
                ...updatedMessages[index],
                read: action === 'mark-read'
            };
            commitMsg = `[admin] ${action} message ${id}`;
        }

        await writeMessages(updatedMessages, sha, commitMsg);
        return res.status(200).json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}