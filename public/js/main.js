/* ============================================
   MAIN.JS — Comportements globaux du site
   Chargé sur toutes les pages
   ============================================ */

(function () {
    'use strict';

    /* ============================================
       MENU BURGER (mobile)
       ============================================ */
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const body = document.body;

    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', function () {
            const isOpen = mainNav.classList.toggle('is-open');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            menuToggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');

            // Empêche le scroll du body quand le menu mobile est ouvert
            body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Ferme le menu si on clique sur un lien (pratique sur mobile)
        const navLinks = mainNav.querySelectorAll('.nav-link');
        navLinks.forEach(function (link) {
            link.addEventListener('click', function () {
                mainNav.classList.remove('is-open');
                menuToggle.setAttribute('aria-expanded', 'false');
                body.style.overflow = '';
            });
        });

        // Ferme le menu avec la touche Échap (accessibilité)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mainNav.classList.contains('is-open')) {
                mainNav.classList.remove('is-open');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.focus();
                body.style.overflow = '';
            }
        });
    }

    /* ============================================
       HEADER QUI SE TRANSFORME AU SCROLL
       Ajoute une ombre légère quand on scrolle
       ============================================ */
    const header = document.getElementById('site-header');
    let lastScrollY = 0;

    if (header) {
        function updateHeader() {
            const currentScrollY = window.scrollY;

            if (currentScrollY > 20) {
                header.classList.add('is-scrolled');
            } else {
                header.classList.remove('is-scrolled');
            }

            lastScrollY = currentScrollY;
        }

        // Throttle simple via requestAnimationFrame (perf)
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
       LAZY LOAD natif des images
       Ajoute loading="lazy" à toutes les images sauf
       celles marquées "eager" (les hero)
       ============================================ */
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
        if (!img.classList.contains('eager')) {
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
        }
    });

    /* ============================================
       ANIMATION D'APPARITION DES SECTIONS
       Les sections apparaissent en fondu quand
       elles entrent dans le viewport
       ============================================ */
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    sectionObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.section, .page-header').forEach(function (section) {
            section.classList.add('fade-in');
            sectionObserver.observe(section);
        });
    }

    /* ============================================
       UTILITAIRE GLOBAL : exposer aux autres scripts
       ============================================ */
    window.MCJP = window.MCJP || {};

    // Utilitaire : récupère un texte de catégorie depuis son ID
    window.MCJP.getCategoryLabel = function (id, categoriesData) {
        if (!categoriesData) return id;
        const cat = categoriesData.find(function (c) { return c.id === id; });
        return cat ? cat.label : id;
    };

    // Utilitaire : libellé de statut
    window.MCJP.getStatusLabel = function (status) {
        const labels = {
            'realise': 'Réalisé',
            'etude': 'En étude',
            'concours': 'Concours'
        };
        return labels[status] || status;
    };

    // Utilitaire : transformation d'URL Cloudinary pour optimiser
    // Insère "f_auto,q_auto,w_XXX" dans l'URL
    window.MCJP.cloudinaryOptimize = function (url, width) {
        if (!url || !url.includes('cloudinary.com')) return url;
        const transformations = 'f_auto,q_auto' + (width ? ',w_' + width : '');
        return url.replace('/upload/', '/upload/' + transformations + '/');
    };

    // Utilitaire : fetch JSON avec gestion d'erreur
    window.MCJP.fetchProjects = async function () {
        try {
            const response = await fetch('/data/projects.json');
            if (!response.ok) {
                throw new Error('Erreur HTTP ' + response.status);
            }
            return await response.json();
        } catch (error) {
            console.error('Erreur de chargement des projets :', error);
            return null;
        }
    };

})();

/* ============================================
   STYLE D'ANIMATION (à ajouter via JS pour éviter
   les flashes de contenu non animé)
   ============================================ */
(function () {
    const style = document.createElement('style');
    style.textContent = `
    .fade-in {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
                  transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .fade-in.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .site-header.is-scrolled {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    @media (prefers-reduced-motion: reduce) {
      .fade-in {
        opacity: 1 !important;
        transform: none !important;
      }
    }
  `;
    document.head.appendChild(style);
})();