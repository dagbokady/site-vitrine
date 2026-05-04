/* ============================================
   PROJECTS.JS — Affichage des projets
   Utilisé par index.html ET projets.html
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // ÉTAT GLOBAL DU MODULE
    // ============================================
    let allProjects = [];
    let allCategories = [];
    let activeCategoryFilter = 'all';
    let activeStatusFilter = 'all';

    // ============================================
    // POINT D'ENTRÉE
    // ============================================
    document.addEventListener('DOMContentLoaded', async function () {
        const featuredGrid = document.getElementById('featured-grid');
        const projectsGrid = document.getElementById('projects-grid');

        // Si aucun des deux conteneurs n'existe, on n'est pas sur la bonne page
        if (!featuredGrid && !projectsGrid) return;

        // Chargement des données
        const data = await window.MCJP.fetchProjects();

        if (!data || !data.projects) {
            showLoadError(featuredGrid || projectsGrid);
            return;
        }

        allProjects = data.projects;
        allCategories = data.categories || [];

        // === HOMEPAGE ===
        if (featuredGrid) {
            renderFeaturedProjects();
        }

        // === PAGE LISTE ===
        if (projectsGrid) {
            renderAllProjects();
            setupFilters();
        }
    });

    // ============================================
    // HOMEPAGE — projets phares
    // ============================================
    function renderFeaturedProjects() {
        const grid = document.getElementById('featured-grid');
        if (!grid) return;

        // On prend tous les projets marqués "featured", triés par order
        const featured = allProjects
            .filter(function (p) { return p.featured === true; })
            .sort(function (a, b) { return (a.order || 999) - (b.order || 999); })
            .slice(0, 3); // Maximum 3 sur la home (1 grand + 2 petits)

        if (featured.length === 0) {
            grid.innerHTML = '<p class="loading">Aucun projet à afficher pour le moment.</p>';
            return;
        }

        grid.innerHTML = '';

        featured.forEach(function (project, index) {
            // Le premier est le "grand", les autres sont normaux
            const isLarge = index === 0;
            grid.appendChild(createProjectCard(project, isLarge));
        });
    }

    // ============================================
    // PAGE LISTE — tous les projets avec filtres
    // ============================================
    function renderAllProjects() {
        const grid = document.getElementById('projects-grid');
        const noResults = document.getElementById('no-results');
        const resultsCount = document.getElementById('results-count');
        if (!grid) return;

        // Application des filtres
        const filtered = allProjects.filter(function (project) {
            const matchesCategory = activeCategoryFilter === 'all' ||
                (project.categories && project.categories.includes(activeCategoryFilter));
            const matchesStatus = activeStatusFilter === 'all' ||
                project.status === activeStatusFilter;
            return matchesCategory && matchesStatus;
        });

        // Tri par année décroissante puis par order
        filtered.sort(function (a, b) {
            const yearDiff = (b.year || 0) - (a.year || 0);
            if (yearDiff !== 0) return yearDiff;
            return (a.order || 999) - (b.order || 999);
        });

        // Compteur de résultats
        if (resultsCount) {
            const total = filtered.length;
            resultsCount.textContent = total === 0
                ? 'Aucun projet'
                : (total === 1 ? '1 projet' : total + ' projets');
        }

        // Affichage ou message "aucun résultat"
        grid.innerHTML = '';
        if (filtered.length === 0) {
            if (noResults) noResults.hidden = false;
            return;
        }

        if (noResults) noResults.hidden = true;

        filtered.forEach(function (project) {
            grid.appendChild(createProjectCard(project, false));
        });
    }

    // ============================================
    // CRÉATION D'UNE CARTE PROJET (réutilisable)
    // ============================================
    function createProjectCard(project, isLarge) {
        const card = document.createElement('a');
        card.href = '/projet.html?id=' + encodeURIComponent(project.id);
        card.className = 'project-card' + (isLarge ? ' project-card-large' : '');
        card.setAttribute('aria-label', 'Voir le projet ' + project.title);

        // Image optimisée via Cloudinary
        const imageUrl = window.MCJP.cloudinaryOptimize(project.cover, isLarge ? 1200 : 800);

        // Construction du libellé "Catégorie · Statut · Année"
        const metaParts = [];
        if (project.categories && project.categories.length > 0) {
            const firstCat = project.categories[0];
            metaParts.push(window.MCJP.getCategoryLabel(firstCat, allCategories));
        }
        if (project.status) {
            metaParts.push(window.MCJP.getStatusLabel(project.status));
        }
        if (project.year) {
            metaParts.push(project.year);
        }
        const metaText = metaParts.join(' · ');

        card.innerHTML =
            '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(project.title) + '" class="project-card-image">' +
            '<div class="project-card-overlay">' +
            '<p class="project-card-meta">' + escapeHtml(metaText) + '</p>' +
            '<h3 class="project-card-title">' + escapeHtml(project.title) + '</h3>' +
            '</div>';

        return card;
    }

    // ============================================
    // FILTRES (page liste uniquement)
    // ============================================
    function setupFilters() {
        const categoryButtons = document.querySelectorAll('[data-filter-category]');
        const statusButtons = document.querySelectorAll('[data-filter-status]');

        categoryButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategoryFilter = btn.getAttribute('data-filter-category');
                updateActiveButton(categoryButtons, btn);
                renderAllProjects();
            });
        });

        statusButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeStatusFilter = btn.getAttribute('data-filter-status');
                updateActiveButton(statusButtons, btn);
                renderAllProjects();
            });
        });
    }

    function updateActiveButton(buttonsList, activeBtn) {
        buttonsList.forEach(function (b) { b.classList.remove('is-active'); });
        activeBtn.classList.add('is-active');
    }

    // ============================================
    // GESTION D'ERREUR
    // ============================================
    function showLoadError(container) {
        if (!container) return;
        container.innerHTML =
            '<p class="loading" style="color: var(--color-error);">' +
            'Impossible de charger les projets. Merci de rafraîchir la page.' +
            '</p>';
    }

    // ============================================
    // ÉCHAPPEMENT HTML (sécurité XSS)
    // Toujours échapper les données dynamiques
    // avant de les insérer en HTML
    // ============================================
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

})();