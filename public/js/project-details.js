/* ============================================
   PROJECT-DETAIL.JS — Page détail d'un projet
   Utilisé uniquement par projet.html
   Lit ?id=xxx dans l'URL pour identifier le projet
   ============================================ */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async function () {
        const article = document.getElementById('project-article');
        if (!article) return;

        // ============================================
        // 1. LIRE L'ID DEPUIS L'URL
        // ============================================
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');

        if (!projectId) {
            showError();
            return;
        }

        // ============================================
        // 2. CHARGER LES DONNÉES
        // ============================================
        const data = await window.MCJP.fetchProjects();

        if (!data || !data.projects) {
            showError();
            return;
        }

        const project = data.projects.find(function (p) { return p.id === projectId; });

        if (!project) {
            showError();
            return;
        }

        // ============================================
        // 3. CALCULER LES PROJETS PRÉCÉDENT / SUIVANT
        // ============================================
        const sortedProjects = data.projects
            .slice()
            .sort(function (a, b) {
                const yearDiff = (b.year || 0) - (a.year || 0);
                if (yearDiff !== 0) return yearDiff;
                return (a.order || 999) - (b.order || 999);
            });

        const currentIndex = sortedProjects.findIndex(function (p) { return p.id === projectId; });
        const prevProject = currentIndex > 0 ? sortedProjects[currentIndex - 1] : null;
        const nextProject = currentIndex < sortedProjects.length - 1 ? sortedProjects[currentIndex + 1] : null;

        // ============================================
        // 4. AFFICHER LE PROJET
        // ============================================
        renderProject(project, data.categories || []);
        renderNavigation(prevProject, nextProject);

        // Affiche l'article, masque le loader
        document.getElementById('project-loading').hidden = true;
        article.hidden = false;
    });

    // ============================================
    // RENDU DU PROJET
    // ============================================
    function renderProject(project, categories) {
        // === Titre de l'onglet et meta description ===
        document.title = project.title + ' — Mc.Johnson & Partners';
        const metaDesc = document.getElementById('meta-description');
        if (metaDesc && project.description) {
            metaDesc.setAttribute('content', truncate(project.description, 160));
        }

        // === Image de couverture ===
        const cover = document.getElementById('project-cover');
        if (cover) {
            const optimizedUrl = window.MCJP.cloudinaryOptimize(project.cover, 2000);
            cover.src = optimizedUrl;
            cover.alt = project.title;
            cover.classList.add('eager'); // Pas de lazy load pour l'image hero
        }

        // === Catégories (eyebrow) ===
        const catsEl = document.getElementById('project-categories');
        if (catsEl && project.categories) {
            const labels = project.categories.map(function (catId) {
                return window.MCJP.getCategoryLabel(catId, categories);
            });
            catsEl.textContent = labels.join(' · ');
        }

        // === Titre et sous-titre ===
        setText('project-title', project.title);
        setText('project-subtitle', project.subtitle);

        // === Méta-données ===
        setText('meta-status', window.MCJP.getStatusLabel(project.status));
        setText('meta-year', project.year);
        setText('meta-location', project.location);
        setText('meta-client', project.client);
        setText('meta-surface', project.surface);
        setText('meta-role', project.role);

        // === Partenaires (optionnel) ===
        const partnersWrapper = document.getElementById('meta-partners-wrapper');
        const partnersEl = document.getElementById('meta-partners');
        if (project.partners && project.partners.length > 0) {
            if (partnersEl) partnersEl.textContent = project.partners.join(', ');
            if (partnersWrapper) partnersWrapper.style.display = '';
        } else {
            if (partnersWrapper) partnersWrapper.style.display = 'none';
        }

        // === Description ===
        setText('project-description', project.description);

        // === Galerie ===
        renderGallery(project.gallery || []);
    }

    // ============================================
    // RENDU DE LA GALERIE (style Atelier du Pont)
    // Alterne images plein écran et images centrées
    // ============================================
    function renderGallery(gallery) {
        const galleryEl = document.getElementById('project-gallery');
        if (!galleryEl || gallery.length === 0) {
            if (galleryEl) galleryEl.style.display = 'none';
            return;
        }

        galleryEl.innerHTML = '';

        gallery.forEach(function (item, index) {
            // Une image sur deux est en pleine largeur, l'autre est plus contenue
            // Crée un rythme visuel agréable
            const isFullWidth = index % 2 === 0;
            const wrapper = document.createElement('figure');
            wrapper.className = 'gallery-image-wrapper ' + (isFullWidth ? 'is-full' : 'is-narrow');

            const optimizedUrl = window.MCJP.cloudinaryOptimize(item.url, isFullWidth ? 2000 : 1200);

            const img = document.createElement('img');
            img.src = optimizedUrl;
            img.alt = item.caption || ('Image ' + (index + 1) + ' du projet');
            img.className = 'gallery-image';
            img.loading = 'lazy';
            img.decoding = 'async';

            wrapper.appendChild(img);

            if (item.caption) {
                const caption = document.createElement('figcaption');
                caption.className = 'gallery-caption';
                caption.textContent = item.caption;
                wrapper.appendChild(caption);
            }

            galleryEl.appendChild(wrapper);
        });
    }

    // ============================================
    // NAVIGATION PREV / NEXT
    // ============================================
    function renderNavigation(prev, next) {
        const prevLink = document.getElementById('project-prev');
        const nextLink = document.getElementById('project-next');

        if (prev && prevLink) {
            prevLink.href = '/projet?id=' + encodeURIComponent(prev.id);
            const titleEl = document.getElementById('project-prev-title');
            if (titleEl) titleEl.textContent = prev.title;
            prevLink.hidden = false;
        }

        if (next && nextLink) {
            nextLink.href = '/projet?id=' + encodeURIComponent(next.id);
            const titleEl = document.getElementById('project-next-title');
            if (titleEl) titleEl.textContent = next.title;
            nextLink.hidden = false;
        }
    }

    // ============================================
    // GESTION D'ERREUR (projet introuvable)
    // ============================================
    function showError() {
        const loading = document.getElementById('project-loading');
        const error = document.getElementById('project-error');
        if (loading) loading.hidden = true;
        if (error) error.hidden = false;
    }

    // ============================================
    // UTILITAIRES
    // ============================================
    function setText(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value || '—';
        }
    }

    function truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 1).trim() + '…';
    }

})();