// api/admin-save.js
// POST /api/admin-save — crée un nouveau projet
// Body : { project: { ... } }

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

    const { project } = req.body || {};
    const validationError = validateProject(project);
    if (validationError) return res.status(400).json({ error: validationError });

    try {
        const { json: data, sha: currentSha } = await githubReadProjects();

        // Générer un slug unique
        let baseSlug = slugify(project.title);
        let finalSlug = baseSlug;
        let counter = 2;
        while (data.projects.some(p => p.id === finalSlug)) {
            finalSlug = `${baseSlug}-${counter}`;
            counter++;
        }

        const now = new Date().toISOString();
        const maxOrder = data.projects.reduce((m, p) => Math.max(m, p.order || 0), 0);

        const newProject = {
            ...project,

            id: finalSlug,                         // (overrides précédents)
            slug: finalSlug,
            order: maxOrder + 1,
            featured: project.featured || false,
            createdAt: now.split('T')[0],
            updatedAt: now
        };

        // Ajouter en tête de liste (récents en premier dans la home)
        data.projects.unshift(newProject);
        data.meta.totalProjects = data.projects.length;
        data.meta.lastUpdate = now.split('T')[0];

        await githubWriteProjects(
            data,
            currentSha,
            `[admin] Création projet : ${newProject.title}`
        );

        return res.status(201).json({
            ok: true,
            project: newProject,
            message: `Projet "${newProject.title}" créé`
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}