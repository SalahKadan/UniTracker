// App State
const state = {
  currentUniId: null,
  currentUser: null,
  authMode: 'login'
};

// Constants
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_COL = { 'Sunday': 2, 'Monday': 3, 'Tuesday': 4, 'Wednesday': 5, 'Thursday': 6 };
const START_HOUR = 8;
const END_HOUR = 21;
const TOTAL_ROWS = END_HOUR - START_HOUR;

// Selection state for click-to-create
const selection = {
  active: false,
  day: null,
  startHour: null,
  endHour: null
};

const UNI_NAMES = {
  huji: 'Hebrew University of Jerusalem',
  tau: 'Tel Aviv University',
  bgu: 'Ben-Gurion University of the Negev',
  haifa: 'University of Haifa'
};

// DOM
const views = {
  welcome: document.getElementById('view-welcome'),
  auth: document.getElementById('view-auth'),
  student: document.getElementById('view-student')
};
const navbar = document.getElementById('navbar');
const navbarLanding = document.getElementById('navbar-landing');

// ==================== INIT ====================
function init() {
  const savedUserId = localStorage.getItem('uniSchedule_session');
  let restored = false;

  if (savedUserId) {
    const user = window.api.getUser(savedUserId);
    if (user) {
      state.currentUser = user;
      state.currentUniId = user.uniId;
      restored = true;
    } else {
      localStorage.removeItem('uniSchedule_session');
    }
  }

  const hash = window.location.hash.replace('#', '');
  
  if (restored) {
    if (hash === 'student') {
      loadDashboard();
    } else {
      loadDashboard();
    }
  } else {
    if (hash === 'auth') {
      showView('auth');
    } else {
      showView('welcome');
    }
  }

  setupEventListeners();
}

function showView(viewId) {
  Object.values(views).forEach(v => {
    if (v) {
      v.classList.remove('active');
      v.classList.add('hidden');
    }
  });
  if (views[viewId]) {
    views[viewId].classList.remove('hidden');
    views[viewId].classList.add('active');
  }

  if (viewId === 'welcome') {
    window.location.hash = '';
  } else {
    window.location.hash = viewId;
  }

  // Navbar visibility
  if (viewId === 'welcome') {
    navbar.classList.add('hidden');
    navbarLanding.classList.remove('hidden');
  } else if (viewId === 'auth') {
    navbar.classList.add('hidden');
    navbarLanding.classList.add('hidden');
  } else {
    navbarLanding.classList.add('hidden');
    navbar.classList.remove('hidden');
    if (state.currentUser) {
      document.getElementById('nav-user-name').textContent = state.currentUser.username;
      document.getElementById('nav-uni-name').textContent = UNI_NAMES[state.currentUniId] || '';
        UNI_NAMES[state.currentUniId] || '';
    }
  }

  // Auth mode display
  if (viewId === 'auth') {
    updateAuthUI();
  }

  // Scroll to top on view change
  window.scrollTo(0, 0);
}

