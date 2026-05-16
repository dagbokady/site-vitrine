// js/admin/messages.js
// Vue Messages — inbox des messages du formulaire de contact

import * as api from './api.js';
import { getToken } from './api.js';
import { showView, toast, escapeHtml } from './ui.js';

const state = {
    messages: [],
    selectedId: null
};

let isInitialized = false;

export function setupMessages() {
    if (isInitialized) return;
    isInitialized = true;

    document.getElementById('messages-refresh')?.addEventListener('click', () => {
        loadMessages(true);
    });
}

export async function enterMessages() {
    showView('view-messages');
    await loadMessages(false);
}

async function loadMessages(forceRefresh) {
    const loadingEl = document.getElementById('messages-loading');
    const emptyEl = document.getElementById('messages-empty');
    const itemsEl = document.getElementById('messages-items');

    if (loadingEl) loadingEl.hidden = false;
    if (emptyEl) emptyEl.hidden = true;

    try {
        const response = await fetch('/api/admin-messages-list', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('admin:logout'));
            return;
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Erreur ${response.status}`);
        }
        const data = await response.json();
        state.messages = data.messages || [];

        // Mettre à jour le badge "Messages X" dans l'entête
        updateUnreadBadge(data._meta?.unread || 0);

        renderList();
    } catch (err) {
        if (itemsEl) itemsEl.innerHTML = `<li class="messages-empty">Erreur : ${escapeHtml(err.message)}</li>`;
    } finally {
        if (loadingEl) loadingEl.hidden = true;
    }
}

function updateUnreadBadge(count) {
    const badge = document.getElementById('unread-count');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.hidden = false;
    } else {
        badge.hidden = true;
    }
}

function renderList() {
    const itemsEl = document.getElementById('messages-items');
    const emptyEl = document.getElementById('messages-empty');
    const countEl = document.getElementById('messages-count');
    if (!itemsEl) return;

    const unread = state.messages.filter(m => !m.read).length;
    if (countEl) {
        countEl.textContent = state.messages.length === 0
            ? 'Aucun message'
            : `${state.messages.length} message${state.messages.length > 1 ? 's' : ''} — ${unread} non lu${unread > 1 ? 's' : ''}`;
    }

    if (state.messages.length === 0) {
        itemsEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
    }
    if (emptyEl) emptyEl.hidden = true;

    itemsEl.innerHTML = state.messages.map(m => {
        const date = formatDate(m.createdAt);
        return `
      <li class="message-item ${m.read ? '' : 'is-unread'} ${m.id === state.selectedId ? 'is-selected' : ''}"
          data-id="${escapeHtml(m.id)}">
        <p class="message-item-name">${escapeHtml(m.firstname)} ${escapeHtml(m.lastname)}</p>
        <p class="message-item-subject">${escapeHtml(m.subjectLabel || 'Sans objet')}</p>
        <p class="message-item-date">${escapeHtml(date)}</p>
      </li>
    `;
    }).join('');

    itemsEl.querySelectorAll('.message-item').forEach(item => {
        item.addEventListener('click', () => selectMessage(item.dataset.id));
    });
}

async function selectMessage(id) {
    state.selectedId = id;
    const msg = state.messages.find(m => m.id === id);
    if (!msg) return;

    // Marquer la card sélectionnée
    document.querySelectorAll('.message-item').forEach(el => {
        el.classList.toggle('is-selected', el.dataset.id === id);
    });

    renderDetail(msg);

    // Marquer comme lu côté serveur si pas encore lu
    if (!msg.read) {
        try {
            await fetch('/api/admin-messages-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ id, action: 'mark-read' })
            });
            msg.read = true;
            renderList();  // re-render pour retirer la pastille rouge
        } catch (err) {
            console.error('Erreur mark-read', err);
        }
    }
}

function renderDetail(msg) {
    const detail = document.getElementById('message-detail');
    if (!detail) return;

    const date = formatDate(msg.createdAt, true);

    detail.innerHTML = `
    <header class="message-detail-header">
      <div class="message-detail-from">
        <h2 class="message-detail-name">${escapeHtml(msg.firstname)} ${escapeHtml(msg.lastname)}</h2>
        <a href="mailto:${escapeHtml(msg.email)}" class="message-detail-email">${escapeHtml(msg.email)}</a>
        <p class="message-detail-meta">Reçu le ${escapeHtml(date)}</p>
      </div>
      <div class="message-detail-actions">
        <button class="admin-btn admin-btn-secondary" id="msg-toggle-read">Marquer non lu</button>
        <button class="admin-btn admin-btn-danger" id="msg-delete">Supprimer</button>
      </div>
    </header>

    <dl class="message-detail-info">
      ${msg.phone ? `<div><dt>Téléphone</dt><dd><a href="tel:${escapeHtml(msg.phone)}" style="color:inherit">${escapeHtml(msg.phone)}</a></dd></div>` : ''}
      ${msg.company ? `<div><dt>Société</dt><dd>${escapeHtml(msg.company)}</dd></div>` : ''}
      ${msg.subjectLabel ? `<div><dt>Type de projet</dt><dd>${escapeHtml(msg.subjectLabel)}</dd></div>` : ''}
    </dl>

    <div class="message-detail-body">${escapeHtml(msg.message)}</div>
  `;

    // Bouton "marquer non lu"
    document.getElementById('msg-toggle-read')?.addEventListener('click', async () => {
        try {
            await fetch('/api/admin-messages-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ id: msg.id, action: 'mark-unread' })
            });
            msg.read = false;
            renderList();
            toast('Marqué comme non lu', 'success');
        } catch (err) {
            toast('Erreur : ' + err.message, 'error');
        }
    });

    // Bouton supprimer
    document.getElementById('msg-delete')?.addEventListener('click', async () => {
        if (!confirm(`Supprimer définitivement le message de ${msg.firstname} ${msg.lastname} ?`)) return;
        try {
            await fetch('/api/admin-messages-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ id: msg.id, action: 'delete' })
            });
            state.messages = state.messages.filter(m => m.id !== msg.id);
            state.selectedId = null;
            renderList();
            detail.innerHTML = '<p class="message-detail-empty">Sélectionnez un message pour le lire.</p>';
            toast('Message supprimé', 'success');
        } catch (err) {
            toast('Erreur : ' + err.message, 'error');
        }
    });
}

function formatDate(iso, withTime) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        if (withTime) {
            const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `${dateStr} à ${timeStr}`;
        }
        return dateStr;
    } catch {
        return iso;
    }
}

// Permet d'être appelé depuis main.js pour pré-charger le badge sans entrer dans la vue
export async function refreshUnreadCount() {
    try {
        const response = await fetch('/api/admin-messages-list', {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        if (!response.ok) return;
        const data = await response.json();
        updateUnreadBadge(data._meta?.unread || 0);
    } catch {
        // silent
    }
}