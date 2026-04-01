// App State
const state = {
  currentUniId: null,
  currentUser: null,
  authMode: 'login',
  previewCourseCodes: [],
  catalogCourseCodes: [],
  isGuest: false
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
  student: document.getElementById('view-student'),
  todo: document.getElementById('view-todo')
};
const navbar = document.getElementById('navbar');
const navbarLanding = document.getElementById('navbar-landing');

// ==================== CATALOG STATE PERSISTENCE ====================
function saveCatalogState() {
  localStorage.setItem('uniSchedule_catalogCodes', JSON.stringify(state.catalogCourseCodes || []));
}
function loadCatalogState() {
  try {
    const saved = localStorage.getItem('uniSchedule_catalogCodes');
    if (saved) state.catalogCourseCodes = JSON.parse(saved);
  } catch (e) { /* ignore parse errors */ }
}

// ==================== INIT ====================
function init() {
  // Try to restore a registered user session
  const savedUserId = localStorage.getItem('uniSchedule_session');
  let restored = false;

  if (savedUserId) {
    // Check if it's a guest session
    if (savedUserId.startsWith('guest_')) {
      const guestUniId = localStorage.getItem('uniSchedule_guestUni');
      if (guestUniId) {
        state.currentUser = { id: savedUserId, username: 'Guest' };
        state.currentUniId = guestUniId;
        state.isGuest = true;
        // Ensure guest has a schedule bucket
        if (!window.api.getPersonalSchedule(savedUserId)) {
          window.api.ensureSchedule(savedUserId);
        }
        restored = true;
      }
    } else {
      const user = window.api.getUser(savedUserId);
      if (user) {
        state.currentUser = user;
        state.currentUniId = user.uniId;
        state.isGuest = false;
        restored = true;
      } else {
        localStorage.removeItem('uniSchedule_session');
      }
    }
  }

  const hash = window.location.hash.replace('#', '');

  if (restored) {
    if (hash === 'student') {
      loadCatalogState();
      loadDashboard();
    } else if (hash === 'todo') {
      loadCatalogState();
      loadTodo();
    } else {
      loadCatalogState();
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

// ==================== GUEST MODE ====================
function enterGuestMode() {
  document.getElementById('modal-guest-uni').classList.remove('hidden');
}

function confirmGuestUni(uniId) {
  const guestId = 'guest_' + uniId + '_local';
  state.currentUser = { id: guestId, username: 'Guest' };
  state.currentUniId = uniId;
  state.isGuest = true;

  // Ensure schedule bucket exists
  window.api.ensureSchedule(guestId);

  localStorage.setItem('uniSchedule_session', guestId);
  localStorage.setItem('uniSchedule_guestUni', uniId);

  document.getElementById('modal-guest-uni').classList.add('hidden');
  loadDashboard();
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
      document.getElementById('nav-user-name').textContent = state.isGuest ? '👤 Guest' : state.currentUser.username;
      document.getElementById('nav-uni-name').textContent = UNI_NAMES[state.currentUniId] || '';
      // Show Register/Login for guests, Logout for registered users
      if (state.isGuest) {
        document.getElementById('btn-auth-nav').classList.remove('hidden');
        document.getElementById('btn-logout').classList.add('hidden');
      } else {
        document.getElementById('btn-auth-nav').classList.add('hidden');
        document.getElementById('btn-logout').classList.remove('hidden');
      }
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
    const previousGuestId = state.isGuest ? state.currentUser.id : null;

    if (state.authMode === 'login') {
      const uniId = document.getElementById('login-university').value;
      const user = window.api.login(username, password);
      if (user) {
        if (user.uniId !== uniId) {
          alert('This account does not belong to the selected university.');
          return;
        }
        // Migrate guest data if applicable
        if (previousGuestId) {
          window.api.migrateGuestData(previousGuestId, user.id);
        }
        state.currentUniId = uniId;
        state.currentUser = user;
        state.isGuest = false;
        localStorage.setItem('uniSchedule_session', user.id);
        localStorage.removeItem('uniSchedule_guestUni');
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
        // Migrate guest data if applicable
        if (previousGuestId) {
          window.api.migrateGuestData(previousGuestId, res.user.id);
        }
        state.currentUniId = uniId;
        state.currentUser = res.user;
        state.isGuest = false;
        localStorage.setItem('uniSchedule_session', res.user.id);
        localStorage.removeItem('uniSchedule_guestUni');
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
    state.isGuest = false;
    state.catalogCourseCodes = [];
    state.previewCourseCodes = [];
    localStorage.removeItem('uniSchedule_session');
    localStorage.removeItem('uniSchedule_guestUni');
    localStorage.removeItem('uniSchedule_catalogCodes');
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

    if (window.api.deleteCourseGlobal(code, state.currentUniId)) {
      document.getElementById('modal-course-info').classList.add('hidden');
      // Clean up state arrays
      if (state.previewCourseCodes) state.previewCourseCodes = state.previewCourseCodes.filter(c => c !== code);
      if (state.catalogCourseCodes) state.catalogCourseCodes = state.catalogCourseCodes.filter(c => c !== code);
      saveCatalogState();
      renderStudentDashboard();
    } else {
      alert("Deletion failed or course was not found globally.");
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

  document.getElementById('btn-save-exams').addEventListener('click', (e) => {
    const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
    const examsData = {
      moeda: document.getElementById('info-exam-moeda').value,
      moedb: document.getElementById('info-exam-moedb').value
    };
    window.api.saveCourseExams(state.currentUniId, code, examsData);

    const btn = document.getElementById('btn-save-exams');
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

  // To-Do List UI
  document.getElementById('btn-toggle-task-form').addEventListener('click', () => {
    const formContainer = document.getElementById('tm-create-form-container');
    formContainer.classList.toggle('hidden');
  });
  document.getElementById('btn-cancel-task').addEventListener('click', () => {
    document.getElementById('tm-create-form-container').classList.add('hidden');
    document.getElementById('form-todo').reset();
  });

  // To-do filter listeners
  ['filter-status', 'filter-priority', 'sort-by'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTodos);
  });
  document.getElementById('filter-course').addEventListener('input', renderTodos);
  document.getElementById('form-todo').addEventListener('submit', (e) => {
    e.preventDefault();
    submitTodoTask();
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
        if (!state.previewCourseCodes) state.previewCourseCodes = [];
        if (!state.previewCourseCodes.includes(code)) state.previewCourseCodes.push(code);
        if (!state.catalogCourseCodes) state.catalogCourseCodes = [];
        if (!state.catalogCourseCodes.includes(code)) state.catalogCourseCodes.push(code);
        saveCatalogState();
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

  if (!state.catalogCourseCodes) state.catalogCourseCodes = [];

  // Sync schedule to catalog so any scheduled course is explicitly in catalog
  myCourses.forEach(c => {
    if (!state.catalogCourseCodes.includes(c.code)) state.catalogCourseCodes.push(c.code);
  });
  saveCatalogState();

  if (state.catalogCourseCodes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); padding:1rem; text-align:center; font-size:0.9rem;">You have not added any courses yet.<br><br>Use the search bar above to browse catalog.</p>';
    return;
  }

  // Group all catalog courses by code for the left side view
  const grouped = {};
  state.catalogCourseCodes.forEach(catCode => {
    const defaultSample = allCourses.find(c => c.code === catCode);
    if (defaultSample) {
      grouped[catCode] = { name: defaultSample.name, code: defaultSample.code, credits: defaultSample.credits, faculty: defaultSample.faculty, sections: [] };
    }
  });

  // Inject user's specific sections
  myCourses.forEach(c => {
    if (grouped[c.code]) grouped[c.code].sections.push(c);
  });

  let html = '';
  Object.values(grouped).forEach(group => {
    html += `
      <div class="course-card" style="position:relative;">
        <div style="position:absolute; top:8px; right:8px; display:flex; flex-direction:column; align-items:flex-end; gap:0.25rem; z-index:2;">
          <div style="display:flex; gap:0.25rem;">
            ${state.previewCourseCodes && state.previewCourseCodes.includes(group.code) ? `<button class="btn-confirm-icon" title="Confirm Selection" data-code="${group.code}" style="background:transparent; border:none; color:#10b981; cursor:pointer; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(16,185,129,0.3); font-size:0.75rem; transition:all 0.2s;">✔</button>` : ''}
            <button class="btn-info-icon" title="Course Info" data-code="${group.code}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.2); font-size:0.75rem; transition:all 0.2s;">i</button>
          </div>
          <button class="btn-preview-icon" title="Reset & Pick Sessions" data-code="${group.code}" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,0.2); font-size:0.7rem; transition:all 0.2s;">👁</button>
        </div>
        <h4 class="course-title-btn" data-code="${group.code}" title="Click to Unpick Course From Catalog" style="padding-right:60px; position:relative; z-index:1; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='var(--danger)'" onmouseout="this.style.color='var(--text-main)'">${group.name}</h4>
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
      if (!state.previewCourseCodes) state.previewCourseCodes = [];
      if (!state.previewCourseCodes.includes(code)) state.previewCourseCodes.push(code);
      if (!state.catalogCourseCodes) state.catalogCourseCodes = [];
      if (!state.catalogCourseCodes.includes(code)) state.catalogCourseCodes.push(code);
      saveCatalogState();
      openCourseInfo(code);
      renderStudentDashboard();
    });
  });

  // Eye Icon Action: Reset & Pick 
  container.querySelectorAll('.btn-preview-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent card click
      const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
      if (!state.previewCourseCodes) state.previewCourseCodes = [];
      if (!state.previewCourseCodes.includes(code)) state.previewCourseCodes.push(code);
      if (!state.catalogCourseCodes) state.catalogCourseCodes = [];
      if (!state.catalogCourseCodes.includes(code)) state.catalogCourseCodes.push(code);
      saveCatalogState();

      const allCourses = window.api.getPublicCourses(state.currentUniId);
      const sections = allCourses.filter(c => c.code === code);
      sections.forEach(s => {
        window.api.removeFromSchedule(state.currentUser.id, s.id);
      });
      renderStudentDashboard();
    });
  });

  // Confirm Selection Action
  container.querySelectorAll('.btn-confirm-icon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent card click
      const code = e.currentTarget.dataset.code || e.currentTarget.getAttribute('data-code');
      if (state.previewCourseCodes) {
        state.previewCourseCodes = state.previewCourseCodes.filter(c => c !== code);
      }
      renderStudentDashboard();
    });
  });

  // Unpick entirely (Course name click)
  container.querySelectorAll('.course-title-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = e.currentTarget.dataset.code;
      const sections = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === code);
      sections.forEach(s => window.api.removeFromSchedule(state.currentUser.id, s.id));
      if (state.previewCourseCodes) {
        state.previewCourseCodes = state.previewCourseCodes.filter(c => c !== code);
      }
      if (state.catalogCourseCodes) {
        state.catalogCourseCodes = state.catalogCourseCodes.filter(c => c !== code);
      }
      saveCatalogState();
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

  const exams = window.api.getCourseExams(state.currentUniId, code);
  document.getElementById('info-exam-moeda').value = exams.moeda || '';
  document.getElementById('info-exam-moedb').value = exams.moedb || '';
  document.getElementById('btn-save-exams').dataset.code = code;

  renderCourseSessions(code);

  document.getElementById('btn-remove-course-schedule').dataset.code = code;
  document.getElementById('btn-delete-course-global').dataset.code = code;
  document.getElementById('modal-course-info').classList.remove('hidden');
}

function renderCourseSessions(code) {
  const container = document.getElementById('info-sessions-container');
  const sections = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === code);

  let html = '';
  sections.forEach(s => {
    html += `
      <div class="card" style="padding:0.75rem; background:var(--surface-2); border-radius:8px; border:1px solid var(--border); font-size:0.85rem;" id="session-display-${s.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <strong style="color:var(--text-light);">${s.type.toUpperCase()}</strong> - Grp ${s.group || '-'}<br>
            <span style="color:var(--text-muted);">${s.day} | ${s.start} - ${s.end}</span><br>
            <span style="color:var(--text-muted);">${s.lecturer || 'N/A'} | ${s.room || 'N/A'}</span>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="btn-text btn-edit-session" data-id="${s.id}" style="font-size:0.75rem; padding:0;">Edit</button>
            <button class="btn-text btn-del-session" data-id="${s.id}" style="font-size:0.75rem; padding:0; color:var(--danger);">Del</button>
          </div>
        </div>
      </div>
      <div id="session-edit-${s.id}" class="hidden card" style="padding:0.75rem; background:var(--surface-1); border-radius:8px; border:1px solid var(--border);">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
          <input type="text" id="es-type-${s.id}" value="${s.type}" placeholder="Type (e.g. lecture)" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          <input type="text" id="es-group-${s.id}" value="${s.group || ''}" placeholder="Group" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          <select id="es-day-${s.id}" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
            ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => `<option value="${d}" ${s.day === d ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
          <div style="display:flex; gap:0.25rem;">
            <input type="time" id="es-start-${s.id}" value="${s.start}" style="width:50%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
            <input type="time" id="es-end-${s.id}" value="${s.end}" style="width:50%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          </div>
          <input type="text" id="es-lecturer-${s.id}" value="${s.lecturer || ''}" placeholder="Lecturer" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          <input type="text" id="es-room-${s.id}" value="${s.room || ''}" placeholder="Room" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
        </div>
        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
          <button class="btn-text btn-cancel-edit-session" data-id="${s.id}" style="font-size:0.75rem;">Cancel</button>
          <button class="btn-primary btn-save-session" data-id="${s.id}" data-code="${code}" style="font-size:0.75rem; padding:0.3rem 0.8rem;">Save</button>
        </div>
      </div>
    `;
  });

  html += `
    <div id="session-add-form" class="hidden card" style="padding:0.75rem; background:var(--surface-1); border-radius:8px; border:1px dashed var(--border); margin-top:0.5rem;">
      <h5 style="margin-bottom:0.5rem; color:var(--text-light); font-size:0.85rem;">New Session</h5>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
        <input type="text" id="as-type" placeholder="Type (e.g. tutorial)" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
        <input type="text" id="as-group" placeholder="Group (e.g. 1)" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
        <select id="as-day" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          <option value="Sunday">Sunday</option><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option>
        </select>
        <div style="display:flex; gap:0.25rem;">
          <input type="time" id="as-start" style="width:50%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
          <input type="time" id="as-end" style="width:50%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
        </div>
        <input type="text" id="as-lecturer" placeholder="Lecturer" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
        <input type="text" id="as-room" placeholder="Room" style="width:100%; padding:0.4rem; font-size:0.8rem; background:var(--bg-color); color:#fff; border:1px solid var(--border); border-radius:4px;">
      </div>
      <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
        <button id="btn-cancel-add-session" class="btn-text" style="font-size:0.75rem;">Cancel</button>
        <button id="btn-submit-add-session" class="btn-primary" data-code="${code}" style="font-size:0.75rem; padding:0.3rem 0.8rem;">Create Session</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Listeners
  const addFormBtn = document.getElementById('btn-add-global-session');
  const newAddFormBtn = addFormBtn.cloneNode(true);
  addFormBtn.parentNode.replaceChild(newAddFormBtn, addFormBtn);
  newAddFormBtn.addEventListener('click', () => {
    document.getElementById('session-add-form').classList.remove('hidden');
  });

  const addForm = document.getElementById('session-add-form');
  if (addForm) {
    document.getElementById('btn-cancel-add-session').addEventListener('click', () => {
      addForm.classList.add('hidden');
    });
    document.getElementById('btn-submit-add-session').addEventListener('click', () => {
      const type = document.getElementById('as-type').value.trim();
      const group = document.getElementById('as-group').value.trim();
      const day = document.getElementById('as-day').value;
      const start = document.getElementById('as-start').value;
      const end = document.getElementById('as-end').value;
      const lecturer = document.getElementById('as-lecturer').value.trim();
      const room = document.getElementById('as-room').value.trim();

      if (!type || !start || !end) return alert('Type, start, and end times are required.');

      const baseSection = sections[0];
      const newSession = {
        uniId: state.currentUniId,
        code: baseSection.code,
        name: baseSection.name,
        faculty: baseSection.faculty,
        credits: baseSection.credits,
        type, group, day, start, end, lecturer, room,
        approvedAt: new Date().toISOString()
      };

      const created = window.api.createCourse(newSession);
      window.api.addToSchedule(state.currentUser.id, created.id);
      if (document.getElementById('modal-course-info').classList.contains('hidden') === false) {
        renderCourseSessions(code);
      }
      renderStudentDashboard();
    });
  }

  container.querySelectorAll('.btn-edit-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      document.getElementById('session-display-' + id).classList.add('hidden');
      document.getElementById('session-edit-' + id).classList.remove('hidden');
    });
  });

  container.querySelectorAll('.btn-cancel-edit-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      document.getElementById('session-edit-' + id).classList.add('hidden');
      document.getElementById('session-display-' + id).classList.remove('hidden');
    });
  });

  container.querySelectorAll('.btn-save-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      const c = e.currentTarget.getAttribute('data-code');
      const newData = {
        type: document.getElementById('es-type-' + id).value.trim(),
        group: document.getElementById('es-group-' + id).value.trim(),
        day: document.getElementById('es-day-' + id).value,
        start: document.getElementById('es-start-' + id).value,
        end: document.getElementById('es-end-' + id).value,
        lecturer: document.getElementById('es-lecturer-' + id).value.trim(),
        room: document.getElementById('es-room-' + id).value.trim()
      };
      if (!newData.type || !newData.start || !newData.end) return alert('Type, start, and end times are required');
      window.api.editCourseSession(id, newData);

      if (document.getElementById('modal-course-info').classList.contains('hidden') === false) {
        renderCourseSessions(c);
      }
      renderStudentDashboard();
    });
  });

  container.querySelectorAll('.btn-del-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.getAttribute('data-id');
      window.api.deleteCourseSession(id);

      // If the last session is deleted, close the modal and refresh
      const remainingSections = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === code);
      if (remainingSections.length === 0) {
        document.getElementById('modal-course-info').classList.add('hidden');
        if (state.previewCourseCodes) state.previewCourseCodes = state.previewCourseCodes.filter(c => c !== code);
        if (state.catalogCourseCodes) state.catalogCourseCodes = state.catalogCourseCodes.filter(c => c !== code);
        saveCatalogState();
      } else {
        renderCourseSessions(code);
      }

      renderStudentDashboard();
    });
  });
}

// ==================== TIMETABLE ====================
function renderTimetable() {
  const container = document.getElementById('student-timetable');
  const scheduleIds = window.api.getPersonalSchedule(state.currentUser.id);
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  let myCourses = allCourses.filter(c => scheduleIds.includes(c.id));
  const myCustoms = window.api.getCustomEvents(state.currentUser.id);

  let previewCourses = [];
  if (state.previewCourseCodes && state.previewCourseCodes.length > 0) {
    previewCourses = allCourses.filter(c =>
      state.previewCourseCodes.includes(c.code) && !scheduleIds.includes(c.id)
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
    html += `<div class="tt-time" style="grid-column:1; grid-row:${row};">${String(hour).padStart(2, '0')}:00</div>`;
    for (let d = 0; d < 5; d++) {
      html += `<div class="tt-cell-empty" data-day="${DAYS[d]}" data-hour="${hour}"
        style="grid-column:${d + 2}; grid-row:${row};"
        ondragover="event.preventDefault(); this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="handleDropGlobal(event, this)"
        onmousedown="selStart(event, this)"
        onmouseover="selMove(event, this)"
        onmouseup="selEnd(event, this)"></div>`;
    }
  }

  // --- Overlap Detection ---
  // Collect ALL visible items into a flat list with metadata
  const allItems = [];
  myCourses.forEach(c => allItems.push({ item: c, isCustom: false, isPreview: false }));
  myCustoms.forEach(ce => allItems.push({ item: { ...ce, name: ce.title }, isCustom: true, isPreview: false }));
  previewCourses.forEach(p => allItems.push({ item: p, isCustom: false, isPreview: true }));

  // Parse time info for each item
  const parsed = allItems.map(entry => {
    const pref = window.api.getEventPreference(state.currentUser.id, entry.item.id);
    const day = pref.day || entry.item.day;
    const startStr = pref.start || entry.item.start;
    const endStr = pref.end || entry.item.end;
    if (!startStr || !endStr || !day) return null;
    const [sH, sM] = startStr.split(':').map(Number);
    const [eH, eM] = endStr.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    return { ...entry, day, startMin, endMin, startStr, endStr };
  }).filter(Boolean);

  // Group by day
  const byDay = {};
  parsed.forEach(p => {
    if (!byDay[p.day]) byDay[p.day] = [];
    byDay[p.day].push(p);
  });

  // For each day, detect overlapping clusters and assign column positions
  Object.keys(byDay).forEach(day => {
    const events = byDay[day];
    // Sort by start time, then by end time
    events.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

    // Greedy column assignment
    const columns = []; // columns[i] = endMin of the last event in column i
    events.forEach(ev => {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (ev.startMin >= columns[c]) {
          columns[c] = ev.endMin;
          ev.colIndex = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.colIndex = columns.length;
        columns.push(ev.endMin);
      }
    });

    // Now determine each event's total number of concurrent columns
    // by looking at all events that overlap with it
    events.forEach(ev => {
      let maxCols = ev.colIndex + 1;
      events.forEach(other => {
        if (other === ev) return;
        // Check if they overlap
        if (other.startMin < ev.endMin && other.endMin > ev.startMin) {
          maxCols = Math.max(maxCols, other.colIndex + 1);
        }
      });
      ev.totalCols = maxCols;
    });
  });

  // Render all blocks with overlap info
  parsed.forEach(p => {
    html += buildBlock(p.item, p.isCustom, p.isPreview, p.colIndex || 0, p.totalCols || 1);
  });

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
  document.getElementById('cust-start').value = String(minH).padStart(2, '0') + ':00';
  document.getElementById('cust-end').value = String(maxH).padStart(2, '0') + ':00';
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
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return courseColors[Math.abs(hash) % courseColors.length];
}

function buildBlock(item, isCustom, isPreview = false, colIndex = 0, totalCols = 1) {
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
  let bgColor = pref.color || baseColor;
  if (!isCustom && !pref.color) {
    const peers = window.api.getPublicCourses(state.currentUniId).filter(c => c.code === item.code);
    for (const p of peers) {
      const pPref = window.api.getEventPreference(state.currentUser.id, p.id);
      if (pPref && pPref.color) {
        bgColor = pPref.color;
        break;
      }
    }
  }
  const safeId = item.id.replace(/'/g, "\\'");

  const clickAction = isPreview ? `handlePreviewSelect('${safeId}')` : `openEditModalGlobal('${safeId}', ${isCustom})`;
  const extraClass = isPreview ? 'preview' : '';
  const badgeHTML = isPreview ? `<div class="preview-badge">${item.type} ${item.group || ''}</div>` : '';

  const roomText = isCustom ? (item.room || '') : (pref.room || item.room || '');
  const notesText = isCustom ? (item.notes || '') : (pref.notes || item.notes || '');
  const bottomText = [roomText, notesText].filter(Boolean).join(' • ');

  // Split-view: calculate width and left offset for overlapping events
  const widthPct = (100 / totalCols);
  const leftPct = (colIndex * widthPct);

  return `<div class="course-block ${extraClass}" draggable="${!isPreview && isCustom}"
    ondragstart="${(!isPreview && isCustom) ? `handleDragStartGlobal(event, '${safeId}', ${isCustom})` : 'event.preventDefault()'}"
    ondragend="handleDragEndGlobal(event)"
    onclick="${clickAction}"
    style="grid-column:${col}; grid-row:${rowStart} / span ${span};
      width:calc(${widthPct.toFixed(2)}% - 4px); margin-left:calc(${leftPct.toFixed(2)}% + 2px);
      background:${bgColor}; color:#fff; padding:4px 5px;
      border-radius:6px; font-size:0.75rem; overflow:hidden;
      box-shadow:0 2px 8px rgba(0,0,0,0.3); z-index:5;
      position:relative;">
    ${badgeHTML}
    ${!isCustom ? `<div style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; margin-bottom:1px;">${item.code}</div>` : ''}
    <div style="font-weight:600; line-height:1.15; margin-bottom:1px; ${totalCols > 1 ? 'font-size:0.7rem;' : ''}">${item.name || item.title}</div>
    ${!isCustom ? `<div style="font-size:0.7rem; margin-top:1px; opacity:0.9;">${item.type} ${item.group || ''}</div>` : ''}
    <div style="font-size:0.7rem; margin-top:2px; opacity:0.8;">${bottomText}</div>
  </div>`;
}

window.handlePreviewSelect = (id) => {
  window.api.addToSchedule(state.currentUser.id, id);
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
  const newStart = String(Math.floor(nS / 60)).padStart(2, '0') + ':' + String(nS % 60).padStart(2, '0');
  const newEnd = String(Math.floor(nE / 60)).padStart(2, '0') + ':' + String(nE % 60).padStart(2, '0');

  if (payload.isCustom) {
    window.api.updateCustomEvent(payload.id, { day: newDay, start: newStart, end: newEnd });
  } else {
    window.api.editCourseSession(payload.id, { day: newDay, start: newStart, end: newEnd });
    const pref = window.api.getEventPreference(state.currentUser.id, payload.id);
    delete pref.day;
    delete pref.start;
    delete pref.end;
    window.api.saveEventPreference(state.currentUser.id, payload.id, pref);
  }

  if (state.previewCourseCode && document.getElementById('modal-course-info') && !document.getElementById('modal-course-info').classList.contains('hidden')) {
    renderCourseSessions(state.previewCourseCode);
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

  // Save exams data if provided
  const moeda = document.getElementById('req-moeda').value;
  const moedb = document.getElementById('req-moedb').value;
  if (moeda || moedb) {
    window.api.saveCourseExams(state.currentUniId, courseData.code, { moeda, moedb });
  }

  // Don't automatically add the newly created course section to the user's schedule.
  // Instead, just make sure it's in the catalog so the user can 'pick' sessions via visibility mode.
  // window.api.addToSchedule(state.currentUser.id, newCourse.id);

  if (state.catalogCourseCodes && !state.catalogCourseCodes.includes(courseData.code)) {
    state.catalogCourseCodes.push(courseData.code);
    saveCatalogState();
  }

  document.getElementById('form-request-course').reset();
  document.getElementById('modal-request').classList.add('hidden');

  // Enter visibility mode for the new course immediately so they can pick sessions
  if (!state.previewCourseCodes) state.previewCourseCodes = [];
  if (!state.previewCourseCodes.includes(courseData.code)) state.previewCourseCodes.push(courseData.code);

  renderStudentDashboard();
}

// ==================== EXAM SCHEDULE ====================
window.openExamSchedule = function () {
  const container = document.getElementById('exam-schedule-list');
  const allCourses = window.api.getPublicCourses(state.currentUniId);

  // Use catalogCourseCodes — any course in the "My Courses" sidebar shows its exams
  const myCodes = (state.catalogCourseCodes || []).slice();

  const examsList = [];

  myCodes.forEach(code => {
    const exams = window.api.getCourseExams(state.currentUniId, code);
    // Find the course name from allCourses
    const sample = allCourses.find(c => c.code === code);
    const courseName = sample ? sample.name : code;

    if (exams.moeda) examsList.push({ code, name: courseName, type: 'Moed A', date: exams.moeda });
    if (exams.moedb) examsList.push({ code, name: courseName, type: 'Moed B', date: exams.moedb });
  });

  const moedAList = examsList.filter(ex => ex.type === 'Moed A').sort((a, b) => new Date(a.date) - new Date(b.date));
  const moedBList = examsList.filter(ex => ex.type === 'Moed B').sort((a, b) => new Date(a.date) - new Date(b.date));

  const renderExamCard = (ex) => {
    const dateObj = new Date(ex.date);
    const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return `
      <div style="background:var(--surface-2); border:1px solid var(--border); padding:0.75rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:var(--text-light); font-size:0.9rem;">${ex.name}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${ex.code})</span>
          <div style="font-size:0.8rem; color:var(--primary); font-weight:600; margin-top:0.25rem;">${ex.type}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--text-light); font-size:0.85rem; font-weight:500;">${dateStr}</div>
        </div>
      </div>
    `;
  };

  if (examsList.length === 0) {
    container.innerHTML = '<div style="grid-column: span 2; text-align: center;"><p style="color:var(--text-muted); padding:1rem; font-size:0.9rem;">No upcoming exams scheduled.<br>Add exams from the course info (i) button.</p></div>';
  } else {
    const colAHtml = `<div style="display:flex; flex-direction:column; gap:0.75rem;">
      <h3 style="color:var(--text-muted); font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">Moed A</h3>
      ${moedAList.length > 0 ? moedAList.map(renderExamCard).join('') : '<p style="font-size:0.85rem; color:var(--text-muted);">No Moed A exams scheduled.</p>'}
    </div>`;

    const colBHtml = `<div style="display:flex; flex-direction:column; gap:0.75rem;">
      <h3 style="color:var(--text-muted); font-size:1rem; border-bottom:1px solid var(--border); padding-bottom:0.5rem;">Moed B</h3>
      ${moedBList.length > 0 ? moedBList.map(renderExamCard).join('') : '<p style="font-size:0.85rem; color:var(--text-muted);">No Moed B exams scheduled.</p>'}
    </div>`;

    container.innerHTML = colAHtml + colBHtml;
  }

  document.getElementById('modal-exam-schedule').classList.remove('hidden');
};

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

// ==================== TO-DO LIST ====================
function loadTodo() {
  showView('todo');
  renderTodos();
}

function submitTodoTask() {
  const desc = document.getElementById('todo-desc').value.trim();
  const importance = document.getElementById('todo-importance').value;
  const dueDate = document.getElementById('todo-date').value;
  const courseCode = document.getElementById('todo-course').value;

  if (!desc) return;

  window.api.addTodo(state.currentUser.id, { description: desc, importance, dueDate, courseCode });

  document.getElementById('form-todo').reset();
  document.getElementById('tm-create-form-container').classList.add('hidden');
  renderTodos();
}

function renderTodos() {
  const container = document.getElementById('todo-list-container');
  let todos = window.api.getTodos(state.currentUser.id);

  // Update Stats
  const activeCount = todos.filter(t => t.status !== 'done').length;
  const doneCount = todos.filter(t => t.status === 'done').length;
  document.getElementById('tm-stats').textContent = `${activeCount} active · ${doneCount} completed`;

  // Filters
  const fStatus = document.getElementById('filter-status').value;
  const fPriority = document.getElementById('filter-priority').value;
  const fCourse = document.getElementById('filter-course').value.trim().toLowerCase();

  if (fStatus !== 'all') {
    todos = todos.filter(t => t.status === fStatus);
  }
  if (fPriority !== 'all') {
    todos = todos.filter(t => t.importance === fPriority);
  }
  if (fCourse !== '') {
    todos = todos.filter(t => t.courseCode && t.courseCode.toLowerCase().includes(fCourse));
  }

  // Sort
  const sortBy = document.getElementById('sort-by').value;
  const importanceValues = { high: 3, medium: 2, low: 1 };

  todos.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    if (sortBy === 'priority') {
      return importanceValues[b.importance] - importanceValues[a.importance];
    } else {
      // sort by date
      if (a.dueDate && b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      } else if (a.dueDate) { return -1; }
      else if (b.dueDate) { return 1; }
      else { return importanceValues[b.importance] - importanceValues[a.importance]; }
    }
  });

  if (todos.length === 0) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4rem 2rem; color:var(--text-muted); text-align:center;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem; opacity:0.5;">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <path d="M9 16l2 2 4-4"/>
        </svg>
        <div style="font-size:1.1rem; font-weight:500; color:#f8fafc; margin-bottom:0.4rem;">No tasks found</div>
        <div style="font-size:0.85rem;">Click "New Task" to create your first task</div>
      </div>
    `;
    return;
  }

  let html = '';
  todos.forEach(t => {
    const isDone = t.status === 'done';
    const courseBadge = t.courseCode ? `<span class="todo-course-tag">${t.courseCode}</span>` : '';
    html += `
      <div class="todo-item ${isDone ? 'done' : ''}" id="todo-el-${t.id}">
        <div class="todo-checkbox-wrapper">
          <input type="checkbox" class="todo-checkbox" data-id="${t.id}" ${isDone ? 'checked disabled' : ''}>
          <div class="todo-content">
            <div class="todo-desc">${t.description}</div>
            <div class="todo-meta">
              <span>Due: ${t.dueDate || 'No date'}</span>
              <span class="todo-badge ${t.importance}">${t.importance}</span>
              ${courseBadge}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.todo-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const id = e.target.dataset.id || e.target.getAttribute('data-id');
        window.api.updateTodoStatus(id, 'done');

        const todoEl = document.getElementById('todo-el-' + id);
        if (todoEl) {
          todoEl.classList.add('done');
          e.target.disabled = true;

          let activeCountsNow = parseInt(document.getElementById('tm-stats').textContent.split(' ')[0]) - 1;
          let doneCountsNow = parseInt(document.getElementById('tm-stats').textContent.split(' ')[3]) + 1;
          document.getElementById('tm-stats').textContent = `${Math.max(0, activeCountsNow)} active · ${doneCountsNow} completed`;
        }

        setTimeout(() => {
          if (window.api.getTodos(state.currentUser.id).some(x => x.id === id)) {
            window.api.removeTodo(id);
            renderTodos();
          }
        }, 5000);
      }
    });
  });
}

// ==================== START ====================
document.addEventListener('DOMContentLoaded', init);
