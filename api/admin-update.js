// api/admin-update.js
// PUT /api/admin-update — modifie un projet existant
// Body : { id: "slug", project: { ... }, sha: "abc123" }

import { verifyToken, githubReadProjects, githubWriteProjects, slugify } from './_helpers.js';

export const config = { runtime: 'nodejs' };

function validateProject(p) {
    if (!p) return 'Projet manquant';
    if (!p.title || p.title.trim().length < 2) return 'Titre requis (min. 2 caractères)';
    if (!p.discipline || !['architecture', 'design', 'urbanisme'].includes(p.discipline)) {
        return 'Discipline invalide';
    }
    if (!p.status || !['realise', 'en-cours', 'etude', 'concours'].includes(p.status)) {
        return 'Statut invalide';
    }
    if (!p.cover) return 'Image de couverture requise';
    return null;
}

export default async function handler(req, res) {
    if (req.method !== 'PUT' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = process.env.ADMIN_TOKEN_SECRET;
    if (!secret) {
        return res.status(500).json({ error: 'Configuration manquante' });
    }
    if (!verifyToken(req.headers.authorization, secret)) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const { id, project } = req.body || {};
    if (!id) return res.status(400).json({ error: 'ID projet manquant' });

    const validationError = validateProject(project);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        // Lire le state actuel (toujours frais pour éviter les conflits)
        const { json: data, sha: currentSha } = await githubReadProjects();

        const index = data.projects.findIndex(p => p.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Projet introuvable' });
        }

        // Préserver l'id et createdAt d'origine, mettre à jour le reste
        const original = data.projects[index];
        const updated = {
            ...original,                       // conserve id, slug, createdAt
            ...project,                        // applique les changements
            id: original.id,                   // forcer la conservation de l'ID
            slug: original.slug,               // idem slug
            createdAt: original.createdAt,     // idem date de création
            updatedAt: new Date().toISOString()
        };

        data.projects[index] = updated;
        data.meta.lastUpdate = new Date().toISOString().split('T')[0];

        await githubWriteProjects(
            data,
            currentSha,
            `[admin] Update projet : ${updated.title}`
        );

        return res.status(200).json({
            ok: true,
            project: updated,
            message: 'Projet mis à jour'
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}