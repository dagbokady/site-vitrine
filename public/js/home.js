/* ============================================
   HOME.JS — Slider hero + grilles par discipline
   ============================================ */

(function () {
    'use strict';

    const SLIDER_INTERVAL = 5000; // 5s par slide
    const PROJECTS_PER_DISCIPLINE = 3;

    const state = {
        allProjects: [],
        sliderIndex: 0,
        sliderProjects: [],
        autoPlayTimer: null,
        isPaused: false
    };

    document.addEventListener('DOMContentLoaded', async function () {
        // Header transparent → opaque au scroll
        setupHeaderScroll();

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
    // HEADER : transparent → blanc au scroll
    // ============================================
    function setupHeaderScroll() {
        const header = document.getElementById('site-header');
        if (!header) return;

        const heroHeight = window.innerHeight - 100;

        function update() {
            if (window.scrollY > heroHeight) {
                header.classList.add('is-scrolled');
            } else {
                header.classList.remove('is-scrolled');
            }
        }

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    update();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        update();
    }

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

            const imageUrl = window.MCJP.cloudinaryOptimize(project.cover, 2400);
            const meta = [
                getDisciplineLabel(project.discipline),
                project.year || window.MCJP.getStatusLabel(project.status)
            ].filter(Boolean).join(' · ');

            slide.innerHTML = `
        <img src="${escapeAttr(imageUrl)}"
             alt="${escapeAttr(project.title)}"
             class="hero-slide-image"
             ${index === 0 ? '' : 'loading="lazy"'}>
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

        // Filtrer + trier + prendre 3
        const projects = state.allProjects
            .filter(p => p.discipline === discipline)
            .sort((a, b) => {
                const orderA = a.order || 999;
                const orderB = b.order || 999;
                if (orderA !== orderB) return orderA - orderB;
                return (b.year || 0) - (a.year || 0);
            })
            .slice(0, PROJECTS_PER_DISCIPLINE);

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