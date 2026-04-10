const { createHandler, sendJson } = require('../_lib/http');
const { createEmailTransporter, getEmailConfig } = require('../_lib/services');

module.exports = createHandler({
    POST: async ({ res, body }) => {
        const transporter = createEmailTransporter();
        const emailConfig = getEmailConfig();
        const { to, cc, bcc, subject, message } = body || {};

        if (!emailConfig.configured || !transporter) {
            sendJson(res, 400, {
                success: false,
                message: 'SMTP is not configured. Add SMTP settings in Vercel env vars.'
            });
            return;
        }

        const normalizeRecipients = (value) => {
            if (Array.isArray(value)) {
                return value.map((item) => String(item || '').trim()).filter(Boolean);
            }

            return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
        };

        const toList = normalizeRecipients(to);
        const ccList = normalizeRecipients(cc);
        const bccList = normalizeRecipients(bcc);

        if (!toList.length) {
            sendJson(res, 400, { success: false, message: 'At least one recipient email is required.' });
            return;
        }

        if (!subject || !String(subject).trim()) {
            sendJson(res, 400, { success: false, message: 'Email subject is required.' });
            return;
        }

        if (!message || !String(message).trim()) {
            sendJson(res, 400, { success: false, message: 'Email message is required.' });
            return;
        }

        const info = await transporter.sendMail({
            from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
            to: toList.join(', '),
            cc: ccList.length ? ccList.join(', ') : undefined,
            bcc: bccList.length ? bccList.join(', ') : undefined,
            subject: String(subject).trim(),
            text: String(message).trim(),
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;white-space:pre-wrap;">${String(message).trim()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')}</div>`
        });

        sendJson(res, 200, {
            success: true,
            message: 'Email sent successfully.',
            messageId: info.messageId
        });
    }
});
