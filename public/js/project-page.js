/* ============================================
   PROJECT-PAGE.JS — Page projet refondue
   - Remplit la section 1 (cover style "Du Pont")
   - Injecte les sections dynamiques (2 à 5)
   - Gère le scroll snap + indicateur + clavier
   - Navigation prev/next entre projets
   ============================================ */

(function () {
    'use strict';

    const state = {
        project: null,
        sortedProjects: [],
        sectionElements: [],
        currentSectionIndex: 0
    };

    document.addEventListener('DOMContentLoaded', async function () {
        // 1. Lire l'ID dans l'URL
        const params = new URLSearchParams(window.location.search);
        const projectId = params.get('id');

        if (!projectId) {
            showError();
            return;
        }

        // Charger les projets
        const data = await window.MCJP.fetchProjects();
        if (!data || !data.projects) {
            showError();
            return;
        }

        // Recherche tolérante : par id, slug, ou en slugifiant le titre
        const idNormalized = projectId.toLowerCase().trim();
        let project = data.projects.find(p => p.id === idNormalized);

        // Fallback 1 : par slug
        if (!project) {
            project = data.projects.find(p => p.slug === idNormalized);
        }

        // Fallback 2 : par titre slugifié (résout les anciens IDs avec espaces / majuscules)
        if (!project) {
            project = data.projects.find(p => slugify(p.title) === idNormalized);
        }

        // Fallback 3 : matching partiel (ex: "tour-cacao" matche "tour-cacao-v2")
        if (!project) {
            project = data.projects.find(p =>
                p.id.includes(idNormalized) || idNormalized.includes(p.id)
            );
        }

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
        buildCoverSection(project);
        buildDynamicSections(project);
        buildSectionIndicator();
        setupPlansChevrons();
        setupPlansLightbox();
        setupScrollObserver();
        setupProjectNavigation(project);
        setupKeyboardNav();

        // 5. Afficher : on cache loading + on montre les sections
        const loadingEl = document.getElementById('project-loading');
        const errorEl = document.getElementById('project-error');
        const snapEl = document.getElementById('project-snap');
        const endEl = document.getElementById('project-end');
        const indicatorEl = document.getElementById('section-indicator');

        if (loadingEl) { loadingEl.hidden = true; loadingEl.classList.add('is-hidden'); }
        if (errorEl)   { errorEl.hidden = true;   errorEl.classList.add('is-hidden'); }
        if (snapEl)      { snapEl.hidden = false;      snapEl.classList.remove('is-hidden'); }
        if (endEl)       { endEl.hidden = false;       endEl.classList.remove('is-hidden'); }
        if (indicatorEl) { indicatorEl.hidden = false; indicatorEl.classList.remove('is-hidden'); }

        // 6. Métadonnées de la page
        setPageMeta(project);
    });

    // ============================================
    // SECTION 1 : COVER (style Du Pont)
    // Codée en dur dans le HTML, juste à remplir
    // ============================================
    function buildCoverSection(project) {
        // Image de couverture
        const coverImg = document.getElementById('cover-image');
        if (coverImg) {
            const url = window.MCJP.cloudinaryOptimize(project.cover, 2000);
            coverImg.src = url;
            coverImg.alt = project.title || 'Couverture du projet';
        }

        // Discipline
        const discEl = document.getElementById('cover-discipline');
        if (discEl) discEl.textContent = getDisciplineLabel(project.discipline);

        // Statut + année
        const statusEl = document.getElementById('cover-status');
        if (statusEl) {
            const parts = [];
            if (project.status) parts.push(window.MCJP.getStatusLabel(project.status));
            if (project.year) parts.push(project.year);
            statusEl.textContent = parts.join(' · ');
        }

        // Titre + sous-titre
        setText('cover-title', project.title);
        setText('cover-subtitle', project.subtitle);

        // Métadonnées (lieu, surface, client)
        setText('cover-meta-location-value', project.location || '—');
        setText('cover-meta-surface-value', project.surface && project.surface !== '—' ? project.surface : '—');
        setText('cover-meta-client-value', truncate(project.client || '—', 30));

        // Cacher les rows vides pour ne pas avoir "—" partout
        hideMetaRowIfEmpty('location', project.location);
        hideMetaRowIfEmpty('surface', project.surface);
        hideMetaRowIfEmpty('client', project.client);

        // Header centre (apparaît au scroll)
        const headerCenter = document.getElementById('project-header-center');
        if (headerCenter) {
            headerCenter.hidden = false;
            const disc = document.getElementById('header-discipline');
            const title = document.getElementById('header-title');
            if (disc) disc.textContent = getDisciplineLabel(project.discipline);
            if (title) title.textContent = project.title;
        }
    }

    function hideMetaRowIfEmpty(field, value) {
        if (!value || value === '—') {
            const row = document.querySelector(`.cover-meta-row[data-meta="${field}"]`);
            if (row) row.style.display = 'none';
        }
    }

    // ============================================
    // SECTIONS 2 → 5 : injectées dynamiquement
    // ============================================
    function buildDynamicSections(project) {
        const container = document.getElementById('dynamic-sections');
        if (!container) return;
        container.innerHTML = '';

        // La section "cover" (index 0) fait déjà partie du DOM
        state.sectionElements = [document.querySelector('.section-cover')];

        // On filtre les sections valides (on saute "hero" car déjà couvert par la cover)
        const sections = (project.sections || []).filter(s => s.type !== 'hero');

        sections.forEach((section, i) => {
            const realIndex = i + 1; // section 0 = cover
            const sectionEl = renderSection(section, project, realIndex);
            if (sectionEl) {
                sectionEl.setAttribute('data-section-index', String(realIndex));
                container.appendChild(sectionEl);
                state.sectionElements.push(sectionEl);
            }
        });

        // Mettre à jour le total dans la cover (ex: 01 / 05)
        const totalEl = document.getElementById('cover-page-total');
        if (totalEl) {
            totalEl.textContent = String(state.sectionElements.length).padStart(2, '0');
        }
    }

    function renderImageText(section) {
        const imageUrl = window.MCJP.cloudinaryOptimize(section.image, 1600);
        return `
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(section.title || 'Image du projet')}" class="section-image-text-image" loading="lazy">
      <div class="section-image-text-content">
        <p class="section-image-text-eyebrow">À propos du projet</p>
        ${section.title ? `<h2 class="section-image-text-title">${escapeHtml(section.title)}</h2>` : ''}
        <div class="section-image-text-body">${sanitizeRichText(section.text || '')}</div>
      </div>
    `;
    }

    /**
     * Sanitize le HTML produit par l'éditeur admin (rich-text).
     * Whitelist : <strong>, <b>, <em>, <i>, <br>, <span style="color: ..."> et <span class="rt-large">
     * Toute autre balise est supprimée.
     */
    function sanitizeRichText(html) {
        if (!html) return '';
        // Si le contenu ne contient aucune balise HTML, on l'échappe simplement et on ajoute des <br>
        if (!/[<>]/.test(html)) return escapeHtml(html).replace(/\n/g, '<br>');

        const tmpl = document.createElement('template');
        tmpl.innerHTML = html;

        const allowedTags = new Set(['STRONG', 'B', 'EM', 'I', 'BR', 'SPAN', 'P', 'DIV']);
        const walker = document.createTreeWalker(tmpl.content, NodeFilter.SHOW_ELEMENT);
        const toRemove = [];
        let node;
        while ((node = walker.nextNode())) {
            if (!allowedTags.has(node.tagName)) {
                toRemove.push(node);
                continue;
            }
            // Sanitize les attributs : ne garder que style:color, class:rt-large
            Array.from(node.attributes).forEach(attr => {
                if (attr.name === 'style') {
                    const colorMatch = attr.value.match(/color\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|[a-zA-Z]+)/);
                    if (colorMatch) {
                        node.setAttribute('style', `color: ${colorMatch[1]}`);
                    } else {
                        node.removeAttribute('style');
                    }
                } else if (attr.name === 'class') {
                    // ne garder que les classes whitelistées
                    const allowed = attr.value.split(/\s+/).filter(c => c === 'rt-large');
                    if (allowed.length) node.setAttribute('class', allowed.join(' '));
                    else node.removeAttribute('class');
                } else {
                    node.removeAttribute(attr.name);
                }
            });
        }
        // Retirer les balises non whitelistées (en gardant leur contenu textuel)
        toRemove.forEach(el => {
            while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
            el.remove();
        });

        return tmpl.innerHTML;
    }

    function renderContext(section) {
        // Même layout que section 2 (image-text) : texte gauche 40% / image droite 60%
        // Seule différence : l'eyebrow "Contexte & implantation" et pas de titre optionnel
        const imageUrl = window.MCJP.cloudinaryOptimize(section.image, 1600);
        return `
      <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(section.caption || 'Contexte & implantation')}" class="section-image-text-image" loading="lazy">
      <div class="section-image-text-content">
        <p class="section-image-text-eyebrow">Contexte &amp; implantation</p>
        ${section.caption ? `<h2 class="section-image-text-title">${escapeHtml(section.caption)}</h2>` : ''}
      </div>
    `;
    }

    function renderGallery(section) {
        const images = section.images || [];
        const gridClass = 'section-gallery' + (images.length === 3 ? ' has-3' : '');

        const imagesHtml = images.map(img => {
            const url = window.MCJP.cloudinaryOptimize(img.url, 1400);
            return `
        <figure class="section-gallery-item">
          <img src="${escapeAttr(url)}" alt="${escapeAttr(img.caption || 'Image de la galerie')}" loading="lazy">
          ${img.caption ? `<figcaption class="section-gallery-caption">${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
        }).join('');

        // On enveloppe la grille dans une section pour appliquer la classe
        return imagesHtml;
    }

    function renderPlans(section) {
        const images = section.images || [];
        const uid = 'plans-' + Math.random().toString(36).slice(2, 8);

        const imagesHtml = images.map((img, i) => {
            // URL miniature pour la grille, URL haute résolution pour le lightbox
            const thumbUrl = window.MCJP.cloudinaryOptimize(img.url, 1400);
            const fullUrl  = window.MCJP.cloudinaryOptimize(img.url, 3200);
            return `
        <figure class="section-plans-item" data-lightbox-index="${i}" data-lightbox-group="${uid}">
          <img src="${escapeAttr(thumbUrl)}"
               data-full="${escapeAttr(fullUrl)}"
               data-caption="${escapeAttr(img.caption || '')}"
               alt="${escapeAttr(img.caption || 'Plan technique ' + (i+1))}"
               loading="lazy"
               class="plans-thumb">
          ${img.caption ? `<figcaption class="section-plans-caption">${escapeHtml(img.caption)}</figcaption>` : ''}
        </figure>
      `;
        }).join('');

        return `
      <div class="section-plans-inner">
        <header class="section-plans-header">
          <p class="section-plans-eyebrow">Plans &amp; dessins techniques</p>
          <div class="section-plans-controls">
            <button type="button" class="plans-chevron" data-plans-prev="${uid}" aria-label="Voir les plans précédents">←</button>
            <button type="button" class="plans-chevron" data-plans-next="${uid}" aria-label="Voir les plans suivants">→</button>
          </div>
        </header>
        <div class="section-plans-grid" data-plans-grid="${uid}">${imagesHtml}</div>
      </div>
    `;
    }

    // Hack pour les sections gallery : on doit modifier la classe du <section> wrapper
    // (parce que la grille fait partie de la section)
    function renderSection(section, project, index) {
        const wrapper = document.createElement('section');

        if (section.type === 'gallery') {
            const images = section.images || [];
            wrapper.className = 'project-section section-gallery' + (images.length === 3 ? ' has-3' : '');
            wrapper.innerHTML = renderGallery(section);
        } else {
            // La section "context" réutilise volontairement les styles de "image-text"
            // (même layout 40/60, même image plein bord) — seul l'eyebrow change
            const cssType = section.type === 'context' ? 'image-text' : section.type;
            wrapper.className = 'project-section section-' + cssType;
            switch (section.type) {
                case 'image-text':
                    wrapper.innerHTML = renderImageText(section);
                    break;
                case 'context':
                    wrapper.innerHTML = renderContext(section);
                    break;
                case 'plans':
                    wrapper.innerHTML = renderPlans(section);
                    break;
                default:
                    return null;
            }
        }

        return wrapper;
    }

    // ============================================
    // INDICATEUR DE PAGES (à droite)
    // ============================================
    function buildSectionIndicator() {
        const list = document.getElementById('indicator-list');
        if (!list) return;
        list.innerHTML = '';

        state.sectionElements.forEach((_, index) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.className = 'indicator-dot' + (index === 0 ? ' is-active' : '');
            btn.setAttribute('data-section-index', String(index));
            btn.setAttribute('aria-label', `Aller à la page ${index + 1}`);
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

        // Met à jour le numéro de page dans la cover
        const currentEl = document.getElementById('cover-page-current');
        if (currentEl) {
            currentEl.textContent = String(index + 1).padStart(2, '0');
        }
    }

    function goToSection(index) {
        if (state.sectionElements[index]) {
            state.sectionElements[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // ============================================
    // CHEVRONS de défilement horizontal pour la section Plans
    // ============================================
    function setupPlansChevrons() {
        document.querySelectorAll('.plans-chevron').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const isNext = btn.hasAttribute('data-plans-next');
                const uid = btn.getAttribute(isNext ? 'data-plans-next' : 'data-plans-prev');
                const grid = document.querySelector(`[data-plans-grid="${uid}"]`);
                if (!grid) return;
                // Faire défiler d'environ la largeur d'une card
                const card = grid.querySelector('.section-plans-item');
                const cardW = card ? card.getBoundingClientRect().width : 200;
                const gap = 12; // var(--space-3)
                const delta = (cardW + gap) * (isNext ? 1 : -1);
                grid.scrollBy({ left: delta, behavior: 'smooth' });
            });
        });

        // Met à jour l'état disabled des chevrons selon la position de scroll
        document.querySelectorAll('.section-plans-grid').forEach(grid => {
            const uid = grid.getAttribute('data-plans-grid');
            const prevBtn = document.querySelector(`[data-plans-prev="${uid}"]`);
            const nextBtn = document.querySelector(`[data-plans-next="${uid}"]`);
            function updateChevrons() {
                if (!prevBtn || !nextBtn) return;
                const atStart = grid.scrollLeft <= 5;
                const atEnd = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 5;
                prevBtn.disabled = atStart;
                nextBtn.disabled = atEnd;
            }
            grid.addEventListener('scroll', updateChevrons, { passive: true });
            window.addEventListener('resize', updateChevrons);
            // Initial
            setTimeout(updateChevrons, 100);
        });
    }

    // ============================================
    // LIGHTBOX pour les plans & dessins techniques
    // Clic sur une card → overlay plein écran avec
    // navigation prev/next + fermeture esc/clic fond
    // ============================================
    function setupPlansLightbox() {
        // Créer l'overlay une seule fois dans le DOM
        const overlay = document.createElement('div');
        overlay.className = 'plans-lightbox';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Vue agrandie du plan');
        overlay.hidden = true;
        overlay.innerHTML = `
      <div class="plans-lb-backdrop"></div>
      <div class="plans-lb-content">
        <div class="plans-lb-img-wrap">
          <img class="plans-lb-img" src="" alt="">
          <div class="plans-lb-spinner"></div>
        </div>
        <p class="plans-lb-caption"></p>
        <p class="plans-lb-hint">Cliquez sur l'image pour zoomer</p>
      </div>
      <button class="plans-lb-close" aria-label="Fermer">✕</button>
      <button class="plans-lb-prev" aria-label="Plan précédent">←</button>
      <button class="plans-lb-next" aria-label="Plan suivant">→</button>
      <p class="plans-lb-counter"></p>
    `;
        document.body.appendChild(overlay);

        // État courant du lightbox
        let currentGroup = null;   // uid du groupe
        let currentIndex = 0;
        let allItems = [];         // toutes les figures du groupe

        const lbImg     = overlay.querySelector('.plans-lb-img');
        const lbCaption = overlay.querySelector('.plans-lb-caption');
        const lbCounter = overlay.querySelector('.plans-lb-counter');
        const lbSpinner = overlay.querySelector('.plans-lb-spinner');
        const lbHint    = overlay.querySelector('.plans-lb-hint');

        function openLightbox(group, index) {
            currentGroup = group;
            allItems = Array.from(
                document.querySelectorAll(`[data-lightbox-group="${group}"] img.plans-thumb`)
            );
            currentIndex = index;
            overlay.hidden = false;
            document.body.style.overflow = 'hidden';
            loadImage(index);
            updateNav();
        }

        function closeLightbox() {
            overlay.hidden = true;
            document.body.style.overflow = '';
            lbImg.src = '';
            currentGroup = null;
        }

        function loadImage(idx) {
            const img = allItems[idx];
            if (!img) return;

            const fullSrc = img.dataset.full || img.src;
            const caption = img.dataset.caption || img.alt || '';

            lbImg.classList.add('is-loading');
            lbSpinner.style.display = 'block';
            lbHint.style.display = 'none';

            const tempImg = new Image();
            tempImg.onload = () => {
                lbImg.src = fullSrc;
                lbImg.alt = caption;
                lbImg.classList.remove('is-loading');
                lbSpinner.style.display = 'none';
                lbHint.style.display = 'block';
            };
            tempImg.onerror = () => {
                lbImg.src = img.src;   // fallback sur la miniature
                lbImg.classList.remove('is-loading');
                lbSpinner.style.display = 'none';
            };
            tempImg.src = fullSrc;

            lbCaption.textContent = caption;
            lbCounter.textContent = `${idx + 1} / ${allItems.length}`;
        }

        function navigate(dir) {
            currentIndex = (currentIndex + dir + allItems.length) % allItems.length;
            loadImage(currentIndex);
            updateNav();
        }

        function updateNav() {
            const prevBtn = overlay.querySelector('.plans-lb-prev');
            const nextBtn = overlay.querySelector('.plans-lb-next');
            prevBtn.style.display = allItems.length <= 1 ? 'none' : '';
            nextBtn.style.display = allItems.length <= 1 ? 'none' : '';
        }

        // Toggle zoom au clic sur l'image
        lbImg.addEventListener('click', () => {
            lbImg.classList.toggle('is-zoomed');
            lbHint.textContent = lbImg.classList.contains('is-zoomed')
                ? 'Cliquez pour dézoomer'
                : 'Cliquez sur l\'image pour zoomer';
        });

        // Fermeture
        overlay.querySelector('.plans-lb-close').addEventListener('click', closeLightbox);
        overlay.querySelector('.plans-lb-backdrop').addEventListener('click', closeLightbox);

        // Navigation
        overlay.querySelector('.plans-lb-prev').addEventListener('click', () => navigate(-1));
        overlay.querySelector('.plans-lb-next').addEventListener('click', () => navigate(+1));

        // Clavier
        document.addEventListener('keydown', (e) => {
            if (overlay.hidden) return;
            if (e.key === 'Escape')      { e.preventDefault(); closeLightbox(); }
            if (e.key === 'ArrowLeft')   { e.preventDefault(); navigate(-1); }
            if (e.key === 'ArrowRight')  { e.preventDefault(); navigate(+1); }
        });

        // Swipe tactile
        let touchStartX = 0;
        overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        overlay.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
        });

        // Délégation de clic sur toutes les figures de plan
        document.addEventListener('click', (e) => {
            const figure = e.target.closest('[data-lightbox-group]');
            if (!figure) return;
            const group = figure.dataset.lightboxGroup;
            const index = parseInt(figure.dataset.lightboxIndex, 10);
            if (!isNaN(index)) openLightbox(group, index);
        });
    }
    function setupScrollObserver() {
        if (!('IntersectionObserver' in window)) return;

        const headerCenter = document.getElementById('project-header-center');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    const index = parseInt(entry.target.getAttribute('data-section-index'), 10);
                    if (!isNaN(index) && index !== state.currentSectionIndex) {
                        state.currentSectionIndex = index;
                        updateActiveDot(index);

                        // Le titre dans le header apparaît dès qu'on quitte la cover (index 0)
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
            if (e.target.matches('input, textarea, select')) return;

            const container = document.getElementById('project-snap');
            if (!container || container.hidden) return;

            const total = state.sectionElements.length;
            const current = state.currentSectionIndex;

            if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                if (current < total - 1) goToSection(current + 1);
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                if (current > 0) goToSection(current - 1);
            } else if (e.key === 'Home') {
                e.preventDefault();
                goToSection(0);
            } else if (e.key === 'End') {
                e.preventDefault();
                goToSection(total - 1);
            }
        });
    }

    // ============================================
    // PREV / NEXT entre projets
    // ============================================
    function setupProjectNavigation(project) {
        const idx = state.sortedProjects.findIndex(p => p.id === project.id);
        const prev = idx > 0 ? state.sortedProjects[idx - 1] : null;
        const next = idx < state.sortedProjects.length - 1 ? state.sortedProjects[idx + 1] : null;

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
    // METADATA DE PAGE (SEO)
    // ============================================
    function setPageMeta(project) {
        document.title = `${project.title} — Mc.Johnson & Partners`;

        const metaDesc = document.getElementById('meta-description');
        if (metaDesc && project.description) {
            metaDesc.setAttribute('content', truncate(project.description, 160));
        }

        // Schema.org JSON-LD pour SEO
        const schema = {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            "name": project.title,
            "description": project.description || project.subtitle,
            "image": project.cover,
            "creator": {
                "@type": "Organization",
                "name": "Mc.Johnson & Partners",
                "url": "https://mc-johnson-partners.com"
            },
            "dateCreated": project.year ? String(project.year) : undefined,
            "locationCreated": project.location ? { "@type": "Place", "name": project.location } : undefined
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    // ============================================
    // ERROR
    // ============================================
    function showError() {
        const loadingEl = document.getElementById('project-loading');
        const errorEl = document.getElementById('project-error');
        const snapEl = document.getElementById('project-snap');
        const endEl = document.getElementById('project-end');
        const indicatorEl = document.getElementById('section-indicator');

        if (loadingEl)   { loadingEl.hidden = true; loadingEl.classList.add('is-hidden'); }
        if (snapEl)      { snapEl.hidden = true;      snapEl.classList.add('is-hidden'); }
        if (endEl)       { endEl.hidden = true;       endEl.classList.add('is-hidden'); }
        if (indicatorEl) { indicatorEl.hidden = true; indicatorEl.classList.add('is-hidden'); }
        if (errorEl)     { errorEl.hidden = false;    errorEl.classList.remove('is-hidden'); }
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

    function slugify(text) {
        if (!text) return '';
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // retire les accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function setText(elementId, value) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = value || '—';
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