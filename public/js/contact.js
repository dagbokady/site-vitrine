/* ============================================
   /js/contact.js
   Gestion du formulaire de contact côté client
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const submitBtn = document.getElementById('submit-btn');
    const feedback = document.getElementById('form-feedback');
    const successMsg = document.getElementById('feedback-success');
    const errorMsg = document.getElementById('feedback-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi en cours...';
        }

        if (feedback) feedback.hidden = true;
        if (successMsg) successMsg.hidden = true;
        if (errorMsg) errorMsg.hidden = true;

        try {
            const payload = {
                firstname: form.firstname.value.trim(),
                lastname: form.lastname.value.trim(),
                email: form.email.value.trim(),
                phone: form.phone.value.trim(),
                company: form.company.value.trim(),
                subject: form.subject.value,
                message: form.message.value.trim(),
                website: form.website.value.trim()
            };

            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Erreur lors de l’envoi');
            }

            form.reset();

            if (feedback) feedback.hidden = false;
            if (successMsg) successMsg.hidden = false;

        } catch (err) {
            console.error(err);

            if (feedback) feedback.hidden = false;
            if (errorMsg) errorMsg.hidden = false;
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Envoyer le message';
            }
        }
    });
});