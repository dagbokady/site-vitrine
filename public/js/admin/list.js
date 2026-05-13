// js/admin/list.js
// Vue liste : 12 projets / page, filtres discipline + recherche

import * as api from './api.js';
import { showView, toast, escapeHtml, escapeAttr, disciplineLabel, statusLabel, optimizeImage } from './ui.js';
import { showDeleteModal } from './delete-modal.js';

const PAGE_SIZE = 12;

const state = {
    allProjects: [],
    sha: null,
    filtered: [],
    currentPage: 1,
    discipline: '',
    query: ''
};

let onEditCallback = null;
let onNewCallback = null;

export function setupList({ onEdit, onNew }) {
    onEditCallback = onEdit;
    onNewCallback = onNew;

    // Bouton "Nouveau projet"
    document.getElementById('btn-new-project')?.addEventListener('click', () => {
        if (onNewCallback) onNewCallback();
    });

    // Filtres discipline (chips)
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('is-active'));
            chip.classList.add('is-active');
            state.discipline = chip.dataset.discipline || '';
            state.currentPage = 1;
            applyFilters();
        });
    });

    // Recherche (debounced)
    const searchInput = document.getElementById('search-input');
    let searchTimer;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            state.query = e.target.value.trim().toLowerCase();
            state.currentPage = 1;
            applyFilters();
        }, 250);
    });

    // Pagination
    document.getElementById('page-prev')?.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            renderPage();
        }
    });
    document.getElementById('page-next')?.addEventListener('click', () => {
        const totalPages = Math.ceil(state.filtered.length / PAGE_SIZE);
        if (state.currentPage < totalPages) {
            state.currentPage++;
            renderPage();
        }
    });

    // Bouton "← Liste" dans le header (pour revenir depuis l'éditeur)
    document.getElementById('back-to-list')?.addEventListener('click', () => {
        enterList();
    });
}

// Appel public : entrer dans la vue liste (recharge les données)
export async function enterList() {
    showView('view-list');
    await loadProjects();
}

async function loadProjects() {
    const loading = document.getElementById('list-loading');
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('list-empty');
    const pagination = document.getElementById('pagination');

    if (loading) loading.hidden = false;
    if (grid) grid.innerHTML = '';
    if (empty) empty.hidden = true;
    if (pagination) pagination.hidden = true;

    try {
        const data = await api.listProjects();
        state.allProjects = data.projects || [];
        state.sha = data._meta?.sha || null;

        // Tri par createdAt desc (les plus récents en premier)
        state.allProjects.sort((a, b) => {
            const da = a.updatedAt || a.createdAt || '';
            const db = b.updatedAt || b.createdAt || '';
            return db.localeCompare(da);
        });

        applyFilters();
    } catch (err) {
        toast(err.message, 'error');
    } finally {
        if (loading) loading.hidden = true;
    }
}

function applyFilters() {
    let filtered = state.allProjects;

    if (state.discipline) {
        filtered = filtered.filter(p => p.discipline === state.discipline);
    }

    if (state.query) {
        const q = state.query;
        filtered = filtered.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.subtitle || '').toLowerCase().includes(q) ||
            (p.location || '').toLowerCase().includes(q) ||
            (p.client || '').toLowerCase().includes(q)
        );
    }

    state.filtered = filtered;

    // Update compteur
    const count = document.getElementById('list-count');
    if (count) {
        count.textContent = `${filtered.length} projet${filtered.length > 1 ? 's' : ''}`;
    }

    renderPage();
}

function renderPage() {
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('list-empty');
    const pagination = document.getElementById('pagination');
    if (!grid) return;

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    const start = (state.currentPage - 1) * PAGE_SIZE;
    const pageProjects = state.filtered.slice(start, start + PAGE_SIZE);

    if (state.filtered.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.hidden = false;
        if (pagination) pagination.hidden = true;
        return;
    }

    if (empty) empty.hidden = true;
    grid.innerHTML = pageProjects.map(renderCard).join('');

    // Bind les boutons de chaque carte
    grid.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'edit') {
                const project = state.allProjects.find(p => p.id === id);
                if (project && onEditCallback) onEditCallback(project);
            } else if (action === 'delete') {
                const project = state.allProjects.find(p => p.id === id);
                if (project) {
                    showDeleteModal(project, async () => {
                        // Callback après suppression réussie
                        state.allProjects = state.allProjects.filter(p => p.id !== id);
                        applyFilters();
                    });
                }
            } else if (action === 'view') {
                window.open(`/projet?id=${encodeURIComponent(id)}`, '_blank');
            }
        });
    });

    // Pagination
    if (pagination) {
        pagination.hidden = state.filtered.length <= PAGE_SIZE;
        document.getElementById('page-prev').disabled = state.currentPage === 1;
        document.getElementById('page-next').disabled = state.currentPage === totalPages;
        document.getElementById('page-info').textContent = `Page ${state.currentPage} / ${totalPages}`;
    }
}

function renderCard(p) {
    const cover = optimizeImage(p.cover, 600);
    const meta = [p.year, p.location].filter(Boolean).join(' · ');
    return `
    <article class="project-card">
      <div class="card-cover">
        ${cover ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(p.title)}" loading="lazy">` : '<div class="card-cover-empty">Pas d\'image</div>'}
        <span class="card-status card-status--${escapeAttr(p.status)}">${escapeHtml(statusLabel(p.status))}</span>
      </div>
      <div class="card-body">
        <p class="card-discipline">${escapeHtml(disciplineLabel(p.discipline))}</p>
        <h3 class="card-title">${escapeHtml(p.title)}</h3>
        <p class="card-meta">${escapeHtml(meta || '—')}</p>
      </div>
      <div class="card-actions">
        <button class="card-btn" data-action="edit" data-id="${escapeAttr(p.id)}">Modifier</button>
        <button class="card-btn card-btn-view" data-action="view" data-id="${escapeAttr(p.id)}" title="Voir sur le site">↗</button>
        <button class="card-btn card-btn-delete" data-action="delete" data-id="${escapeAttr(p.id)}" title="Supprimer">🗑</button>
      </div>
    </article>
  `;
}