// js/admin/login.js
// Vue login : authentification

import * as api from './api.js';
import { setBtnLoading, showView, toast } from './ui.js';

export function setupLogin({ onLoggedIn }) {
    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;

        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            errorEl.textContent = 'Email et mot de passe requis';
            errorEl.hidden = false;
            return;
        }

        setBtnLoading(btn, true);
        try {
            const { token } = await api.login(email, password);
            api.setToken(token);
            toast('Connexion réussie', 'success');
            onLoggedIn();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
        } finally {
            setBtnLoading(btn, false);
        }
    });
}

export function setupLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        api.clearToken();
        showView('view-login');
        document.getElementById('login-form')?.reset();
        toast('Déconnecté', 'info');
    });

    // Auto-logout si le token expire en cours de session
    window.addEventListener('admin:logout', () => {
        showView('view-login');
        toast('Session expirée', 'warning');
    });
}