function updateAuthUI() {
  const isLogin = state.authMode === 'login';
  document.getElementById('auth-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-desc').textContent = isLogin
    ? 'Enter your credentials to access your schedule.'
    : 'Fill in your details to get started with UniSchedule.';
  document.getElementById('btn-auth-submit').textContent = isLogin ? 'Login' : 'Create Account';
  document.getElementById('auth-toggle-text').textContent = isLogin
    ? "Don't have an account?"
    : 'Already have an account?';
  document.getElementById('btn-toggle-auth').textContent = isLogin ? 'Sign Up' : 'Login';

  // Show/hide fields
  document.getElementById('signup-fields').classList.toggle('hidden', isLogin);
  document.getElementById('login-uni-field').classList.toggle('hidden', !isLogin);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Toggle Auth Mode
  document.getElementById('btn-toggle-auth').addEventListener('click', () => {
    state.authMode = state.authMode === 'login' ? 'signup' : 'login';
    updateAuthUI();
  });

  // Auth Form Submit
  document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    if (state.authMode === 'login') {
      const uniId = document.getElementById('login-university').value;
      const user = window.api.login(username, password);
      if (user) {
        if (user.uniId !== uniId) {
          alert('This account does not belong to the selected university.');
          return;
        }
        state.currentUniId = uniId;
        state.currentUser = user;
        localStorage.setItem('uniSchedule_session', user.id);
        loadDashboard();
      } else {
        alert('Invalid username or password.');
      }
    } else {
      // Signup
      const uniId = document.getElementById('auth-university').value;
      const email = document.getElementById('auth-email').value.trim();
      const firstname = document.getElementById('auth-firstname').value.trim();
      const lastname = document.getElementById('auth-lastname').value.trim();
      const studentid = document.getElementById('auth-studentid').value.trim();
      const faculty = document.getElementById('auth-faculty').value.trim();

      if (!uniId) { alert('Please select your university.'); return; }
      if (!firstname || !lastname) { alert('Please enter your full name.'); return; }
      if (!email) { alert('Please enter your email address.'); return; }

      const res = window.api.signup(username, password, uniId, {
        email, firstname, lastname, studentid, faculty
      });
      if (res.success) {
        state.currentUniId = uniId;
        state.currentUser = res.user;
        localStorage.setItem('uniSchedule_session', res.user.id);
        loadDashboard();
      } else {
        alert(res.error);
      }
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', () => {
    state.currentUser = null;
    state.currentUniId = null;
    state.authMode = 'login';
    localStorage.removeItem('uniSchedule_session');
    document.getElementById('auth-form').reset();
    showView('welcome');
  });

  // Modals — Request Course
  document.getElementById('btn-open-request-modal').addEventListener('click', () => {
    document.getElementById('modal-request').classList.remove('hidden');
  });
  document.getElementById('close-request-modal').addEventListener('click', () => {
    document.getElementById('modal-request').classList.add('hidden');
  });
  document.getElementById('form-request-course').addEventListener('submit', (e) => {
    e.preventDefault();
    submitCourseRequest();
  });

  // Modals — Custom Event
  document.getElementById('btn-open-custom-modal').addEventListener('click', () => {
    document.getElementById('modal-custom').classList.remove('hidden');
  });
  document.getElementById('close-custom-modal').addEventListener('click', () => {
    document.getElementById('modal-custom').classList.add('hidden');
  });
  document.getElementById('form-custom-event').addEventListener('submit', (e) => {
    e.preventDefault();
    submitCustomEvent();
  });

  // Modals — Edit Event
  document.getElementById('close-edit-modal').addEventListener('click', () => {
    document.getElementById('modal-edit').classList.add('hidden');
  });
  document.getElementById('form-edit-event').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveEdit();
  });
  document.getElementById('btn-delete-event').addEventListener('click', () => {
    handleDeleteEvent();
  });

  // Modals — Course Info
  document.getElementById('close-info-modal').addEventListener('click', () => {
    document.getElementById('modal-course-info').classList.add('hidden');
  });
  document.getElementById('btn-delete-course-global').addEventListener('click', (e) => {
    // Fallback to getAttribute in case dataset is not parsing property correctly in some edge browsers
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    if (!code) {
      alert("Error: Course code not found. Cannot delete.");
      return;
    }
    
    if (confirm(`Are you sure you want to permanently delete ${code} and all its sections from the global catalog?`)) {
      if (window.api.deleteCourseGlobal(code, state.currentUniId)) {
        document.getElementById('modal-course-info').classList.add('hidden');
        renderStudentDashboard();
      } else {
        alert("Deletion failed or course was not found globally.");
      }
    }
  });

  document.getElementById('btn-remove-course-schedule').addEventListener('click', (e) => {
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    const sections = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === code);
    sections.forEach(s => window.api.removeFromSchedule(state.currentUser.id, s.id));
    document.getElementById('modal-course-info').classList.add('hidden');
    renderStudentDashboard();
  });

  document.getElementById('btn-save-links').addEventListener('click', (e) => {
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    const linksData = {
      wa: document.getElementById('info-link-wa').value.trim(),
      rec: document.getElementById('info-link-rec').value.trim(),
      exams: document.getElementById('info-link-exams').value.trim()
    };
    window.api.saveCourseLinks(state.currentUniId, code, linksData);
    
    // Add visual feedback
    const btn = document.getElementById('btn-save-links');
    const ogText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.textContent = ogText;
      btn.style.background = '';
    }, 2000);
  });

  // Add listeners for Description & Reviews
  document.getElementById('btn-edit-description').addEventListener('click', () => {
    document.getElementById('info-description').classList.add('hidden');
    document.getElementById('info-description-input').classList.remove('hidden');
    document.getElementById('btn-save-description').classList.remove('hidden');
    document.getElementById('btn-edit-description').classList.add('hidden');
  });

  document.getElementById('btn-save-description').addEventListener('click', (e) => {
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    const newDesc = document.getElementById('info-description-input').value.trim();
    window.api.saveCourseDescription(state.currentUniId, code, newDesc);
    
    document.getElementById('info-description').textContent = newDesc || 'No description available.';
    document.getElementById('info-description').classList.remove('hidden');
    document.getElementById('info-description-input').classList.add('hidden');
    document.getElementById('btn-save-description').classList.add('hidden');
    document.getElementById('btn-edit-description').classList.remove('hidden');
  });

  document.getElementById('btn-write-review').addEventListener('click', () => {
    document.getElementById('review-form-container').classList.remove('hidden');
    document.getElementById('review-text').value = '';
    document.getElementById('review-rating').value = '5';
  });

  document.getElementById('btn-cancel-review').addEventListener('click', () => {
    document.getElementById('review-form-container').classList.add('hidden');
  });

  document.getElementById('btn-submit-review').addEventListener('click', (e) => {
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    const rating = document.getElementById('review-rating').value;
    const text = document.getElementById('review-text').value.trim();
    if (!text) { alert('Please write a feedback message.'); return; }
    
    window.api.addCourseFeedback(state.currentUniId, code, {
      userId: state.currentUser.id,
      username: state.currentUser.username,
      rating: parseInt(rating),
      text
    });
    
    document.getElementById('review-form-container').classList.add('hidden');
    renderCourseFeedbacks(code);
  });

  // Search Auto-Complete
  document.getElementById('course-search').addEventListener('input', (e) => {
    handleSearchAutocomplete(e.target.value.toLowerCase());
  });
  // Hide dropdown on clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      document.getElementById('search-results-dropdown').classList.add('hidden');
    }
  });
}

