/* ============================================
   /api/admin-save.js — Ajoute un projet à projects.json
   Vérifie le token, charge le JSON depuis GitHub, ajoute
   le nouveau projet, recommit le fichier sur GitHub
   ============================================
   Variables d'env requises :
     - ADMIN_TOKEN_SECRET   (pour vérifier le token)
     - GITHUB_TOKEN         (PAT fine-grained avec Contents: write)
     - GITHUB_REPO_OWNER    (ton pseudo)
     - GITHUB_REPO_NAME     (mcjohnson-partners)
   ============================================ */

import crypto from 'crypto';

const FILE_PATH = 'public/data/projects.json';
const BRANCH = 'main';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Méthode non autorisée' });
    }

    try {
        // ============================================
        // 1. VÉRIFICATION DU TOKEN
        // ============================================
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        const secret = process.env.ADMIN_TOKEN_SECRET || '';
        const payload = verifyToken(token, secret);

        if (!payload) {
            return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
        }

        // ============================================
        // 2. VALIDATION DU PROJET REÇU
        // ============================================
        const project = req.body?.project;
        const errors = validateProject(project);

        if (errors.length > 0) {
            return res.status(400).json({ success: false, error: errors.join(', ') });
        }

        // ============================================
        // 3. CONFIG GITHUB
        // ============================================
        const ghToken = process.env.GITHUB_TOKEN;
        const ghOwner = process.env.GITHUB_REPO_OWNER;
        const ghRepo = process.env.GITHUB_REPO_NAME;

        if (!ghToken || !ghOwner || !ghRepo) {
            console.error('Variables GitHub manquantes');
            return res.status(500).json({ success: false, error: 'Configuration GitHub incomplète' });
        }

        const apiBase = `https://api.github.com/repos/${ghOwner}/${ghRepo}`;
        const headers = {
            'Authorization': `Bearer ${ghToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'mcjohnson-admin'
        };

        // ============================================
        // 4. RÉCUPÉRER LE FICHIER ACTUEL DEPUIS GITHUB
        //    (on a besoin du SHA pour pouvoir le réécrire)
        // ============================================
        const getResp = await fetch(
            `${apiBase}/contents/${FILE_PATH}?ref=${BRANCH}`,
            { headers }
        );

        if (!getResp.ok) {
            const errText = await getResp.text();
            console.error('Erreur GitHub GET :', errText);
            return res.status(500).json({ success: false, error: 'Impossible de lire projects.json sur GitHub' });
        }

        const fileData = await getResp.json();
        const currentSha = fileData.sha;
        const currentContent = JSON.parse(
            Buffer.from(fileData.content, 'base64').toString('utf8')
        );

        // ============================================
        // 5. VÉRIFIER QUE L'ID N'EXISTE PAS DÉJÀ
        // ============================================
        const alreadyExists = currentContent.projects.some(p => p.id === project.id);
        if (alreadyExists) {
            return res.status(409).json({
                success: false,
                error: `Un projet avec l'identifiant "${project.id}" existe déjà. Utilisez un autre slug.`
            });
        }

        // ============================================
        // 6. AJOUTER LE NOUVEAU PROJET
        // ============================================
        // Métadonnées système
        project.createdAt = new Date().toISOString().split('T')[0];

        // Calcule le prochain "order" (max + 1)
        const maxOrder = currentContent.projects.reduce((max, p) => {
            return Math.max(max, p.order || 0);
        }, 0);
        if (!project.order) project.order = maxOrder + 1;

        // Insère en tête de liste pour qu'il soit visible immédiatement
        currentContent.projects.unshift(project);

        // ============================================
        // 7. COMMIT SUR GITHUB
        // ============================================
        const newContent = JSON.stringify(currentContent, null, 2);
        const newContentBase64 = Buffer.from(newContent, 'utf8').toString('base64');

        const putResp = await fetch(
            `${apiBase}/contents/${FILE_PATH}`,
            {
                method: 'PUT',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `chore(admin): ajout projet "${project.title}"`,
                    content: newContentBase64,
                    sha: currentSha,
                    branch: BRANCH
                })
            }
        );

        if (!putResp.ok) {
            const errText = await putResp.text();
            console.error('Erreur GitHub PUT :', errText);
            return res.status(500).json({
                success: false,
                error: 'Échec de la sauvegarde sur GitHub'
            });
        }

        const commitData = await putResp.json();

        return res.status(200).json({
            success: true,
            project: project,
            commitUrl: commitData.commit?.html_url || null,
            message: 'Projet ajouté avec succès. Le site sera mis à jour dans 30 secondes.'
        });

    } catch (error) {
        console.error('Erreur admin-save :', error);
        return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
}

// ============================================
// VALIDATION D'UN PROJET
// ============================================
function validateProject(project) {
    const errors = [];

    if (!project || typeof project !== 'object') {
        errors.push('Données projet manquantes');
        return errors;
    }

    // Champs obligatoires
    const required = ['id', 'slug', 'title', 'subtitle', 'status', 'description', 'cover'];
    required.forEach(key => {
        if (!project[key] || typeof project[key] !== 'string' || project[key].trim() === '') {
            errors.push(`Champ "${key}" requis`);
        }
    });

    // Validation du slug (lettres minuscules, chiffres, tirets uniquement)
    if (project.id && !/^[a-z0-9-]+$/.test(project.id)) {
        errors.push('L\'identifiant ne doit contenir que des lettres minuscules, chiffres et tirets');
    }

    // Validation du statut
    const validStatuses = ['realise', 'etude', 'concours'];
    if (project.status && !validStatuses.includes(project.status)) {
        errors.push('Statut invalide');
    }

    // Validation de l'année
    if (project.year !== undefined && project.year !== null) {
        const year = parseInt(project.year, 10);
        if (isNaN(year) || year < 1990 || year > 2100) {
            errors.push('Année invalide');
        }
    }

    // Validation des catégories
    if (!Array.isArray(project.categories) || project.categories.length === 0) {
        errors.push('Au moins une catégorie est requise');
    }

    // Validation de la galerie (optionnelle mais doit être un array valide)
    if (project.gallery && !Array.isArray(project.gallery)) {
        errors.push('La galerie doit être une liste');
    }

    return errors;
}

// ============================================
// VÉRIFICATION DU TOKEN (dupliqué ici pour
// que la function soit autonome)
// ============================================
function verifyToken(token, secret) {
    if (!token || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;

    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payloadStr)
        .digest('base64url');

    if (!safeCompare(signature, expectedSig)) return null;

    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    } catch {
        return null;
    }

    if (!payload.exp || Date.now() > payload.exp) return null;

    return payload;
}

function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}