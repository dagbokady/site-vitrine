// js/admin/delete-modal.js
// Modal de suppression avec confirmation par saisie du titre

import * as api from './api.js';
import { setBtnLoading, toast, escapeHtml } from './ui.js';

let isInitialized = false;
let currentProject = null;
let currentCallback = null;

function init() {
    if (isInitialized) return;
    isInitialized = true;

    const modal = document.getElementById('delete-modal');
    const input = document.getElementById('delete-confirm-input');
    const btn = document.getElementById('delete-confirm-btn');
    const errorEl = document.getElementById('delete-error');

    // Fermer modal : clic backdrop, bouton Annuler, Esc
    modal?.querySelectorAll('[data-modal-close]').forEach(el => {
        el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    // Activer le bouton de suppression seulement si le titre correspond
    input?.addEventListener('input', () => {
        const typed = input.value.trim().toLowerCase();
        const expected = currentProject?.title?.trim().toLowerCase() || '';
        btn.disabled = (typed !== expected);
        errorEl.hidden = true;
    });

    // Bouton supprimer
    btn?.addEventListener('click', async () => {
        if (!currentProject) return;
        errorEl.hidden = true;
        setBtnLoading(btn, true);

        try {
            await api.deleteProject(currentProject.id, input.value.trim());
            toast(`Projet "${currentProject.title}" supprimé`, 'success');
            closeModal();
            if (currentCallback) currentCallback();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
        } finally {
            setBtnLoading(btn, false);
        }
    });
}

export function showDeleteModal(project, callback) {
    init();
    currentProject = project;
    currentCallback = callback;

    const modal = document.getElementById('delete-modal');
    const nameEl = document.getElementById('delete-project-name');
    const input = document.getElementById('delete-confirm-input');
    const btn = document.getElementById('delete-confirm-btn');
    const errorEl = document.getElementById('delete-error');

    if (nameEl) nameEl.innerHTML = `"${escapeHtml(project.title)}"`;
    if (input) input.value = '';
    if (btn) btn.disabled = true;
    if (errorEl) errorEl.hidden = true;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => input?.focus(), 100);
}

function closeModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    currentProject = null;
    currentCallback = null;
}