function handleSearchAutocomplete(query) {
  const dropdown = document.getElementById('search-results-dropdown');
  if (!query) {
    dropdown.classList.add('hidden');
    return;
  }
  const courses = window.api.getPublicCourses(state.currentUniId);
  const grouped = {};
  courses.forEach(c => {
    if (!grouped[c.code]) grouped[c.code] = c;
  });

  const matches = Object.values(grouped).filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.code.toLowerCase().includes(query)
  );

  if (matches.length === 0) {
    dropdown.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:0.5rem;">No courses found.</div>';
  } else {
    dropdown.innerHTML = matches.map(c => `
      <div class="search-result-item" data-code="${c.code}" style="padding:0.5rem; cursor:pointer; border-radius:4px; transition:background 0.2s;">
        <div style="font-weight:600; font-size:0.9rem; color:var(--text-light);">${c.name}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${c.code} · ${c.faculty}</div>
      </div>
    `).join('');
    
    dropdown.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('mouseover', () => el.style.background = 'var(--surface-2)');
      el.addEventListener('mouseout', () => el.style.background = 'transparent');
      el.addEventListener('click', (ev) => {
        const code = ev.currentTarget.dataset.code || ev.currentTarget.getAttribute('data-code');
        state.previewCourseCode = code;
        document.getElementById('course-search').value = '';
        dropdown.classList.add('hidden');
        renderStudentDashboard();
      });
    });
  }
  dropdown.classList.remove('hidden');
}

// ==================== DASHBOARD ====================
function loadDashboard() {
  showView('student');
  renderStudentDashboard();
}

