const axios = require('axios');

function normalizePakistaniPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('92')) return digits;
    if (digits.startsWith('0')) return `92${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('3')) return `92${digits}`;
    return digits;
}

function getWhatsAppConfig() {
    return {
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN || '',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        apiVersion: process.env.WHATSAPP_API_VERSION || 'v22.0'
    };
}

async function sendWhatsAppMessage(student, message) {
    const { accessToken, phoneNumberId, apiVersion } = getWhatsAppConfig();
    const to = normalizePakistaniPhone(student?.parentPhone || student?.phone);

    if (!accessToken || !phoneNumberId) {
        return { success: false, skipped: true, reason: 'WhatsApp credentials are not configured.' };
    }

    if (!to) {
        return { success: false, skipped: true, reason: 'Parent phone is missing.' };
    }

    const response = await axios.post(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: {
                preview_url: false,
                body: message || `Happy Birthday ${student?.fullName || 'Student'}!`
            }
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        }
    );

    return { success: true, to, data: response.data };
}

module.exports = {
    normalizePakistaniPhone,
    sendWhatsAppMessage
};
