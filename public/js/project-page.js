/* ============================================
   PROJECT-PAGE.JS — Page projet en scroll snap
   - Lit ?id=xxx dans l'URL
   - Construit les 5 sections selon le type
   - Indicateur latéral synchronisé au scroll
   - Touches clavier : flèches haut/bas, Espace
   - Prev/Next entre projets
   ============================================ */

(function () {
    'use strict';

    const state = {
        project: null,
        sortedProjects: [],
        currentIndex: 0,
        sectionElements: []
    };

    document.addEventListener('DOMContentLoaded', async function () {
        // 1. Lire l'ID
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');

        if (!projectId) {
            showError();
            return;
        }

        // 2. Charger les projets
        const data = await window.MCJP.fetchProjects();
        if (!data || !data.projects) {
            showError();
            return;
        }

        const project = data.projects.find(p => p.id === projectId);
        if (!project) {
            showError();
            return;
        }

        state.project = project;

        // 3. Préparer le tri pour prev/next
        state.sortedProjects = data.projects.slice().sort((a, b) => {
            const orderA = a.order || 999;
            const orderB = b.order || 999;
            if (orderA !== orderB) return orderA - orderB;
            return (b.year || 0) - (a.year || 0);
        });

        // 4. Construire la page
        buildProjectPage(project);

        // 5. Construire l'indicateur de sections
        buildSectionIndicator(project.sections || []);

        // 6. Scroll observer
        setupScrollObserver();

        // 7. Navigation prev/next
        setupProjectNavigation(project);

        // 8. Clavier
        setupKeyboardNav();

        // 9. Affichage
        document.getElementById('project-loading').hidden = true;
        document.getElementById('project-snap').hidden = false;
        document.getElementById('project-end').hidden = false;
        document.getElementById('section-indicator').hidden = false;
    });

    // ============================================
    // CONSTRUCTION DE LA PAGE
    // ============================================
    function buildProjectPage(project) {
        // Métadonnées de la page
        document.title = `${project.title} — Mc.Johnson & Partners`;
        const metaDesc = document.getElementById('meta-description');
        if (metaDesc && project.description) {
            metaDesc.setAttribute('content', truncate(project.description, 160));
        }

        // Header centre (apparaît dès la 2e section)
        const headerCenter = document.getElementById('project-header-center');
        if (headerCenter) {
            headerCenter.hidden = false;
            const disc = document.getElementById('header-discipline');
            const title = document.getElementById('header-title');
            if (disc) disc.textContent = getDisciplineLabel(project.discipline);
            if (title) title.textContent = project.title;
        }

        // Sections
        const container = document.getElementById('project-snap');
        container.innerHTML = '';
        state.sectionElements = [];

        const sections = project.sections || [];
        sections.forEach((section, index) => {
            const sectionEl = renderSection(section, project, index);
            if (sectionEl) {
                sectionEl.setAttribute('data-section-index', String(index));
                container.appendChild(sectionEl);
                state.sectionElements.push(sectionEl);
            }
        });
    }

    // ============================================
    // RENDU DE CHAQUE TYPE DE SECTION
    // ============================================
    function renderSection(section, project, index) {
        const wrapper = document.createElement('section');
        wrapper.className = 'project-section section-' + section.type;

        switch (section.type) {
            case 'hero':
                wrapper.innerHTML = renderHero(section, project);
                break;
            case 'image-text':
                wrapper.innerHTML = renderImageText(section);
                break;
            case 'context':
                wrapper.innerHTML = renderContext(section);
                break;
            case 'gallery':
                wrapper.innerHTML = renderGallery(section);
                break;
            case 'plans':
                wrapper.innerHTML = renderPlans(section);
                break;
            default:
                return null;
        }

        return wrapper;
    }

    function renderHero(section, project) {
        const imageUrl = window.MCJP.cloudinaryOptimize(section.image, 2400);
        const alt = section.alt || project.title;

        return `
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(alt)}" class="section-hero-image">
      <div class="section-hero-text">
        <div class="section-hero-text-inner">
          <p class="section-hero-discipline">${escapeHtml(getDisciplineLabel(project.discipline))}${project.status ? ' · ' + escapeHtml(window.MCJP.getStatusLabel(project.status)) : ''}</p>
          <h1 class="section-hero-title">${escapeHtml(project.title)}</h1>
          <p class="section-hero-subtitle">${escapeHtml(project.subtitle || '')}</p>
        </div>
      </div>
      <div class="section-hero-meta">
        ${project.year ? `<div><strong>${escapeHtml(project.year)}</strong></div>` : ''}
        ${project.location ? `<div>${escapeHtml(project.location)}</div>` : ''}
        ${project.surface && project.surface !== '—' ? `<div>${escapeHtml(project.surface)}</div>` : ''}
        ${project.client ? `<div>${escapeHtml(project.client)}</div>` : ''}
      </div>
    `;
    }

    function renderImageText(section) {
        const imageUrl = window.MCJP.cloudinaryOptimize(section.image, 1600);
        return `
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(section.title || '')}" class="section-image-text-image">
      <div class="section-image-text-content">
        <p class="section-image-text-eyebrow">À propos du projet</p>
        ${section.title ? `<h2 class="section-image-text-title">${escapeHtml(section.title)}</h2>` : ''}
        <p class="section-image-text-body">${escapeHtml(section.text || '')}</p>
      </div>
    `;
    }

    function renderContext(section) {
        const imageUrl = window.MCJP.cloudinaryOptimize(section.image, 1600);
        return `
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(section.caption || 'Plan de contexte')}" class="section-context-image">
      ${section.caption ? `<p class="section-context-caption">${escapeHtml(section.caption)}</p>` : ''}
    `;
    }

    function renderGallery(section) {
        const images = section.images || [];
        const gridClass = 'section-gallery-grid' + (images.length === 3 ? ' has-3' : '');

        const imagesHtml = images.map(img => {
            const url = window.MCJP.cloudinaryOptimize(img.url, 1200);
            return `
        <figure class="section-gallery-item">
          <img src="${escapeAttr(url)}" alt="${escapeAttr(img.caption || '')}" loading="lazy">
          ${img.caption ? `<figcaption class="section-gallery-caption">${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
        }).join('');

        return `<div class="${gridClass}">${imagesHtml}</div>`;
    }

    function renderPlans(section) {
        const images = section.images || [];
        const gridClass = 'section-plans-grid' + (images.length > 1 ? ' has-multiple' : '');

        const imagesHtml = images.map(img => {
            const url = window.MCJP.cloudinaryOptimize(img.url, 1600);
            return `
        <figure class="section-plans-item">
          <img src="${escapeAttr(url)}" alt="${escapeAttr(img.caption || 'Plan technique')}" loading="lazy">
          ${img.caption ? `<figcaption class="section-plans-caption">${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
        }).join('');

        return `
      <p class="section-plans-eyebrow">Plans &amp; dessins</p>
      <div class="${gridClass}">${imagesHtml}</div>
    `;
    }

    // ============================================
    // INDICATEUR DE SECTIONS (à droite)
    // ============================================
    function buildSectionIndicator(sections) {
        const list = document.getElementById('indicator-list');
        if (!list) return;
        list.innerHTML = '';

        sections.forEach((section, index) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'indicator-dot';
            btn.setAttribute('data-section-index', String(index));
            btn.setAttribute('aria-label', `Aller à la section ${index + 1}`);
            if (index === 0) btn.classList.add('is-active');

            btn.addEventListener('click', () => goToSection(index));
            li.appendChild(btn);
            list.appendChild(li);
        });
    }

    function updateActiveDot(index) {
        document.querySelectorAll('.indicator-dot').forEach(dot => {
            const dotIndex = parseInt(dot.getAttribute('data-section-index'), 10);
            dot.classList.toggle('is-active', dotIndex === index);
        });
    }

    function goToSection(index) {
        if (state.sectionElements[index]) {
            state.sectionElements[index].scrollIntoView({ behavior: 'smooth' });
        }
    }

    // ============================================
    // SCROLL OBSERVER
    // ============================================
    function setupScrollObserver() {
        if (!('IntersectionObserver' in window)) return;

        const headerCenter = document.getElementById('project-header-center');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    const index = parseInt(entry.target.getAttribute('data-section-index'), 10);
                    if (!isNaN(index)) {
                        updateActiveDot(index);

                        // Le titre dans le header apparaît dès qu'on est plus sur la section hero (index 0)
                        if (headerCenter) {
                            if (index > 0) {
                                headerCenter.classList.add('is-visible');
                            } else {
                                headerCenter.classList.remove('is-visible');
                            }
                        }
                    }
                }
            });
        }, {
            root: document.getElementById('project-snap'),
            threshold: [0.5]
        });

        state.sectionElements.forEach(el => observer.observe(el));
    }

    // ============================================
    // NAVIGATION CLAVIER
    // ============================================
    function setupKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            // On ignore si l'utilisateur tape dans un champ
            if (e.target.matches('input, textarea, select')) return;

            const container = document.getElementById('project-snap');
            if (!container || container.hidden) return;

            const currentDot = document.querySelector('.indicator-dot.is-active');
            if (!currentDot) return;

            const currentIdx = parseInt(currentDot.getAttribute('data-section-index'), 10);

            if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                if (currentIdx < state.sectionElements.length - 1) {
                    goToSection(currentIdx + 1);
                }
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                if (currentIdx > 0) {
                    goToSection(currentIdx - 1);
                }
            } else if (e.key === 'Home') {
                e.preventDefault();
                goToSection(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                goToSection(state.sectionElements.length - 1);
            }
        });
    }

    // ============================================
    // PREV / NEXT entre projets
    // ============================================
    function setupProjectNavigation(project) {
        const currentIndex = state.sortedProjects.findIndex(p => p.id === project.id);
        const prev = currentIndex > 0 ? state.sortedProjects[currentIndex - 1] : null;
        const next = currentIndex < state.sortedProjects.length - 1 ? state.sortedProjects[currentIndex + 1] : null;

        if (prev) {
            const link = document.getElementById('project-prev');
            const title = document.getElementById('project-prev-title');
            if (link) {
                link.href = '/projet?id=' + encodeURIComponent(prev.id);
                link.hidden = false;
            }
            if (title) title.textContent = prev.title;
        }

        if (next) {
            const link = document.getElementById('project-next');
            const title = document.getElementById('project-next-title');
            if (link) {
                link.href = '/projet?id=' + encodeURIComponent(next.id);
                link.hidden = false;
            }
            if (title) title.textContent = next.title;
        }
    }

    // ============================================
    // GESTION D'ERREUR
    // ============================================
    function showError() {
        document.getElementById('project-loading').hidden = true;
        document.getElementById('project-error').hidden = false;
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

    function truncate(text, max) {
        if (!text) return '';
        return text.length <= max ? text : text.substring(0, max - 1).trim() + '…';
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