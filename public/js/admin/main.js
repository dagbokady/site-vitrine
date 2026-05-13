// js/admin/main.js
// Point d'entrée admin v2 — orchestre les vues

import * as api from './api.js';
import { showView, toast } from './ui.js';
import { setupLogin, setupLogout } from './login.js';
import { setupList, enterList } from './list.js';
import { setupEditor, openCreate, openEdit } from './editor.js';

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {

    // Modules
    setupLogin({ onLoggedIn: enterApp });
    setupLogout();

    setupList({
        onNew: () => openCreate(),
        onEdit: (project) => openEdit(project)
    });

    setupEditor({
        onSaved: async () => {
            // Après sauvegarde : retour à la liste rafraîchie
            await enterList();
        },
        onBack: () => enterList()
    });

    // Démarrage : si on a déjà un token, on tente d'entrer directement
    if (api.getToken()) {
        enterApp().catch(() => {
            // Token invalide → reste sur la vue login
            api.clearToken();
            showView('view-login');
        });
    } else {
        showView('view-login');
    }
});

async function enterApp() {
    await enterList();
}