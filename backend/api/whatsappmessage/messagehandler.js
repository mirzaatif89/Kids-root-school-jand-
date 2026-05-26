const axios = require("axios");

/**
 * Normalize Pakistani phone to E.164 (92XXXXXXXXXX)
 */
function normalizePakistaniPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");

    if (!digits) return null;
    if (digits.startsWith("00")) {digits = digits.slice(2);}
    if (digits.startsWith("0")) {digits = "92" + digits.slice(1);}
    if (digits.length === 10 && digits.startsWith("3")) {digits = "92" + digits;}

    if (!digits.startsWith("92")) return null;
    return digits;
}

function getWhatsAppConfig() {
    const accessToken =
        process.env.WHATSAPP_ACCESS_TOKEN ||
        process.env.META_WHATSAPP_TOKEN;

    const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
    
    if (!accessToken || !phoneNumber) {
        throw new Error("Missing WhatsApp configuration in environment variables");
    }

    return { accessToken, phoneNumber };
}

async function sendMessageRequest({ url, payload, headers, retries = 3 }) {
    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await axios.post(url, payload, {
                headers,
                timeout: 15000, // if cannot responce backend so automatically request cancelled 
            });

            return {
                success: true,
                data: response.data,
                attempt,
            };
        } catch (err) {
            lastError = err;

            const status = err.response?.status;

          if (status >= 400 && status < 500 && status !== 429) {
                break;
            }
            // wait before retry (exponential backoff)
            await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
    }

    return {
        success: false,
        error: lastError?.response?.data || lastError.message,
    };
}

async function sendWhatsAppMessage(student, message) {
    try {
        const { accessToken, phoneNumber } = getWhatsAppConfig();

        const to = normalizePakistaniPhone(
            student?.parentPhone || student?.phone
        );

        if (!to) {
            return {
                success: false,
                skipped: true,
                reason: "Invalid or missing phone number",
            };
        }

        const url = `https://live-mt-server.wati.io/10166110/api/v1/sendSessionMessage/${to}`;

        const payload = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: {
                preview_url: false,
                body: message,
            },
        };

        const headers = {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        };

        const result = await sendMessageRequest({
            url,
            payload,
            headers,
            retries: 3,
        });

        if (!result.success) {
            return {
                success: false,
                to,
                error: result.error,
            };
        }

        return {
            success: true,
            to,
            data: result.data,
            attempt: result.attempt,
        };
    } catch (err) {
        return {
            success: false,
            error: err.message,
        };
    }
}

module.exports = {
    sendWhatsAppMessage,
    normalizePakistaniPhone,
};