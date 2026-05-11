/* ============================================
   MAIN.JS — Comportements globaux + animations
   Chargé sur toutes les pages
   ============================================ */

(function () {
    'use strict';

    /* ============================================
       MENU BURGER (mobile)
       Le bouton ouvre l'overlay #mobile-nav
       ============================================ */
    const menuToggle = document.getElementById('menu-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    const body = document.body;

    if (menuToggle && mobileNav) {
        function closeMobileNav() {
            mobileNav.classList.remove('is-open');
            menuToggle.classList.remove('is-active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Ouvrir le menu');
            mobileNav.setAttribute('aria-hidden', 'true');
            body.style.overflow = '';
            // Re-cache via style inline défensif (au cas où le CSS externe n'est pas chargé)
            mobileNav.style.visibility = 'hidden';
            mobileNav.style.opacity = '0';
        }

        function openMobileNav() {
            // On retire d'abord le display:none inline défensif AVANT d'animer
            mobileNav.style.display = 'flex';
            mobileNav.style.visibility = 'visible';
            mobileNav.style.opacity = '1';
            // Force un reflow avant d'ajouter is-open (pour que la transition se déclenche)
            // eslint-disable-next-line no-unused-expressions
            mobileNav.offsetHeight;
            mobileNav.classList.add('is-open');
            menuToggle.classList.add('is-active');
            menuToggle.setAttribute('aria-expanded', 'true');
            menuToggle.setAttribute('aria-label', 'Fermer le menu');
            mobileNav.setAttribute('aria-hidden', 'false');
            body.style.overflow = 'hidden';
        }

        menuToggle.addEventListener('click', function () {
            if (mobileNav.classList.contains('is-open')) {
                closeMobileNav();
            } else {
                openMobileNav();
            }
        });

        // Ferme le menu quand on clique sur un lien (utile sur mobile)
        mobileNav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMobileNav);
        });

        // Ferme le menu si on clique en dehors des liens (sur le fond noir)
        mobileNav.addEventListener('click', function (e) {
            // Si le clic n'est pas sur un lien ou son parent direct
            if (e.target === mobileNav || e.target.classList.contains('mobile-nav-inner')) {
                closeMobileNav();
            }
        });

        // Ferme avec Échap
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) {
                closeMobileNav();
                menuToggle.focus();
            }
        });
    }

    /* ============================================
       HEADER QUI SE TRANSFORME AU SCROLL
       ============================================ */
    const header = document.getElementById('site-header');

    if (header) {
        function updateHeader() {
            if (window.scrollY > 20) {
                header.classList.add('is-scrolled');
            } else {
                header.classList.remove('is-scrolled');
            }
        }

        let ticking = false;
        window.addEventListener('scroll', function () {
            if (!ticking) {
                window.requestAnimationFrame(function () {
                    updateHeader();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        updateHeader();
    }

    /* ============================================
       LAZY LOAD natif
       ============================================ */
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
        if (!img.classList.contains('eager')) {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
        }
    });

    /* ============================================
       ANIMATIONS CINÉMA — Détecteur preferred motion
       ============================================ */
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ============================================
       SPLIT TEXT
       Découpe le texte en lettres/mots pour animer chaque caractère
       ============================================ */
    function splitTextIntoChars(element) {
        if (reducedMotion) return;
        if (element.dataset.splitDone) return;

        const text = element.textContent;
        const fragment = document.createDocumentFragment();
        const chars = Array.from(text);

        chars.forEach(function (char, i) {
            const span = document.createElement('span');
            span.className = 'split-char';
            span.style.setProperty('--char-index', i);
            span.textContent = char === ' ' ? '\u00A0' : char;
            fragment.appendChild(span);
        });

        element.innerHTML = '';
        element.appendChild(fragment);
        element.dataset.splitDone = 'true';
    }

    function splitTextIntoLines(element) {
        if (reducedMotion) return;
        if (element.dataset.splitDone) return;

        // Conserve les <br> en les transformant en sauts de ligne explicites
        const html = element.innerHTML;
        const lines = html.split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);

        if (lines.length === 0) {
            splitTextIntoChars(element);
            return;
        }

        const fragment = document.createDocumentFragment();
        lines.forEach(function (line, lineIndex) {
            const lineWrap = document.createElement('span');
            lineWrap.className = 'split-line';
            const inner = document.createElement('span');
            inner.className = 'split-line-inner';
            inner.style.setProperty('--line-index', lineIndex);
            inner.textContent = line;
            lineWrap.appendChild(inner);
            fragment.appendChild(lineWrap);
            if (lineIndex < lines.length - 1) {
                fragment.appendChild(document.createElement('br'));
            }
        });

        element.innerHTML = '';
        element.appendChild(fragment);
        element.dataset.splitDone = 'true';
    }

    /* ============================================
       OBSERVER D'ANIMATIONS SCROLL
       Tous les éléments avec [data-animate] sont
       déclenchés quand ils entrent dans le viewport
       ============================================ */
    if ('IntersectionObserver' in window && !reducedMotion) {
        // On split AVANT que l'observer déclenche (pour que le DOM soit prêt)
        document.querySelectorAll('[data-animate="split-text"]').forEach(splitTextIntoLines);

        const animateObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    animateObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -80px 0px'
        });

        document.querySelectorAll('[data-animate]').forEach(function (el) {
            animateObserver.observe(el);
        });

        // Fallback pour les sections + anciens .fade-in
        document.querySelectorAll('.section, .page-header').forEach(function (el) {
            if (!el.hasAttribute('data-animate')) {
                el.setAttribute('data-animate', 'fade-in');
                animateObserver.observe(el);
            }
        });
    } else {
        // Reduced motion : tout est visible directement
        document.querySelectorAll('[data-animate]').forEach(function (el) {
            el.classList.add('is-revealed');
        });
    }

    /* ============================================
       MAGNETIC HOVER
       Les liens .magnetic suivent légèrement la souris
       ============================================ */
    if (!reducedMotion && window.matchMedia('(hover: hover)').matches) {
        document.querySelectorAll('.magnetic').forEach(function (el) {
            const strength = parseFloat(el.dataset.magneticStrength) || 0.25;

            el.addEventListener('mousemove', function (e) {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
            });

            el.addEventListener('mouseleave', function () {
                el.style.transform = 'translate(0, 0)';
            });
        });
    }

    /* ============================================
       CURSEUR PERSONNALISÉ (subtil)
       Suit la souris avec un délai
       Désactivé sur mobile
       ============================================ */
    if (!reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        // Créer le curseur
        const cursor = document.createElement('div');
        cursor.className = 'custom-cursor';
        cursor.innerHTML = '<span class="custom-cursor-inner"></span>';
        document.body.appendChild(cursor);

        let mouseX = 0, mouseY = 0;
        let cursorX = 0, cursorY = 0;

        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animateCursor() {
            // Suivi avec lerp (lissage)
            cursorX += (mouseX - cursorX) * 0.15;
            cursorY += (mouseY - cursorY) * 0.15;
            cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
            requestAnimationFrame(animateCursor);
        }
        animateCursor();

        // Hover sur liens / boutons : agrandir le curseur
        const hoverables = 'a, button, .magnetic, [role="button"], input, textarea, select';
        document.querySelectorAll(hoverables).forEach(function (el) {
            el.addEventListener('mouseenter', () => cursor.classList.add('is-hovering'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('is-hovering'));
        });
    }

    /* ============================================
       PARALLAX au scroll
       Les éléments avec [data-parallax="X"] (vitesse)
       bougent verticalement au scroll
       ============================================ */
    if (!reducedMotion && 'IntersectionObserver' in window) {
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        if (parallaxElements.length > 0) {
            let parallaxTicking = false;

            function updateParallax() {
                parallaxElements.forEach(function (el) {
                    const speed = parseFloat(el.dataset.parallax) || 0.3;
                    const rect = el.getBoundingClientRect();
                    const winH = window.innerHeight;

                    // L'élément est-il dans/proche du viewport ?
                    if (rect.top < winH && rect.bottom > 0) {
                        // Distance depuis le centre du viewport
                        const elCenter = rect.top + rect.height / 2;
                        const winCenter = winH / 2;
                        const offset = (elCenter - winCenter) * speed;
                        el.style.setProperty('--parallax-y', `${-offset}px`);
                    }
                });
                parallaxTicking = false;
            }

            window.addEventListener('scroll', function () {
                if (!parallaxTicking) {
                    window.requestAnimationFrame(updateParallax);
                    parallaxTicking = true;
                }
            }, { passive: true });

            updateParallax();
        }
    }

    /* ============================================
       UTILITAIRES GLOBAUX
       ============================================ */
    window.MCJP = window.MCJP || {};

    window.MCJP.getCategoryLabel = function (id, categoriesData) {
        if (!categoriesData) return id;
        const cat = categoriesData.find(c => c.id === id);
        return cat ? cat.label : id;
    };

    window.MCJP.getStatusLabel = function (status) {
        const labels = {
            'realise': 'Réalisé',
            'etude': 'En étude',
            'concours': 'Concours'
        };
        return labels[status] || status;
    };

    window.MCJP.cloudinaryOptimize = function (url, width) {
        if (!url) return url;
        // Si c'est une URL Cloudinary, on injecte les transformations
        if (url.includes('cloudinary.com')) {
            const transformations = 'f_auto,q_auto' + (width ? ',w_' + width : '');
            return url.replace('/upload/', '/upload/' + transformations + '/');
        }
        // Sinon (placeholder Picsum etc), on renvoie tel quel
        return url;
    };

    window.MCJP.fetchProjects = async function () {
        try {
            const response = await fetch('/data/projects.json');
            if (!response.ok) throw new Error('Erreur HTTP ' + response.status);
            return await response.json();
        } catch (error) {
            console.error('Erreur de chargement des projets :', error);
            return null;
        }
    };

})();