const path = require('path');

const SCHOOL_LOGO_CID = 'school-logo';
const DEFAULT_SCHOOL_NAME = 'Apexiums School';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSchoolLogoAttachment() {
    return {
        filename: 'school-logo.png',
        path: path.join(__dirname, '..', '..', '..', 'frontend', 'images', 'logo.png'),
        cid: SCHOOL_LOGO_CID
    };
}

function getSchoolEmailBranding() {
    const schoolName = String(process.env.SMTP_FROM_NAME || process.env.SCHOOL_NAME || DEFAULT_SCHOOL_NAME).trim() || DEFAULT_SCHOOL_NAME;
    return { schoolName };
}

function renderDetailRows(rows = []) {
    return rows
        .filter(([label]) => label)
        .map(([label, value]) => `
            <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.03em">${escapeHtml(label)}</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:800;text-align:right">${escapeHtml(value || '-')}</td>
            </tr>
        `).join('');
}

function renderSchoolEmail(options = {}) {
    const branding = getSchoolEmailBranding();
    const {
        title = 'School Notice',
        badge = branding.schoolName,
        preheader = '',
        greeting = '',
        intro = '',
        rows = [],
        bodyHtml = '',
        accentColor = '#0f766e',
        footerNote = `This is an official email from ${branding.schoolName}.`,
        schoolName = branding.schoolName
    } = options;
    const displaySchoolName = String(schoolName || branding.schoolName || DEFAULT_SCHOOL_NAME).trim() || DEFAULT_SCHOOL_NAME;
    const preheaderHtml = preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>`
        : '';
    const greetingHtml = greeting ? `<p style="margin:0 0 12px;color:#111827;font-size:15px">Dear ${escapeHtml(greeting)},</p>` : '';
    const introHtml = intro ? `<p style="margin:0 0 18px;color:#334155;font-size:15px;line-height:1.7">${escapeHtml(intro)}</p>` : '';
    const rowsHtml = rows.length ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#ffffff;margin:18px 0">
            ${renderDetailRows(rows)}
        </table>
    ` : '';

    return `
        <!doctype html>
        <html>
        <body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827">
            ${preheaderHtml}
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f7;padding:28px 12px">
                <tr>
                    <td align="center">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.12)">
                            <tr>
                                <td style="background:${accentColor};padding:24px 28px;color:#ffffff">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                                        <tr>
                                            <td width="74" valign="middle">
                                                <img src="cid:${SCHOOL_LOGO_CID}" width="62" height="62" alt="${escapeHtml(displaySchoolName)}" style="display:block;border-radius:14px;background:#ffffff;padding:6px;object-fit:contain">
                                            </td>
                                            <td valign="middle" style="padding-left:14px">
                                                <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;opacity:.9">${escapeHtml(badge)}</div>
                                                <h1 style="margin:6px 0 0;font-size:24px;line-height:1.25;color:#ffffff">${escapeHtml(title)}</h1>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:28px">
                                    ${greetingHtml}
                                    ${introHtml}
                                    ${rowsHtml}
                                    ${bodyHtml}
                                    <div style="margin-top:24px;padding:16px 18px;border-left:4px solid ${accentColor};background:#f8fafc;border-radius:10px;color:#475569;font-size:13px;line-height:1.6">
                                        ${escapeHtml(footerNote)}
                                    </div>
                                    <p style="margin:22px 0 0;color:#111827;font-size:14px;font-weight:700">${escapeHtml(displaySchoolName)}</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:16px 28px;text-align:center;color:#64748b;font-size:12px">
                                    Please keep this email for your school records.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
}

module.exports = {
    SCHOOL_LOGO_CID,
    escapeHtml,
    getSchoolEmailBranding,
    getSchoolLogoAttachment,
    renderSchoolEmail
};
