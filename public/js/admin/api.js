// js/admin/api.js
// Wrapper fetch avec auth automatique + gestion d'erreurs uniforme

const TOKEN_KEY = 'mcjp_admin_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch authentifié. Ajoute automatiquement le header Authorization.
 * Si 401, déclenche une déconnexion automatique.
 */
async function authedFetch(url, options = {}) {
    const token = getToken();
    if (!token) throw new Error('Non connecté');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token expiré ou invalide → reconnexion forcée
        clearToken();
        window.dispatchEvent(new CustomEvent('admin:logout'));
        throw new Error('Session expirée — reconnectez-vous');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || `Erreur ${response.status}`);
    }

    return data;
}

// ============================================
// ENDPOINTS
// ============================================
export async function login(email, password) {
    const response = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Identifiants invalides');
    return data;
}

export async function listProjects() {
    return authedFetch('/api/admin-list', { method: 'GET' });
}

export async function createProject(project) {
    return authedFetch('/api/admin-save', {
        method: 'POST',
        body: JSON.stringify({ project })
    });
}

export async function updateProject(id, project) {
    return authedFetch('/api/admin-update', {
        method: 'POST', // POST aussi accepté pour compat
        body: JSON.stringify({ id, project })
    });
}

export async function deleteProject(id, confirmTitle) {
    return authedFetch('/api/admin-delete', {
        method: 'POST',
        body: JSON.stringify({ id, confirmTitle })
    });
}