/* ============================================
   HOME.JS — Slider hero + grilles par discipline
   ============================================ */

(function () {
    'use strict';

    const SLIDER_INTERVAL = 5000; // 5s par slide

    // Nombre de projets affichés par discipline sur la home.
    // Architecture met en avant 3 lignes (15 projets), les autres 1 ligne (5 projets).
    const PROJECTS_PER_DISCIPLINE = {
        architecture: 15,
        design: 5,
        urbanisme: 5
    };

    const state = {
        allProjects: [],
        sliderIndex: 0,
        sliderProjects: [],
        autoPlayTimer: null,
        isPaused: false
    };

    document.addEventListener('DOMContentLoaded', async function () {
        // Header transparent → opaque au scroll : géré dans main.js (seuil adaptatif)

        // Charger les projets
        const data = await window.MCJP.fetchProjects();
        if (!data || !data.projects) {
            showLoadError();
            return;
        }

        state.allProjects = data.projects;

        // Slider hero (3 plus récents)
        setupHeroSlider();

        // Grilles par discipline
        renderDisciplineGrids();
    });

    // ============================================
    // HEADER : transformation au scroll
    // → Géré globalement dans /js/main.js avec seuil adaptatif
    //   selon que le header a la classe .site-header--over-hero
    // ============================================
    // setupHeaderScroll() retiré : doublon avec main.js

    // ============================================
    // SLIDER HERO
    // ============================================
    function setupHeroSlider() {
        // Tri : par date de création décroissante, on prend les 3 plus récents
        const recent = state.allProjects
            .slice()
            .sort((a, b) => {
                // Si createdAt existe on l'utilise, sinon par year
                const dateA = a.createdAt || `${a.year || 0}-01-01`;
                const dateB = b.createdAt || `${b.year || 0}-01-01`;
                return dateB.localeCompare(dateA);
            })
            .slice(0, 3);

        if (recent.length === 0) {
            showLoadError();
            return;
        }

        state.sliderProjects = recent;

        const loading = document.getElementById('hero-loading');
        const slidesEl = document.getElementById('hero-slides');
        const dotsEl = document.getElementById('hero-dots');
        const cta = document.getElementById('hero-cta');
        const prevBtn = document.getElementById('hero-prev');
        const nextBtn = document.getElementById('hero-next');

        loading.hidden = true;
        slidesEl.hidden = false;
        dotsEl.hidden = false;
        cta.hidden = false;
        prevBtn.hidden = false;
        nextBtn.hidden = false;

        // Construction des slides
        slidesEl.innerHTML = '';
        dotsEl.innerHTML = '';

        recent.forEach((project, index) => {
            // Slide
            const slide = document.createElement('div');
            slide.className = 'hero-slide' + (index === 0 ? ' is-active' : '');
            slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
            slide.setAttribute('role', 'tabpanel');

            const meta = [
                getDisciplineLabel(project.discipline),
                project.year || window.MCJP.getStatusLabel(project.status)
            ].filter(Boolean).join(' · ');

            // === DÉTECTION VIDÉO vs IMAGE ===
            // Si project.cover finit par .mp4 / .webm / .mov, on génère un <video>.
            // Sinon : <img> classique.
            // → Cloudinary délivre les vidéos depuis la même URL (pas besoin de pattern spécial)
            // → Pour utiliser une vidéo, le client upload simplement un .mp4 ou .webm
            //   dans le champ "Image de couverture" (n'importe lequel des 2 champs).
            const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(project.cover || '');
            const mediaUrl = isVideo
                ? project.cover  // pas d'optimisation Cloudinary pour vidéo (URL inchangée)
                : window.MCJP.cloudinaryOptimize(project.cover, 2400);

            const mediaHtml = isVideo
                ? `<video class="hero-slide-image hero-slide-video"
                  src="${escapeAttr(mediaUrl)}"
                  autoplay muted loop playsinline preload="metadata"
                  aria-label="${escapeAttr(project.title)}"></video>`
                : `<img src="${escapeAttr(mediaUrl)}"
                alt="${escapeAttr(project.title)}"
                class="hero-slide-image"
                ${index === 0 ? '' : 'loading="lazy"'}>`;

            slide.innerHTML = `
        ${mediaHtml}
        <div class="hero-slide-text">
          <div class="hero-slide-text-inner">
            <p class="hero-slide-meta">${escapeHtml(meta)}</p>
            <h1 class="hero-slide-title">${escapeHtml(project.title)}</h1>
            <p class="hero-slide-subtitle">${escapeHtml(project.subtitle || '')}</p>
          </div>
        </div>
      `;
            slidesEl.appendChild(slide);

            // Dot
            const dot = document.createElement('button');
            dot.className = 'hero-dot' + (index === 0 ? ' is-active' : '');
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Projet ${index + 1} : ${project.title}`);
            dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
            dot.addEventListener('click', () => goToSlide(index));
            dotsEl.appendChild(dot);
        });

        // CTA
        updateCTA(0);

        // Flèches
        prevBtn.addEventListener('click', () => {
            const newIndex = (state.sliderIndex - 1 + recent.length) % recent.length;
            goToSlide(newIndex);
        });
        nextBtn.addEventListener('click', () => {
            const newIndex = (state.sliderIndex + 1) % recent.length;
            goToSlide(newIndex);
        });

        // ============================================
        // AUTO-PLAY : continu, JAMAIS de pause au survol
        // Aucun event mouseenter/mouseleave sur le slider
        // La pause ne se déclenche QUE si l'onglet est caché
        // ============================================
        const slider = document.getElementById('hero-slider');

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (state.autoPlayTimer) {
                    clearInterval(state.autoPlayTimer);
                    state.autoPlayTimer = null;
                }
            } else {
                // Reprise immédiate : on relance toujours, peu importe isPaused
                startAutoPlay();
            }
        });

        // Clavier (flèches gauche/droite)
        slider.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goToSlide((state.sliderIndex - 1 + recent.length) % recent.length);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goToSlide((state.sliderIndex + 1) % recent.length);
            }
        });

        // Démarrer auto-play
        startAutoPlay();
    }

    function goToSlide(index) {
        if (index === state.sliderIndex) return;

        const slides = document.querySelectorAll('.hero-slide');
        const dots = document.querySelectorAll('.hero-dot');

        slides.forEach((slide, i) => {
            slide.classList.toggle('is-active', i === index);
            slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('is-active', i === index);
            dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        });

        state.sliderIndex = index;
        updateCTA(index);

        // Reset le timer pour redémarrer un cycle complet de 5s
        // (toujours, peu importe isPaused — l'utilisateur veut juste reset le compteur)
        startAutoPlay();
    }

    function updateCTA(index) {
        const cta = document.getElementById('hero-cta');
        const project = state.sliderProjects[index];
        if (cta && project) {
            cta.href = '/projet?id=' + encodeURIComponent(project.id);
        }
    }

    function startAutoPlay() {
        // Si tab caché, on n'essaie pas de démarrer
        if (document.hidden) return;
        if (state.autoPlayTimer) clearInterval(state.autoPlayTimer);
        state.autoPlayTimer = setInterval(() => {
            const next = (state.sliderIndex + 1) % state.sliderProjects.length;
            goToSlide(next);
        }, SLIDER_INTERVAL);
    }

    function pauseAutoPlay() {
        if (state.autoPlayTimer) {
            clearInterval(state.autoPlayTimer);
            state.autoPlayTimer = null;
        }
    }

    function resumeAutoPlay() {
        startAutoPlay();
    }

    // ============================================
    // GRILLES PAR DISCIPLINE (3+3+3)
    // ============================================
    function renderDisciplineGrids() {
        ['architecture', 'design', 'urbanisme'].forEach(disc => {
            renderDisciplineGrid(disc);
        });
    }

    function renderDisciplineGrid(discipline) {
        const grid = document.getElementById('grid-' + discipline);
        if (!grid) return;

        const limit = PROJECTS_PER_DISCIPLINE[discipline] || 5;

        // Filtrer + trier + prendre le bon nombre
        const projects = state.allProjects
            .filter(p => p.discipline === discipline)
            .sort((a, b) => {
                const orderA = a.order || 999;
                const orderB = b.order || 999;
                if (orderA !== orderB) return orderA - orderB;
                return (b.year || 0) - (a.year || 0);
            })
            .slice(0, limit);

        grid.innerHTML = '';

        if (projects.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'discipline-empty';
            empty.textContent = 'Aucun projet dans cette discipline pour le moment.';
            grid.appendChild(empty);
            return;
        }

        projects.forEach(p => {
            grid.appendChild(createThumb(p));
        });
    }

    function createThumb(project) {
        const link = document.createElement('a');
        link.href = '/projet?id=' + encodeURIComponent(project.id);
        link.className = 'thumb thumb-cinematic';
        link.setAttribute('aria-label', `Voir le projet ${project.title}`);
        link.setAttribute('data-animate', 'reveal-up');

        const imageUrl = window.MCJP.cloudinaryOptimize(project.cover, 800);
        const meta = [
            project.year || window.MCJP.getStatusLabel(project.status),
            project.location || ''
        ].filter(Boolean).join(' · ');

        link.innerHTML = `
      <div class="thumb-image-wrap">
        <img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(project.title)}" class="thumb-image" loading="lazy">
      </div>
      <div class="thumb-text">
        <p class="thumb-meta">${escapeHtml(meta)}</p>
        <h4 class="thumb-title">${escapeHtml(project.title)}</h4>
      </div>
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
        const loading = document.getElementById('hero-loading');
        if (loading) {
            loading.innerHTML = '<p style="color: rgba(255,255,255,0.5);">Impossible de charger les projets.</p>';
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