function renderStudentDashboard() {
  renderPublicCourses();
  renderTimetable();
}

// ==================== PUBLIC COURSES (grouped by code) ====================
function renderPublicCourses() {
  const container = document.getElementById('public-courses-list');
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const schedule = window.api.getPersonalSchedule(state.currentUser.id);

  // Filter only added courses
  const myCourses = allCourses.filter(c => schedule.includes(c.id));

  if (myCourses.length === 0 && !state.previewCourseCode) {
    container.innerHTML = '<p style="color:var(--text-muted); padding:1rem; text-align:center; font-size:0.9rem;">You have not added any courses yet.<br><br>Use the search bar above to browse catalog.</p>';
    return;
  }

  // Group selected courses by code
  const grouped = {};
  myCourses.forEach(c => {
    if (!grouped[c.code]) grouped[c.code] = { name: c.name, code: c.code, credits: c.credits, faculty: c.faculty, sections: [] };
    grouped[c.code].sections.push(c);
  });

  // If previewing a not-yet-added course, inject it into grouped so they can close it
  if (state.previewCourseCode && !grouped[state.previewCourseCode]) {
    const previewSample = allCourses.find(c => c.code === state.previewCourseCode);
    if (previewSample) {
      grouped[state.previewCourseCode] = { name: previewSample.name, code: previewSample.code, credits: previewSample.credits, faculty: previewSample.faculty, sections: [] };
    }
  }

  let html = '';
  Object.values(grouped).forEach(group => {
    html += `
      <div class="course-card" style="position:relative;">
        <button class="btn-info-icon" data-code="${group.code}" style="position:absolute; top:8px; right:8px; background:transparent; border:none; color:var(--text-muted); cursor:pointer; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.2); font-size:0.75rem; z-index:2; transition:all 0.2s;">i</button>
        <h4 style="padding-right:20px; position:relative; z-index:1;">${group.name}</h4>
        <div class="course-meta" style="position:relative; z-index:1; font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem; font-weight:500;">
          ${group.code}  ·  ${group.credits ? group.credits + ' Credits' : 'Credits N/A'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Open Info
  container.querySelectorAll('.btn-info-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
      // If clicking info, also bring back preview mode so they can see and select sections!
      state.previewCourseCode = code;
      openCourseInfo(code);
      renderStudentDashboard();
    });
  });
}

function openCourseInfo(code) {
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const sections = allCourses.filter(c => c.code === code);
  if (sections.length === 0) return;
  
  const sample = sections[0];
  document.getElementById('info-title').textContent = sample.name;
  document.getElementById('info-code').textContent = sample.code;
  document.getElementById('info-faculty').textContent = sample.faculty || '—';
  document.getElementById('info-credits').textContent = sample.credits || '—';
  
  const details = window.api.getCourseDetails(state.currentUniId, code);
  const desc = details.description || sample.description || `${sample.name} is a comprehensive course covering the foundational and advanced concepts required for mastering this discipline within the ${sample.faculty} department.`;
  
  document.getElementById('info-description').textContent = desc;
  document.getElementById('info-description-input').value = desc;
  
  document.getElementById('btn-save-description').dataset.code = code;
  document.getElementById('btn-submit-review').dataset.code = code;
  
  // reset UI states
  document.getElementById('info-description').classList.remove('hidden');
  document.getElementById('info-description-input').classList.add('hidden');
  document.getElementById('btn-save-description').classList.add('hidden');
  document.getElementById('btn-edit-description').classList.remove('hidden');
  document.getElementById('review-form-container').classList.add('hidden');

  renderCourseFeedbacks(code);

  const links = window.api.getCourseLinks(state.currentUniId, code);
  document.getElementById('info-link-wa').value = links.wa || '';
  document.getElementById('info-link-rec').value = links.rec || '';
  document.getElementById('info-link-exams').value = links.exams || '';
  document.getElementById('btn-save-links').dataset.code = code;
  
  document.getElementById('btn-remove-course-schedule').dataset.code = code;
  document.getElementById('btn-delete-course-global').dataset.code = code;
  document.getElementById('modal-course-info').classList.remove('hidden');
}

// ==================== TIMETABLE ====================
function renderTimetable() {
  const container = document.getElementById('student-timetable');
  const scheduleIds = window.api.getPersonalSchedule(state.currentUser.id);
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const myCourses = allCourses.filter(c => scheduleIds.includes(c.id));
  const myCustoms = window.api.getCustomEvents(state.currentUser.id);

  let previewCourses = [];
  if (state.previewCourseCode) {
    previewCourses = allCourses.filter(c => 
      c.code === state.previewCourseCode && !scheduleIds.includes(c.id)
    );
  }

  let html = '';

  // Header
  html += '<div class="tt-header" style="grid-column:1; grid-row:1;">Time</div>';
  DAYS.forEach((day, i) => {
    html += `<div class="tt-header" style="grid-column:${i + 2}; grid-row:1;">${day}</div>`;
  });

  // Time + empty cells
  for (let i = 0; i < TOTAL_ROWS; i++) {
    const hour = START_HOUR + i;
    const row = i + 2;
    html += `<div class="tt-time" style="grid-column:1; grid-row:${row};">${String(hour).padStart(2,'0')}:00</div>`;
    for (let d = 0; d < 5; d++) {
      html += `<div class="tt-cell-empty" data-day="${DAYS[d]}" data-hour="${hour}"
        style="grid-column:${d+2}; grid-row:${row};"
        ondragover="event.preventDefault(); this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="handleDropGlobal(event, this)"
        onmousedown="selStart(event, this)"
        onmouseover="selMove(event, this)"
        onmouseup="selEnd(event, this)"></div>`;
    }
  }

  // Course blocks
  myCourses.forEach(c => { html += buildBlock(c, false); });
  myCustoms.forEach(ce => { html += buildBlock({ ...ce, name: ce.title }, true); });
  previewCourses.forEach(p => { html += buildBlock(p, false, true); });

  container.innerHTML = html;

  // Prevent text-select during grid drag
  container.addEventListener('selectstart', e => { if (selection.active) e.preventDefault(); });
}

// ==================== GRID SELECTION (click-drag to create) ====================
function selStart(e, cell) {
  if (e.button !== 0) return; // left click only
  e.preventDefault();
  selection.active = true;
  selection.day = cell.dataset.day;
  selection.startHour = parseInt(cell.dataset.hour);
  selection.endHour = selection.startHour;
  highlightSelection();
}

function selMove(e, cell) {
  if (!selection.active) return;
  if (cell.dataset.day !== selection.day) return; // same column only
  selection.endHour = parseInt(cell.dataset.hour);
  highlightSelection();
}

function selEnd(e, cell) {
  if (!selection.active) return;
  selection.active = false;
  selection.endHour = parseInt(cell.dataset.hour);

  const minH = Math.min(selection.startHour, selection.endHour);
  const maxH = Math.max(selection.startHour, selection.endHour) + 1; // +1 to include that hour

  // Pre-fill and open the custom event modal
  document.getElementById('cust-title').value = '';
  document.getElementById('cust-day').value = selection.day;
  document.getElementById('cust-start').value = String(minH).padStart(2,'0') + ':00';
  document.getElementById('cust-end').value = String(maxH).padStart(2,'0') + ':00';
  document.getElementById('cust-notes').value = '';
  document.getElementById('modal-custom').classList.remove('hidden');

  clearSelectionHighlight();
}

function highlightSelection() {
  clearSelectionHighlight();
  if (!selection.day) return;
  const minH = Math.min(selection.startHour, selection.endHour);
  const maxH = Math.max(selection.startHour, selection.endHour);
  const grid = document.getElementById('student-timetable');
  grid.querySelectorAll('.tt-cell-empty').forEach(cell => {
    const h = parseInt(cell.dataset.hour);
    if (cell.dataset.day === selection.day && h >= minH && h <= maxH) {
      cell.classList.add('sel-active');
    }
  });
}

function clearSelectionHighlight() {
  document.querySelectorAll('.sel-active').forEach(c => c.classList.remove('sel-active'));
}

const courseColors = [
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', 
  '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', 
  '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316'
];

function getCourseColorStr(code) {
  if (!code) return '#3b82f6';
  let hash = 0;
  for(let i=0; i<code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return courseColors[Math.abs(hash) % courseColors.length];
}

function buildBlock(item, isCustom, isPreview = false) {
  const pref = window.api.getEventPreference(state.currentUser.id, item.id);
  const day = pref.day || item.day;
  const startStr = pref.start || item.start;
  const endStr = pref.end || item.end;
  if (!startStr || !endStr || !day) return '';

  const [sH, sM] = startStr.split(':').map(Number);
  const [eH, eM] = endStr.split(':').map(Number);
  const startRow = 2 + (sH - START_HOUR) + (sM / 60);
  const endRow = 2 + (eH - START_HOUR) + (eM / 60);
  const rowStart = Math.max(2, Math.round(startRow));
  const span = Math.max(1, Math.round(endRow - startRow));
  const col = DAY_COL[day];
  if (!col || rowStart < 2) return '';

  const baseColor = isCustom ? (item.color || '#10b981') : getCourseColorStr(item.code);
  const bgColor = pref.color || baseColor;
  const safeId = item.id.replace(/'/g, "\\'");

  const clickAction = isPreview ? `handlePreviewSelect('${safeId}')` : `openEditModalGlobal('${safeId}', ${isCustom})`;
  const extraClass = isPreview ? 'preview' : '';
  const badgeHTML = isPreview ? `<div class="preview-badge">${item.type} ${item.group || ''}</div>` : '';
  
  const roomText = isCustom ? (item.room || '') : (pref.room || item.room || '');
  const notesText = isCustom ? (item.notes || '') : (pref.notes || item.notes || '');
  const bottomText = [roomText, notesText].filter(Boolean).join(' • ');

  return `<div class="course-block ${extraClass}" draggable="${!isPreview}"
    ondragstart="${!isPreview ? `handleDragStartGlobal(event, '${safeId}', ${isCustom})` : 'event.preventDefault()'}"
    ondragend="handleDragEndGlobal(event)"
    onclick="${clickAction}"
    style="grid-column:${col}; grid-row:${rowStart} / span ${span};
      background:${bgColor}; color:#fff; margin:2px; padding:6px;
      border-radius:6px; font-size:0.78rem; overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.3); z-index:5;">
    ${badgeHTML}
    ${!isCustom ? `<div style="font-size:0.65rem; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; margin-bottom:2px;">${item.code}</div>` : ''}
    <div style="font-weight:600; line-height:1.2; margin-bottom:2px;">${item.name || item.title}</div>
    ${!isCustom ? `<div style="font-size:0.75rem; margin-top:2px; opacity:0.9;">${item.type} ${item.group || ''}</div>` : ''}
    <div style="font-size:0.75rem; margin-top:4px; opacity:0.8;">${bottomText}</div>
  </div>`;
}

window.handlePreviewSelect = (id) => {
  window.api.addToSchedule(state.currentUser.id, id);
  // Keep the preview mode open so they can easily add multiple things (e.g. lecture + tutorial)
  renderStudentDashboard();
};

// ==================== DRAG & DROP ====================
function handleDragStartGlobal(e, id, isCustom) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, isCustom }));
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function handleDragEndGlobal(e) { e.target.classList.remove('dragging'); }

function handleDropGlobal(e, cell) {
  e.preventDefault();
  cell.classList.remove('drag-over');
  const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
  const newDay = cell.dataset.day;
  const newHour = parseInt(cell.dataset.hour);
  let oldStart, oldEnd;

  if (payload.isCustom) {
    const ev = window.api.getCustomEvents(state.currentUser.id).find(x => x.id === payload.id);
    if (!ev) return;
    oldStart = ev.start; oldEnd = ev.end;
  } else {
    const ev = window.api.getPublicCourses(state.currentUniId).find(x => x.id === payload.id);
    if (!ev) return;
    const pref = window.api.getEventPreference(state.currentUser.id, payload.id);
    oldStart = pref.start || ev.start; oldEnd = pref.end || ev.end;
  }

  const sMins = parseInt(oldStart.split(':')[0]) * 60 + parseInt(oldStart.split(':')[1]);
  const eMins = parseInt(oldEnd.split(':')[0]) * 60 + parseInt(oldEnd.split(':')[1]);
  const dur = eMins - sMins;
  const nS = newHour * 60 + parseInt(oldStart.split(':')[1]);
  const nE = nS + dur;
  const newStart = String(Math.floor(nS/60)).padStart(2,'0') + ':' + String(nS%60).padStart(2,'0');
  const newEnd = String(Math.floor(nE/60)).padStart(2,'0') + ':' + String(nE%60).padStart(2,'0');

  if (payload.isCustom) {
    window.api.updateCustomEvent(payload.id, { day: newDay, start: newStart, end: newEnd });
  } else {
    window.api.saveEventPreference(state.currentUser.id, payload.id, { day: newDay, start: newStart, end: newEnd });
  }
  renderTimetable();
}

// ==================== EDIT MODAL ====================
function openEditModalGlobal(id, isCustom) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-is-custom').value = isCustom;
  const formGrid = document.getElementById('edit-form-grid');

  if (isCustom) {
    const ev = window.api.getCustomEvents(state.currentUser.id).find(x => x.id === id);
    if (!ev) return;
    document.getElementById('edit-title').innerText = ev.title;
    document.getElementById('edit-color').value = ev.color || '#10b981';
    document.getElementById('edit-day').value = ev.day || 'Sunday';
    document.getElementById('edit-start').value = ev.start || '08:00';
    document.getElementById('edit-end').value = ev.end || '10:00';
    document.getElementById('edit-room').value = ev.room || ''; 
    document.getElementById('edit-notes').value = ev.notes || '';
  } else {
    const ev = window.api.getPublicCourses(state.currentUniId).find(c => c.id === id);
    if (!ev) return;
    document.getElementById('edit-title').innerText = 'Editing: ' + ev.name;
    const pref = window.api.getEventPreference(state.currentUser.id, id);
    document.getElementById('edit-color').value = pref.color || '#3b82f6';
    document.getElementById('edit-day').value = pref.day || ev.day || 'Sunday';
    document.getElementById('edit-start').value = pref.start || ev.start || '08:00';
    document.getElementById('edit-end').value = pref.end || ev.end || '10:00';
    document.getElementById('edit-room').value = pref.room || ev.room || '';
    document.getElementById('edit-notes').value = pref.notes || ev.notes || '';
  }
  document.getElementById('modal-edit').classList.remove('hidden');
}

function handleSaveEdit() {
  const id = document.getElementById('edit-id').value;
  const isCustom = document.getElementById('edit-is-custom').value === 'true';
  const color = document.getElementById('edit-color').value;
  const day = document.getElementById('edit-day').value;
  const start = document.getElementById('edit-start').value;
  const end = document.getElementById('edit-end').value;
  const room = document.getElementById('edit-room').value;
  const notes = document.getElementById('edit-notes').value;

  if (isCustom) {
    window.api.updateCustomEvent(id, { color, day, start, end, room, notes });
  } else {
    window.api.saveEventPreference(state.currentUser.id, id, { color, day, start, end, room, notes });
    
    // Syndicate color to ALL sections of the same course
    const ev = window.api.getPublicCourses(state.currentUniId).find(c => c.id === id);
    if (ev && ev.code) {
      const peers = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === ev.code && c.id !== id);
      peers.forEach(peer => {
        const peerPref = window.api.getEventPreference(state.currentUser.id, peer.id) || {};
        window.api.saveEventPreference(state.currentUser.id, peer.id, { ...peerPref, color });
      });
    }
  }
  document.getElementById('modal-edit').classList.add('hidden');
  renderTimetable();
}

function handleDeleteEvent() {
  const id = document.getElementById('edit-id').value;
  const isCustom = document.getElementById('edit-is-custom').value === 'true';
  if (isCustom) { window.api.removeCustomEvent(id); }
  else { window.api.removeFromSchedule(state.currentUser.id, id); renderPublicCourses(); }
  document.getElementById('modal-edit').classList.add('hidden');
  renderTimetable();
}

// ==================== CUSTOM EVENT ====================
function submitCustomEvent() {
  const title = document.getElementById('cust-title').value;
  const day = document.getElementById('cust-day').value;
  const start = document.getElementById('cust-start').value;
  const end = document.getElementById('cust-end').value;
  const notes = document.getElementById('cust-notes').value;
  if (!title || !start || !end) { alert('Please fill in title, start time, and end time.'); return; }
  window.api.addCustomEvent(state.currentUser.id, { title, day, start, end, notes });
  document.getElementById('form-custom-event').reset();
  document.getElementById('modal-custom').classList.add('hidden');
  renderTimetable();
}

// ==================== CREATE COURSE ====================
function submitCourseRequest() {
  const courseData = {
    uniId: state.currentUniId,
    name: document.getElementById('req-name').value,
    code: document.getElementById('req-code').value,
    faculty: document.getElementById('req-faculty').value,
    type: document.getElementById('req-type').value,
    lecturer: document.getElementById('req-lecturer').value,
    room: document.getElementById('req-room').value,
    day: document.getElementById('req-day').value,
    start: document.getElementById('req-start').value,
    end: document.getElementById('req-end').value,
    group: document.getElementById('req-group').value,
    credits: document.getElementById('req-credits').value || '0',
    notes: document.getElementById('req-notes').value
  };
  
  const newCourse = window.api.createCourse(courseData);
  // Automatically add the newly created course section to the user's schedule
  window.api.addToSchedule(state.currentUser.id, newCourse.id);
  
  document.getElementById('form-request-course').reset();
  document.getElementById('modal-request').classList.add('hidden');
  renderStudentDashboard();
}

function renderCourseFeedbacks(code) {
  const details = window.api.getCourseDetails(state.currentUniId, code);
  const feedbacks = details.feedbacks || [];
  
  let avgRating = 0;
  if (feedbacks.length > 0) {
    avgRating = feedbacks.reduce((sum, f) => sum + parseInt(f.rating), 0) / feedbacks.length;
  }
  
  const rounded = Math.round(avgRating);
  const starsStr = feedbacks.length > 0 ? ('★'.repeat(rounded) + '☆'.repeat(5 - rounded)) : '☆☆☆☆☆';
  
  document.getElementById('info-rating').textContent = starsStr;
  document.getElementById('info-feedback-count').textContent = `${feedbacks.length} Reviews`;
  
  const listEl = document.getElementById('info-feedbacks-list');
  if (feedbacks.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:1rem;">Be the first to review this course!</p>';
    return;
  }
  
  listEl.innerHTML = feedbacks.map(f => `
    <div style="background:var(--bg-color); border:1px solid var(--border); padding:0.75rem; border-radius:6px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
        <strong style="font-size:0.85rem; color:var(--text-light);">${f.username || 'Student'}</strong>
        <span style="color:var(--warning); font-size:0.8rem;">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
      </div>
      <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">${f.text}</p>
      <div style="font-size:0.65rem; color:var(--text-muted); margin-top:0.4rem; opacity:0.6;">${new Date(f.date).toLocaleDateString()}</div>
    </div>
  `).join('');
}

// Global click listener to clear preview if clicking outside search or timetable blocks
document.addEventListener('click', (e) => {
  if (state.previewCourseCode && !e.target.closest('.course-block') && !e.target.closest('.search-box') && !e.target.closest('.btn-info-icon')) {
    state.previewCourseCode = null;
    renderStudentDashboard();
  }
});

// Escape key to clear preview
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.previewCourseCode) {
    state.previewCourseCode = null;
    renderStudentDashboard();
  }
});

// ==================== START ====================
document.addEventListener('DOMContentLoaded', init);
