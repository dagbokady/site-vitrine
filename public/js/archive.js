/* ============================================
   ARCHIVE.JS — Page archive complète
   - Filtres par discipline et statut
   - Recherche textuelle
   - Pagination "Charger plus"
   ============================================ */

(function () {
    'use strict';

    const PROJECTS_PER_PAGE = 12;

    const state = {
        allProjects: [],
        filteredProjects: [],
        visibleCount: 0,
        filters: {
            discipline: 'all',
            status: 'all',
            search: ''
        }
    };

    document.addEventListener('DOMContentLoaded', async function () {
        // Charger les projets
        const data = await window.MCJP.fetchProjects();
        if (!data || !data.projects) {
            showLoadError();
            return;
        }

        state.allProjects = data.projects;

        // Init UI
        setupFilters();
        setupSearch();
        setupLoadMore();

        // Première render
        applyFiltersAndRender();
    });

    // ============================================
    // FILTRES
    // ============================================
    function setupFilters() {
        document.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const filterType = btn.getAttribute('data-filter');
                const value = btn.getAttribute('data-value');

                state.filters[filterType] = value;

                // Update active state visuel
                document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(b => {
                    b.classList.toggle('is-active', b === btn);
                });

                applyFiltersAndRender();
            });
        });

        // Bouton reset (apparaît dans empty state)
        document.addEventListener('click', (e) => {
            if (e.target.id === 'reset-filters') {
                resetAllFilters();
            }
        });
    }

    // ============================================
    // RECHERCHE (avec debounce)
    // ============================================
    function setupSearch() {
        const input = document.getElementById('archive-search');
        if (!input) return;

        let debounceTimer = null;
        input.addEventListener('input', (e) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                state.filters.search = e.target.value.trim().toLowerCase();
                applyFiltersAndRender();
            }, 300);
        });
    }

    // ============================================
    // RESET
    // ============================================
    function resetAllFilters() {
        state.filters.discipline = 'all';
        state.filters.status = 'all';
        state.filters.search = '';

        document.querySelectorAll('.filter-chip').forEach(btn => {
            const isAll = btn.getAttribute('data-value') === 'all';
            btn.classList.toggle('is-active', isAll);
        });

        const searchInput = document.getElementById('archive-search');
        if (searchInput) searchInput.value = '';

        applyFiltersAndRender();
    }

    // ============================================
    // APPLICATION DES FILTRES
    // ============================================
    function applyFiltersAndRender() {
        const { discipline, status, search } = state.filters;

        state.filteredProjects = state.allProjects.filter(p => {
            // Filtre discipline
            if (discipline !== 'all' && p.discipline !== discipline) {
                return false;
            }
            // Filtre statut
            if (status !== 'all' && p.status !== status) {
                return false;
            }
            // Recherche textuelle (titre + sous-titre + lieu)
            if (search) {
                const haystack = [
                    p.title,
                    p.subtitle,
                    p.location,
                    p.client
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });

        // Tri par année décroissante puis order
        state.filteredProjects.sort((a, b) => {
            const yearA = a.year || 0;
            const yearB = b.year || 0;
            if (yearA !== yearB) return yearB - yearA;
            return (a.order || 999) - (b.order || 999);
        });

        // Reset pagination
        state.visibleCount = PROJECTS_PER_PAGE;
        render();
    }

    // ============================================
    // RENDU
    // ============================================
    function render() {
        const grid = document.getElementById('archive-grid');
        const empty = document.getElementById('archive-empty');
        const pagination = document.getElementById('archive-pagination');
        const countEl = document.getElementById('archive-count');

        // Compteur global
        const total = state.filteredProjects.length;
        if (countEl) {
            if (total === 0) {
                countEl.textContent = 'Aucun projet';
            } else {
                countEl.textContent = total === 1 ? '1 projet' : `${total} projets`;
            }
        }

        // Empty state
        if (total === 0) {
            grid.innerHTML = '';
            empty.hidden = false;
            pagination.hidden = true;
            return;
        }

        empty.hidden = true;

        // Affichage limité par pagination
        const toShow = state.filteredProjects.slice(0, state.visibleCount);

        grid.innerHTML = '';
        toShow.forEach(p => grid.appendChild(createArchiveCard(p)));

        // Pagination visible si reste des projets
        if (total > state.visibleCount) {
            pagination.hidden = false;
            const remaining = total - state.visibleCount;
            const info = document.getElementById('pagination-info');
            if (info) {
                info.textContent = `${toShow.length} sur ${total} projets affichés`;
            }
        } else {
            pagination.hidden = true;
        }
    }

    // ============================================
    // LOAD MORE
    // ============================================
    function setupLoadMore() {
        const btn = document.getElementById('load-more-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            state.visibleCount += PROJECTS_PER_PAGE;
            render();

            // Scroll doux vers les nouveaux items
            const grid = document.getElementById('archive-grid');
            const previousLastIndex = state.visibleCount - PROJECTS_PER_PAGE;
            const newFirstCard = grid.children[previousLastIndex];
            if (newFirstCard) {
                newFirstCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // ============================================
    // CARD
    // ============================================
    function createArchiveCard(project) {
        const link = document.createElement('a');
        link.href = '/projet?id=' + encodeURIComponent(project.id);
        link.className = 'archive-card';
        link.setAttribute('aria-label', `Voir le projet ${project.title}`);

        const imageUrl = window.MCJP.cloudinaryOptimize(project.cover, 800);

        const metaParts = [
            getDisciplineLabel(project.discipline),
            project.year || window.MCJP.getStatusLabel(project.status)
        ].filter(Boolean);

        link.innerHTML = `
      <div class="archive-card-image-wrap">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(project.title)}" class="archive-card-image" loading="lazy">
      </div>
      <p class="archive-card-meta">${escapeHtml(metaParts.join(' · '))}</p>
      <h3 class="archive-card-title">${escapeHtml(project.title)}</h3>
      ${project.location ? `<p class="archive-card-location">${escapeHtml(project.location)}</p>` : ''}
    `;

        return link;
    }

    // ============================================
    // UTILS
    // ============================================
    function getDisciplineLabel(id) {
        const labels = {
            'architecture': 'Architecture',
            'design': 'Design',
            'urbanisme': 'Urbanisme'
        };
        return labels[id] || id || '';
    }

    function showLoadError() {
        const grid = document.getElementById('archive-grid');
        if (grid) {
            grid.innerHTML = '<p class="loading" style="color: var(--color-error);">Impossible de charger les projets.</p>';
        }
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(text) { return escapeHtml(text); }

})();