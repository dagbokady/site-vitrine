// api/admin-delete.js
// DELETE /api/admin-delete — supprime un projet
// Body : { id: "slug", confirmTitle: "Titre exact" }

import { verifyToken, githubReadProjects, githubWriteProjects } from './_helpers.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'DELETE' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.ADMIN_TOKEN_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Configuration manquante' });
    }
    if (!verifyToken(req.headers.authorization, secret)) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const { id, confirmTitle } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID projet manquant' });
    if (!confirmTitle) return res.status(400).json({ error: 'Titre de confirmation requis' });

    try {
        const { json: data, sha: currentSha } = await githubReadProjects();

        const project = data.projects.find(p => p.id === id);
        if (!project) {
            return res.status(404).json({ error: 'Projet introuvable' });
        }

        // Vérification du titre exact (insensible à la casse)
        if (project.title.trim().toLowerCase() !== confirmTitle.trim().toLowerCase()) {
            return res.status(400).json({
                error: 'Le titre de confirmation ne correspond pas',
                expected: project.title
            });
        }

        // Retirer le projet
        data.projects = data.projects.filter(p => p.id !== id);
        data.meta.totalProjects = data.projects.length;
        data.meta.lastUpdate = new Date().toISOString().split('T')[0];

        await githubWriteProjects(
            data,
            currentSha,
            `[admin] Delete projet : ${project.title}`
        );

        return res.status(200).json({
            ok: true,
            deletedId: id,
            message: `Projet "${project.title}" supprimé`
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}