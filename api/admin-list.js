// api/admin-list.js
// GET /api/admin-list — retourne les projets pour l'admin
// Requiert : Authorization: Bearer <token>

import { verifyToken, githubReadProjects } from './_helpers.js';

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
        const { json, sha } = await githubReadProjects();
        return res.status(200).json({
            ...json,
            _meta: { sha }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}