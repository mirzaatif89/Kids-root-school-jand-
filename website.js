const apiBase = '/api';

const state = {
    students: [],
    teachers: [],
    staff: [],
    notices: [],
    branches: [],
    banners: []
};
let activeBannerIndex = 0;
let bannerTimer = null;

function text(value, fallback = '-') {
    const clean = String(value ?? '').trim();
    return clean || fallback;
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
}

async function getJson(endpoint, fallback) {
    try {
        const response = await fetch(`${apiBase}${endpoint}`);
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn(`Website data unavailable for ${endpoint}:`, error.message);
        return fallback;
    }
}

function groupStudentsByClass(students) {
    const groups = new Map();
    students.forEach((student) => {
        const className = text(student.className || student.class || student.grade || student.admissionClass, 'Unassigned');
        groups.set(className, (groups.get(className) || 0) + 1);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderStats() {
    const classes = groupStudentsByClass(state.students);
    setText('studentCount', state.students.length);
    setText('teacherCount', state.teachers.length);
    setText('staffCount', state.staff.length);
    setText('classCount', classes.length);
    setText('liveSummary', `${state.students.length} students, ${state.teachers.length} teachers, ${classes.length} classes`);
}

function renderClasses() {
    const container = document.getElementById('classList');
    if (!container) return;
    const classes = groupStudentsByClass(state.students);
    if (!classes.length) {
        container.innerHTML = '<p class="empty-state">No class records found yet.</p>';
        return;
    }
    container.innerHTML = classes.slice(0, 8).map(([className, count]) => `
        <div class="class-item">
            <strong>${escapeHtml(className)}</strong>
            <span>${count} student${count === 1 ? '' : 's'} registered</span>
        </div>
    `).join('');
}

function renderFaculty() {
    const container = document.getElementById('facultyList');
    if (!container) return;
    if (!state.teachers.length) {
        container.innerHTML = '<p class="empty-state">No teacher records found yet.</p>';
        return;
    }
    container.innerHTML = state.teachers.slice(0, 6).map((teacher) => `
        <div class="faculty-item">
            <strong>${escapeHtml(text(teacher.fullName, 'Teacher'))}</strong>
            <span>${escapeHtml(text(teacher.subject || teacher.designation, 'Faculty'))}</span>
        </div>
    `).join('');
}

function renderNotices() {
    const container = document.getElementById('noticeList');
    if (!container) return;
    if (!state.notices.length) {
        container.innerHTML = '<p class="empty-state">No public notices available yet.</p>';
        return;
    }
    container.innerHTML = state.notices.slice(0, 5).map((notice) => `
        <div class="notice-item">
            <strong>${escapeHtml(text(notice.title, 'Notice'))}</strong>
            <span>${escapeHtml(text(notice.message, '')).slice(0, 180)}</span>
        </div>
    `).join('');
}

function renderContact() {
    const activeBranch = state.branches.find((branch) => branch.isActive !== false) || state.branches[0];
    const address = text(activeBranch?.campusName || activeBranch?.fullName, 'Main Campus');
    setText('headerAddress', address);
    setText('contactAddress', address);
}

function renderBanners() {
    const section = document.getElementById('websiteBannerSection');
    const track = document.getElementById('websiteBannerTrack');
    const dots = document.getElementById('websiteBannerDots');
    if (!section || !track || !dots) return;

    const activeBanners = state.banners
        .filter((banner) => banner && banner.isActive !== false && text(banner.imageUrl, ''))
        .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));

    if (!activeBanners.length) {
        section.hidden = true;
        track.innerHTML = '';
        dots.innerHTML = '';
        if (bannerTimer) window.clearInterval(bannerTimer);
        bannerTimer = null;
        return;
    }

    section.hidden = false;
    activeBannerIndex = Math.min(activeBannerIndex, activeBanners.length - 1);
    track.innerHTML = activeBanners.map((banner, index) => {
        const image = `<img src="${escapeHtml(banner.imageUrl)}" alt="${escapeHtml(text(banner.title, 'School banner'))}">`;
        const media = text(banner.linkUrl, '')
            ? `<a class="website-banner-media" href="${escapeHtml(banner.linkUrl)}">${image}</a>`
            : `<div class="website-banner-media">${image}</div>`;
        return `
            <article class="website-banner-slide${index === activeBannerIndex ? ' active' : ''}" data-banner-slide="${index}">
                ${media}
                <div class="website-banner-caption">
                    <h2>${escapeHtml(text(banner.title, 'Apexiums School System'))}</h2>
                    ${text(banner.subtitle, '') ? `<p>${escapeHtml(banner.subtitle)}</p>` : ''}
                </div>
            </article>
        `;
    }).join('');

    dots.innerHTML = activeBanners.map((banner, index) => `
        <button type="button" class="${index === activeBannerIndex ? 'active' : ''}" data-banner-dot="${index}" aria-label="Show ${escapeHtml(text(banner.title, `banner ${index + 1}`))}"></button>
    `).join('');

    dots.querySelectorAll('[data-banner-dot]').forEach((button) => {
        button.addEventListener('click', () => {
            activeBannerIndex = Number(button.dataset.bannerDot || 0);
            renderBanners();
        });
    });

    if (bannerTimer) window.clearInterval(bannerTimer);
    if (activeBanners.length > 1) {
        bannerTimer = window.setInterval(() => {
            activeBannerIndex = (activeBannerIndex + 1) % activeBanners.length;
            renderBanners();
        }, 6000);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[char]));
}

async function loadWebsiteData() {
    const [students, teachers, staff, noticePayload, branches, bannerPayload] = await Promise.all([
        getJson('/students', []),
        getJson('/teachers', []),
        getJson('/staff', []),
        getJson('/special-notices', { notices: [] }),
        getJson('/branches', []),
        getJson('/banners', { banners: [] })
    ]);

    state.students = Array.isArray(students) ? students : [];
    state.teachers = Array.isArray(teachers) ? teachers : [];
    state.staff = Array.isArray(staff) ? staff : [];
    state.notices = Array.isArray(noticePayload?.notices) ? noticePayload.notices : [];
    state.branches = Array.isArray(branches) ? branches : [];
    state.banners = Array.isArray(bannerPayload?.banners) ? bannerPayload.banners : [];

    renderBanners();
    renderStats();
    renderClasses();
    renderFaculty();
    renderNotices();
    renderContact();
}

function setupNavigation() {
    const toggle = document.querySelector('.menu-toggle');
    const links = document.getElementById('siteNavLinks');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
        const isOpen = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });
    links.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            links.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function setupInquiryForm() {
    const form = document.getElementById('inquiryForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = text(document.getElementById('inquiryName')?.value, '');
        const className = text(document.getElementById('inquiryClass')?.value, '');
        const phone = text(document.getElementById('inquiryPhone')?.value, '');
        const message = text(document.getElementById('inquiryMessage')?.value, '');
        const body = encodeURIComponent(`Name: ${name}\nClass: ${className}\nPhone: ${phone}\n\n${message}`);
        window.location.href = `mailto:info@apexiums.edu.pk?subject=Admission Inquiry&body=${body}`;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupInquiryForm();
    loadWebsiteData();
    if (window.lucide) window.lucide.createIcons();
});
