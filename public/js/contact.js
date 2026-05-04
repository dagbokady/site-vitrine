/* ============================================
   CONTACT.JS — Formulaire de contact
   Validation côté client + envoi à /api/contact
   ============================================ */

(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('contact-form');
        if (!form) return;

        const submitBtn = document.getElementById('submit-btn');
        const feedbackBox = document.getElementById('form-feedback');
        const feedbackSuccess = document.getElementById('feedback-success');
        const feedbackError = document.getElementById('feedback-error');

        // ============================================
        // VALIDATION EN TEMPS RÉEL
        // À chaque blur (sortie du champ), on valide
        // ============================================
        const fieldsToValidate = ['firstname', 'lastname', 'email', 'phone', 'message'];

        fieldsToValidate.forEach(function (fieldId) {
            const field = document.getElementById(fieldId);
            if (!field) return;

            field.addEventListener('blur', function () {
                validateField(field);
            });

            // Efface l'erreur quand l'utilisateur recommence à taper
            field.addEventListener('input', function () {
                clearFieldError(field);
            });
        });

        // ============================================
        // SOUMISSION DU FORMULAIRE
        // ============================================
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Validation globale
            let isValid = true;
            fieldsToValidate.forEach(function (fieldId) {
                const field = document.getElementById(fieldId);
                if (field && !validateField(field)) {
                    isValid = false;
                }
            });

            if (!isValid) {
                // Focus sur le premier champ en erreur
                const firstError = form.querySelector('.has-error');
                if (firstError) firstError.focus();
                return;
            }

            // Vérification du honeypot (anti-spam)
            const honeypot = document.getElementById('website');
            if (honeypot && honeypot.value !== '') {
                // Bot détecté : on simule un succès pour ne pas le prévenir
                showSuccess();
                form.reset();
                return;
            }

            // ============================================
            // ENVOI DES DONNÉES
            // ============================================
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours…';

            try {
                const formData = {
                    firstname: form.firstname.value.trim(),
                    lastname: form.lastname.value.trim(),
                    email: form.email.value.trim(),
                    phone: form.phone.value.trim(),
                    company: form.company.value.trim(),
                    subject: form.subject.value,
                    message: form.message.value.trim()
                };

                // Si Cloudflare Turnstile est activé, on récupère le token
                const turnstileResponse = form.querySelector('[name="cf-turnstile-response"]');
                if (turnstileResponse) {
                    formData.turnstileToken = turnstileResponse.value;
                }

                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    throw new Error('Erreur HTTP ' + response.status);
                }

                const result = await response.json();

                if (result.success) {
                    showSuccess();
                    form.reset();
                } else {
                    throw new Error(result.error || 'Erreur inconnue');
                }

            } catch (error) {
                console.error('Erreur envoi formulaire :', error);
                showError();
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer le message';
            }
        });

        // ============================================
        // VALIDATION D'UN CHAMP (retourne true/false)
        // ============================================
        function validateField(field) {
            const value = field.value.trim();
            const fieldId = field.id;
            const errorEl = document.getElementById('error-' + fieldId);
            let errorMessage = '';

            // Champ requis et vide ?
            if (field.hasAttribute('required') && value === '') {
                errorMessage = 'Ce champ est requis.';
            }
            // Validation spécifique email
            else if (fieldId === 'email' && value !== '') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errorMessage = 'Adresse email invalide.';
                }
            }
            // Validation spécifique téléphone (si rempli, doit être valide)
            else if (fieldId === 'phone' && value !== '') {
                const phoneRegex = /^[\d\s+()\-.]{6,20}$/;
                if (!phoneRegex.test(value)) {
                    errorMessage = 'Numéro de téléphone invalide.';
                }
            }
            // Validation spécifique message (longueur min)
            else if (fieldId === 'message' && value !== '' && value.length < 10) {
                errorMessage = 'Votre message est trop court (10 caractères minimum).';
            }

            if (errorMessage) {
                field.classList.add('has-error');
                field.setAttribute('aria-invalid', 'true');
                if (errorEl) errorEl.textContent = errorMessage;
                return false;
            } else {
                clearFieldError(field);
                return true;
            }
        }

        function clearFieldError(field) {
            field.classList.remove('has-error');
            field.removeAttribute('aria-invalid');
            const errorEl = document.getElementById('error-' + field.id);
            if (errorEl) errorEl.textContent = '';
        }

        // ============================================
        // AFFICHAGE DES MESSAGES DE RETOUR
        // ============================================
        function showSuccess() {
            if (feedbackBox) feedbackBox.hidden = false;
            if (feedbackSuccess) feedbackSuccess.hidden = false;
            if (feedbackError) feedbackError.hidden = true;

            // Scroll doux vers le message
            if (feedbackBox) {
                feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        function showError() {
            if (feedbackBox) feedbackBox.hidden = false;
            if (feedbackError) feedbackError.hidden = false;
            if (feedbackSuccess) feedbackSuccess.hidden = true;

            if (feedbackBox) {
                feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });

})();