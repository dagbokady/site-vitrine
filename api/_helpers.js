// api/_helpers.js
// Utilitaires partagés entre admin-* endpoints (auth, GitHub I/O)

import crypto from 'node:crypto';

export function verifyToken(authHeader, secret) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return false;

    try {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
        if (!payload.exp || Date.now() > payload.exp) return false;
        const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    } catch {
        return false;
    }
}

export async function githubReadProjects() {
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    const githubToken = process.env.GITHUB_TOKEN;
    const filePath = 'public/data/projects.json';

    if (!owner || !repo || !githubToken) {
        throw new Error('Configuration GitHub manquante');
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub read failed: ${response.status}`);
    }

    const fileData = await response.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf8');
    return {
        json: JSON.parse(content),
        sha: fileData.sha
    };
}

export async function githubWriteProjects(json, sha, commitMessage) {
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;
    const githubToken = process.env.GITHUB_TOKEN;
    const filePath = 'public/data/projects.json';

    const newContent = JSON.stringify(json, null, 2);
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: commitMessage,
            content: encodedContent,
            sha,
            committer: {
                name: 'Mc.Johnson & Partners Admin',
                email: 'admin@mc-johnson-partners.com'
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`GitHub write failed: ${response.status} - ${errText}`);
    }

    return await response.json();
}

export function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}