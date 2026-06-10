import {
    readMessages,
    writeMessages,
    generateMessageId
} from './_helpers.js';

export const config = {
    runtime: 'nodejs'
};

export default async function handler(req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Méthode non autorisée'
        });
    }

    try {
        const data =
            typeof req.body === 'string'
                ? JSON.parse(req.body)
                : req.body;

        const errors = [];

        if (!data.firstname || data.firstname.trim().length < 2) {
            errors.push('Prénom requis');
        }

        if (!data.lastname || data.lastname.trim().length < 2) {
            errors.push('Nom requis');
        }

        if (
            !data.email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
        ) {
            errors.push('Email invalide');
        }

        if (!data.message || data.message.trim().length < 10) {
            errors.push('Message trop court');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: errors.join(', ')
            });
        }

        const turnstileSecret = process.env.TURNSTILE_SECRET;

        if (turnstileSecret && data.turnstileToken) {
            const verifyResp = await fetch(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        secret: turnstileSecret,
                        response: data.turnstileToken
                    })
                }
            );

            const verifyData = await verifyResp.json();

            if (!verifyData.success) {
                return res.status(403).json({
                    success: false,
                    error: 'Vérification anti-bot échouée'
                });
            }
        }

        const subjectLabel = getSubjectLabel(data.subject);

        const newMessage = {
            id: generateMessageId(),
            firstname: data.firstname,
            lastname: data.lastname,
            email: data.email,
            phone: data.phone || '',
            company: data.company || '',
            subject: data.subject || '',
            subjectLabel,
            message: data.message,
            createdAt: new Date().toISOString(),
            read: false
        };

        const { messages, sha } = await readMessages();

        messages.unshift(newMessage);

        await writeMessages(
            messages.slice(0, 500),
            sha,
            `[admin] Nouveau message : ${data.firstname} ${data.lastname}`
        );

        return res.status(200).json({
            success: true
        });

    } catch (error) {
        console.error('Erreur API contact :', error);

        return res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
}

function getSubjectLabel(value) {
    const labels = {
        residentiel: 'Projet résidentiel',
        tertiaire: 'Bâtiment tertiaire / bureaux',
        hotellerie: 'Hôtellerie / tourisme',
        infrastructure: 'Infrastructure / équipement public',
        urbanisme: 'Urbanisme / aménagement',
        conseil: 'Conseil en investissement',
        autre: 'Autre'
    };

    return labels[value] || '';
}