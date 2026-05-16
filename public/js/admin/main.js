// js/admin/main.js
// Point d'entrée admin v2 — orchestre les vues

import * as api from './api.js';
import { showView, toast } from './ui.js';
import { setupLogin, setupLogout } from './login.js';
import { setupList, enterList } from './list.js';
import { setupEditor, openCreate, openEdit } from './editor.js';
import { setupMessages, enterMessages, refreshUnreadCount } from './messages.js';

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
            await enterList();
            activateTab('projects');
        },
        onBack: () => {
            enterList();
            activateTab('projects');
        }
    });

    setupMessages();

    // Onglets dans le header admin
    document.getElementById('tab-projects')?.addEventListener('click', () => {
        enterList();
        activateTab('projects');
    });
    document.getElementById('tab-messages')?.addEventListener('click', () => {
        enterMessages();
        activateTab('messages');
    });

    // Démarrage
    if (api.getToken()) {
        enterApp().catch(() => {
            api.clearToken();
            showView('view-login');
        });
    } else {
        showView('view-login');
    }
});

async function enterApp() {
    await enterList();
    activateTab('projects');
    // En arrière-plan : pré-charger le compteur de messages non lus
    refreshUnreadCount();
}

function activateTab(name) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('is-active'));
    const el = document.getElementById('tab-' + name);
    if (el) el.classList.add('is-active');
}