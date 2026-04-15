// App State
const state = {
  currentUniId: null,
  currentUser: null,
  authMode: 'login',
  previewCourseCodes: [],
  catalogCourseCodes: [],
  isGuest: false,
  draggingItem: null,
  draggingDuration: 60 // minutes
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
  haifa: 'University of Haifa',
  technion: 'Technion – Israel Institute of Technology'
};

// DOM
const views = {
  welcome: document.getElementById('view-welcome'),
  auth: document.getElementById('view-auth'),
  student: document.getElementById('view-student'),
  todo: document.getElementById('view-todo'),
  progress: document.getElementById('view-progress'),
  gpa: document.getElementById('view-gpa'),
  profile: document.getElementById('view-profile')
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
    } else if (hash === 'progress') {
      loadCatalogState();
      loadSemesterProgress();
    } else if (hash === 'gpa') {
      loadCatalogState();
      loadGpaCalculator();
    } else if (hash === 'profile') {
      loadCatalogState();
      showView('profile');
    } else {
      loadCatalogState();
      loadDashboard();
    }
  } else {
    if (hash === 'auth') {
      showView('auth');
    } else if (hash === 'gpa') {
      loadCatalogState();
      loadGpaCalculator();
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
    // If user is already logged in, show 'Workspace' and hide 'Get Started'
    if (state.currentUser) {
      document.getElementById('nav-landing-login').classList.add('hidden');
      document.getElementById('nav-landing-getstarted').classList.add('hidden');
      document.getElementById('nav-landing-workspace').classList.remove('hidden');
    } else {
      document.getElementById('nav-landing-login').classList.remove('hidden');
      document.getElementById('nav-landing-getstarted').classList.remove('hidden');
      document.getElementById('nav-landing-workspace').classList.add('hidden');
    }
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

  // Render view-specific data
  if (viewId === 'progress' && state.currentUser) {
    renderSemesterProgress();
  } else if (viewId === 'gpa' && state.currentUser) {
    renderGpaCalculator();
  } else if (viewId === 'profile' && state.currentUser) {
    renderProfilePage();
  }

  // Scroll to top on view change
  window.scrollTo(0, 0);
}

function updateAuthUI() {
  const isLogin = state.authMode === 'login';
  document.getElementById('auth-title').textContent = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('auth-desc').textContent = isLogin
    ? 'Enter your credentials to access your schedule.'
    : 'Fill in your details to get started with UniTracker.';
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
  // Hamburger Dropdown Toggle
  const btnHamburger = document.getElementById('btn-hamburger');
  const dropdownHamburger = document.getElementById('hamburger-dropdown');
  
  if (btnHamburger && dropdownHamburger) {
    btnHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownHamburger.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownHamburger.contains(e.target)) {
        dropdownHamburger.classList.add('hidden');
      }
    });

    document.querySelectorAll('.hamburger-item').forEach(item => {
      item.addEventListener('click', () => {
        dropdownHamburger.classList.add('hidden');
      });
    });
  }

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
        ondragover="handleDragOverEmpty(event, this)"
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

  // Drop Preview Ghost
  html += `<div id="drop-preview" class="hidden" style="z-index:15; pointer-events:none; border:2px dashed var(--success); background:rgba(16,185,129,0.2); border-radius:6px; grid-column:2; grid-row:2;"></div>`;

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
    ondragover="handleDragOverBlock(event, this)"
    ondragenter="handleDragEnterBlock(event, this)"
    ondragleave="handleDragLeaveBlock(event, this)"
    ondrop="handleDropBlock(event, this)"
    onclick="${clickAction}"
    style="grid-column:${col}; grid-row:${rowStart} / span ${span};
      width:calc(${widthPct.toFixed(2)}% - 4px); margin-left:calc(${leftPct.toFixed(2)}% + 2px);
      --total-cols:${totalCols}; --col-index:${colIndex};
      background:${bgColor}; color:#fff; padding:4px 5px;
      border-radius:6px; font-size:0.75rem;
      box-shadow:0 2px 8px rgba(0,0,0,0.3); z-index:5;
      position:relative;">
    ${badgeHTML}
    ${!isCustom ? `<div style="font-size:0.6rem; text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; margin-bottom:1px;">${item.code}</div>` : ''}
    <div style="font-weight:600; line-height:1.15; margin-bottom:1px; ${totalCols > 1 ? 'font-size:0.7rem;' : ''}">${item.name || item.title}</div>
    ${!isCustom ? `<div style="font-size:0.7rem; margin-top:1px; opacity:0.9;">${item.type} ${item.group || ''}</div>` : ''}
    <div style="font-size:0.7rem; margin-top:2px; opacity:0.8;">${bottomText}</div>
  </div>`;
}

function handleDragOverBlock(e, el) {
  if (!state.draggingItem || !state.draggingItem.isCustom) return;
  e.preventDefault();
  el.classList.add('drag-over-split');
  
  // Calculate day and hour from grid and mouse
  const grid = document.getElementById('student-timetable');
  const rect = grid.getBoundingClientRect();
  const scrollTop = grid.scrollTop;
  const relativeY = (e.clientY - rect.top) + scrollTop;
  const hour = START_HOUR + Math.floor((relativeY - 40) / 60);
  
  const col = parseInt(window.getComputedStyle(el).gridColumnStart);
  let day = 'Sunday';
  for (const [d, c] of Object.entries(DAY_COL)) { if (c === col) { day = d; break; } }
  
  updateDropPreview(day, hour);
}

function updateDropPreview(day, hour) {
  const preview = document.getElementById('drop-preview');
  if (!preview || !state.draggingItem) return;
  
  const span = Math.max(1, Math.round(state.draggingDuration / 60));
  const rowStart = 2 + (hour - START_HOUR);
  const col = DAY_COL[day];
  
  if (col && rowStart >= 2) {
    preview.style.gridColumn = col;
    preview.style.gridRow = `${rowStart} / span ${span}`;
    preview.classList.remove('hidden');
  }
}

function handleDragOverEmpty(e, el) {
  e.preventDefault();
  el.classList.add('drag-over');
  const day = el.dataset.day;
  const hour = parseInt(el.dataset.hour);
  updateDropPreview(day, hour);
}

function handleDragEnterBlock(e, el) {
  if (!state.draggingItem || !state.draggingItem.isCustom) return;
  el.classList.add('drag-over-split');
}

function handleDragLeaveBlock(e, el) {
  el.classList.remove('drag-over-split');
}

function handleDropBlock(e, el) {
  e.preventDefault();
  el.classList.remove('drag-over-split');
  
  // Map column back to day using grid position
  const style = window.getComputedStyle(el);
  const col = parseInt(style.gridColumnStart);
  let day = 'Sunday';
  for (const [d, c] of Object.entries(DAY_COL)) {
    if (c === col) { day = d; break; }
  }
  
  // Pass the drop event to handleDropGlobal with the target day. 
  // handleDropGlobal will now calculate the hour from the mouse coordinates.
  handleDropGlobal(e, { dataset: { day }, classList: { remove: () => {} } });
}

window.handlePreviewSelect = (id) => {
  window.api.addToSchedule(state.currentUser.id, id);
  renderStudentDashboard();
};

// ==================== DRAG & DROP ====================
function handleDragStartGlobal(e, id, isCustom) {
  let item;
  if (isCustom) {
    item = window.api.getCustomEvents(state.currentUser.id).find(x => x.id === id);
  } else {
    item = window.api.getPublicCourses(state.currentUniId).find(x => x.id === id);
  }
  
  if (item) {
    const s = item.start.split(':').map(Number);
    const e = item.end.split(':').map(Number);
    state.draggingDuration = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
  }

  state.draggingItem = { id, isCustom };
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, isCustom }));
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function handleDragEndGlobal(e) { 
  e.target.classList.remove('dragging'); 
  state.draggingItem = null;
  document.querySelectorAll('.drag-over-split').forEach(el => el.classList.remove('drag-over-split'));
  const preview = document.getElementById('drop-preview');
  if (preview) preview.classList.add('hidden');
}

function handleDropGlobal(e, cell) {
  e.preventDefault();
  cell.classList.remove('drag-over');
  
  const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
  const newDay = cell.dataset.day;
  
  // Calculate hour accurately from mouse position if dataset is missing (e.g. dropped on block)
  // or use the dataset if available for cells
  let newHour = parseInt(cell.dataset.hour);
  
  if (isNaN(newHour)) {
    const grid = document.getElementById('student-timetable');
    const rect = grid.getBoundingClientRect();
    const scrollTop = grid.scrollTop;
    const relativeY = (e.clientY - rect.top) + scrollTop;
    // CSS uses 40px for header and 60px per hour row
    newHour = START_HOUR + Math.floor((relativeY - 40) / 60);
  }

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

// ==================== SEMESTER PROGRESS ====================
function loadSemesterProgress() {
  showView('progress');
  renderSemesterProgress();
}

window.switchProgressTab = function(tab) {
  document.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.sp-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('sp-tab-catalog').classList.toggle('hidden', tab !== 'catalog');
  document.getElementById('sp-tab-custom').classList.toggle('hidden', tab !== 'custom');
};

function getTrackedCourses() {
  const key = `sp_tracked_${state.currentUser.id}_${state.currentUniId}`;
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) { return []; }
}

function saveTrackedCourses(list) {
  const key = `sp_tracked_${state.currentUser.id}_${state.currentUniId}`;
  localStorage.setItem(key, JSON.stringify(list));
}

function renderSemesterProgress() {
  renderCatalogForProgress();
  renderProgressCards();
  updateOverallSummary();
}

function renderCatalogForProgress() {
  const container = document.getElementById('sp-catalog-list');
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const tracked = getTrackedCourses();
  const trackedCodes = tracked.filter(t => t.type === 'public').map(t => t.code);

  // Only show courses from catalog
  const myCodes = state.catalogCourseCodes || [];
  const grouped = {};
  myCodes.forEach(code => {
    const sample = allCourses.find(c => c.code === code);
    if (sample && !trackedCodes.includes(code)) {
      grouped[code] = sample;
    }
  });

  const entries = Object.values(grouped);
  if (entries.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1rem; font-size:0.9rem;">All catalog courses are already being tracked, or no courses in your catalog.</p>';
    return;
  }

  container.innerHTML = entries.map(c => `
    <div class="sp-catalog-item" data-code="${c.code}">
      <div>
        <strong>${c.name}</strong>
        <span style="color:var(--text-muted); font-size:0.8rem; margin-left:0.5rem;">${c.code}</span>
      </div>
      <button class="btn-primary" style="font-size:0.8rem; padding:0.3rem 0.8rem; border-radius:6px;" onclick="addPublicCourseToProgress('${c.code}')">+ Track</button>
    </div>
  `).join('');
}

window.addPublicCourseToProgress = function(code) {
  const tracked = getTrackedCourses();
  if (tracked.find(t => t.type === 'public' && t.code === code)) return;

  // Get or create default structure
  let structure = window.api.getCourseStructure(state.currentUniId, code);
  if (structure.lectures === 0 && structure.tutorials === 0 && structure.homeworks === 0) {
    // Default: 13 lectures, 0 tutorials, 4 homeworks
    structure = { lectures: 13, tutorials: 0, homeworks: 4 };
    window.api.saveCourseStructure(state.currentUniId, code, structure);
  }

  tracked.push({ type: 'public', code });
  saveTrackedCourses(tracked);
  renderSemesterProgress();
};

function setupProgressListeners() {
  document.getElementById('btn-add-progress-course').addEventListener('click', () => {
    const selector = document.getElementById('sp-course-selector');
    selector.classList.toggle('hidden');
    if (!selector.classList.contains('hidden')) renderCatalogForProgress();
  });

  document.getElementById('btn-sp-create-custom').addEventListener('click', () => {
    const name = document.getElementById('sp-custom-name').value.trim();
    if (!name) { alert('Please enter a course name.'); return; }
    const lectures = parseInt(document.getElementById('sp-custom-lectures').value) || 0;
    const tutorials = parseInt(document.getElementById('sp-custom-tutorials').value) || 0;
    const homeworks = parseInt(document.getElementById('sp-custom-homeworks').value) || 0;

    const course = window.api.addCustomProgressCourse(state.currentUser.id, { name });
    window.api.saveCustomCourseStructure(state.currentUser.id, course.id, { lectures, tutorials, homeworks });

    const tracked = getTrackedCourses();
    tracked.push({ type: 'custom', id: course.id });
    saveTrackedCourses(tracked);

    document.getElementById('sp-custom-name').value = '';
    document.getElementById('sp-custom-lectures').value = '13';
    document.getElementById('sp-custom-tutorials').value = '0';
    document.getElementById('sp-custom-homeworks').value = '4';
    document.getElementById('sp-course-selector').classList.add('hidden');
    renderSemesterProgress();
  });
}

function renderProgressCards() {
  const container = document.getElementById('sp-courses-container');
  const tracked = getTrackedCourses();

  if (tracked.length === 0) {
    container.innerHTML = `
      <div class="sp-empty-state">
        <div class="sp-empty-icon">🎓</div>
        <h3>No courses being tracked yet</h3>
        <p>Click <strong>"+ Add Course"</strong> above to start tracking your semester progress.</p>
      </div>
    `;
    return;
  }

  let html = '';
  tracked.forEach((entry, idx) => {
    if (entry.type === 'public') {
      html += renderPublicProgressCard(entry.code, idx);
    } else if (entry.type === 'custom') {
      html += renderCustomProgressCard(entry.id, idx);
    }
  });
  container.innerHTML = html;
  attachProgressCardListeners();
}

function renderPublicProgressCard(code, idx) {
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const sample = allCourses.find(c => c.code === code);
  if (!sample) return '';

  const structure = window.api.getCourseStructure(state.currentUniId, code);
  const progress = window.api.getUserProgress(state.currentUser.id, state.currentUniId, code);
  const color = getCourseColorStr(code);

  return buildProgressCardHTML({
    id: code,
    name: sample.name,
    code: sample.code,
    color,
    structure,
    progress,
    isPublic: true,
    index: idx
  });
}

function renderCustomProgressCard(courseId, idx) {
  const customCourses = window.api.getCustomProgressCourses(state.currentUser.id);
  const course = customCourses.find(c => c.id === courseId);
  if (!course) return '';

  const structure = window.api.getCustomCourseStructure(state.currentUser.id, courseId);
  const progress = window.api.getCustomCourseProgress(state.currentUser.id, courseId);

  return buildProgressCardHTML({
    id: courseId,
    name: course.name,
    code: null,
    color: '#8b5cf6',
    structure,
    progress,
    isPublic: false,
    index: idx
  });
}

function buildProgressCardHTML({ id, name, code, color, structure, progress, isPublic, index }) {
  const safeName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  const safeId = id.replace ? id.replace(/'/g, "\\'") : id;
  const totalItems = (structure.lectures || 0) + (structure.tutorials || 0) + (structure.homeworks || 0);
  const completedItems = Math.min(progress.lectures.length, structure.lectures || 0)
    + Math.min(progress.tutorials.length, structure.tutorials || 0)
    + Math.min(progress.homeworks.length, structure.homeworks || 0);
  const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const lecturesDone = Math.min(progress.lectures.length, structure.lectures || 0);
  const tutsDone = Math.min(progress.tutorials.length, structure.tutorials || 0);
  const hwDone = Math.min(progress.homeworks.length, structure.homeworks || 0);

  let rowsHTML = '';

  // Lectures row
  if (structure.lectures > 0) {
    rowsHTML += buildProgressRow('Lectures', 'lectures', structure.lectures, progress.lectures, id, isPublic, color, '📖');
  }

  // Tutorials row
  if (structure.tutorials > 0) {
    rowsHTML += buildProgressRow('Tutorials', 'tutorials', structure.tutorials, progress.tutorials, id, isPublic, color, '📝');
  }

  // Homeworks row
  if (structure.homeworks > 0) {
    rowsHTML += buildProgressRow('Homeworks', 'homeworks', structure.homeworks, progress.homeworks, id, isPublic, '#f59e0b', '📋');
  }

  return `
    <div class="sp-card" style="--card-color: ${color}; animation-delay: ${index * 0.08}s;">
      <div class="sp-card-header">
        <div class="sp-card-left">
          <div class="sp-card-color-bar" style="background:${color};"></div>
          <div>
            <h3 class="sp-card-title">${name}</h3>
            ${code ? `<span class="sp-card-code">${code}</span>` : '<span class="sp-card-code" style="color:#c084fc;">Custom Course</span>'}
          </div>
        </div>
        <div class="sp-card-right">
          <div class="sp-card-pct" style="color:${color};">${pct}%</div>
          <div class="sp-card-actions">
            <button class="sp-btn-edit" data-id="${safeId}" data-public="${isPublic}" title="Edit counts">✏️</button>
            <button class="sp-btn-remove" data-id="${safeId}" data-public="${isPublic}" title="Remove from tracking">✕</button>
          </div>
        </div>
      </div>

      <!-- Edit Inline (hidden by default) -->
      <div class="sp-card-edit hidden" id="sp-edit-${safeId}">
        <div class="sp-edit-grid">
          <div class="sp-edit-field">
            <label>Lectures</label>
            <input type="number" min="0" max="50" value="${structure.lectures}" id="sp-ed-lec-${safeId}">
          </div>
          <div class="sp-edit-field">
            <label>Tutorials</label>
            <input type="number" min="0" max="50" value="${structure.tutorials}" id="sp-ed-tut-${safeId}">
          </div>
          <div class="sp-edit-field">
            <label>Homeworks</label>
            <input type="number" min="0" max="50" value="${structure.homeworks}" id="sp-ed-hw-${safeId}">
          </div>
        </div>
        <div class="sp-edit-actions">
          <button class="btn-primary sp-save-edit" data-id="${safeId}" data-public="${isPublic}" style="font-size:0.8rem; padding:0.35rem 1rem; border-radius:6px;">Save</button>
          <button class="btn-text sp-cancel-edit" data-id="${safeId}" style="font-size:0.8rem;">Cancel</button>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="sp-card-stats">
        ${structure.lectures > 0 ? `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:${color}"></span>${lecturesDone}/${structure.lectures} lectures</span>` : ''}
        ${structure.tutorials > 0 ? `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:${color}"></span>${tutsDone}/${structure.tutorials} tutorials</span>` : ''}
        ${structure.homeworks > 0 ? `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:#f59e0b"></span>${hwDone}/${structure.homeworks} homeworks</span>` : ''}
      </div>

      <!-- Course Progress Bar -->
      <div class="sp-card-bar">
        <div class="sp-card-bar-fill" style="width:${pct}%; background:linear-gradient(90deg, ${color}, ${color}dd);"></div>
      </div>

      <!-- Progress Table -->
      <div class="sp-grid-wrapper">
        <table class="sp-progress-table">
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildProgressRow(label, type, count, completed, courseId, isPublic, color, icon) {
  const safeId = courseId.replace ? courseId.replace(/'/g, "\\'") : courseId;
  let cellsHTML = '';
  for (let i = 1; i <= count; i++) {
    const isChecked = completed.includes(i);
    cellsHTML += `
      <td>
        <label class="sp-cell ${isChecked ? 'checked' : ''}" style="--cell-color:${color};">
          <input type="checkbox" class="sp-checkbox" data-course="${safeId}" data-type="${type}" data-num="${i}" data-public="${isPublic}" ${isChecked ? 'checked' : ''}>
          <span class="sp-cell-num">${i}</span>
          <span class="sp-cell-check">✓</span>
        </label>
      </td>
    `;
  }

  const completedCount = Math.min(completed.length, count);

  return `
    <tr class="sp-row">
      <td class="sp-row-label">
        <span class="sp-row-icon">${icon}</span>
        <span class="sp-row-name">${label}</span>
        <span class="sp-row-count">${completedCount}/${count}</span>
      </td>
      ${cellsHTML}
    </tr>
  `;
}

function attachProgressCardListeners() {
  // Checkboxes
  document.querySelectorAll('.sp-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const courseId = e.target.dataset.course;
      const type = e.target.dataset.type;
      const num = parseInt(e.target.dataset.num);
      const isPublic = e.target.dataset.public === 'true';
      const cell = e.target.closest('.sp-cell');

      let progress;
      let structure;
      if (isPublic) {
        progress = window.api.getUserProgress(state.currentUser.id, state.currentUniId, courseId);
        structure = window.api.getCourseStructure(state.currentUniId, courseId);
      } else {
        progress = window.api.getCustomCourseProgress(state.currentUser.id, courseId);
        structure = window.api.getCustomCourseStructure(state.currentUser.id, courseId);
      }

      if (e.target.checked) {
        if (!progress[type].includes(num)) progress[type].push(num);
        cell.classList.add('checked');
        // Pop animation
        cell.style.transform = 'scale(1.2)';
        setTimeout(() => cell.style.transform = '', 200);
      } else {
        progress[type] = progress[type].filter(n => n !== num);
        cell.classList.remove('checked');
      }

      if (isPublic) {
        window.api.saveUserProgress(state.currentUser.id, state.currentUniId, courseId, progress);
      } else {
        window.api.saveCustomCourseProgress(state.currentUser.id, courseId, progress);
      }

      // Surgically Update local DOM stats without re-rendering card entirely
      const card = cell.closest('.sp-card');
      
      // 1. Update checking row (e.g., 5/13)
      const row = cell.closest('.sp-row');
      if (row) {
        const countLabel = row.querySelector('.sp-row-count');
        const countStruct = structure[type] || 0;
        const rowCount = Math.min(progress[type].length, countStruct);
        if (countLabel) countLabel.textContent = `${rowCount}/${countStruct}`;
      }

      // 2. Update Card total pct and bar
      const totalItems = (structure.lectures || 0) + (structure.tutorials || 0) + (structure.homeworks || 0);
      const completedItems = Math.min(progress.lectures.length, structure.lectures || 0)
        + Math.min(progress.tutorials.length, structure.tutorials || 0)
        + Math.min(progress.homeworks.length, structure.homeworks || 0);
      const pct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      const pctLabel = card.querySelector('.sp-card-pct');
      if (pctLabel) pctLabel.textContent = `${pct}%`;
      
      const barFill = card.querySelector('.sp-card-bar-fill');
      if (barFill) barFill.style.width = `${pct}%`;

      // 3. Update the specific stats pills dynamically
      const lecturesDone = Math.min(progress.lectures.length, structure.lectures || 0);
      const tutsDone = Math.min(progress.tutorials.length, structure.tutorials || 0);
      const hwDone = Math.min(progress.homeworks.length, structure.homeworks || 0);

      const computedColor = card.style.getPropertyValue('--card-color').trim() || '#3b82f6';
      const statsDiv = card.querySelector('.sp-card-stats');

      if (statsDiv) {
        let statsHtml = '';
        if (structure.lectures > 0) statsHtml += `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:${computedColor}"></span>${lecturesDone}/${structure.lectures} lectures</span>`;
        if (structure.tutorials > 0) statsHtml += `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:${computedColor}"></span>${tutsDone}/${structure.tutorials} tutorials</span>`;
        if (structure.homeworks > 0) statsHtml += `<span class="sp-stat-pill"><span class="sp-stat-dot" style="background:#f59e0b"></span>${hwDone}/${structure.homeworks} homeworks</span>`;
        statsDiv.innerHTML = statsHtml;
      }

      // Update global ring stats
      updateOverallSummary();
    });
  });

  // Edit buttons
  document.querySelectorAll('.sp-btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      document.getElementById('sp-edit-' + id).classList.toggle('hidden');
    });
  });

  // Cancel edit
  document.querySelectorAll('.sp-cancel-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      document.getElementById('sp-edit-' + id).classList.add('hidden');
    });
  });

  // Save edit
  document.querySelectorAll('.sp-save-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const isPublic = e.currentTarget.dataset.public === 'true';
      const lectures = parseInt(document.getElementById('sp-ed-lec-' + id).value) || 0;
      const tutorials = parseInt(document.getElementById('sp-ed-tut-' + id).value) || 0;
      const homeworks = parseInt(document.getElementById('sp-ed-hw-' + id).value) || 0;

      if (isPublic) {
        window.api.saveCourseStructure(state.currentUniId, id, { lectures, tutorials, homeworks });
      } else {
        window.api.saveCustomCourseStructure(state.currentUser.id, id, { lectures, tutorials, homeworks });
      }

      document.getElementById('sp-edit-' + id).classList.add('hidden');
      renderProgressCards();
      updateOverallSummary();
    });
  });

  // Remove buttons
  document.querySelectorAll('.sp-btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const isPublic = e.currentTarget.dataset.public === 'true';
      let tracked = getTrackedCourses();
      if (isPublic) {
        tracked = tracked.filter(t => !(t.type === 'public' && t.code === id));
      } else {
        tracked = tracked.filter(t => !(t.type === 'custom' && t.id === id));
        window.api.removeCustomProgressCourse(state.currentUser.id, id);
      }
      saveTrackedCourses(tracked);
      renderSemesterProgress();
    });
  });
}

function updateOverallSummary() {
  const tracked = getTrackedCourses();
  let totalLec = 0, doneLec = 0, totalTut = 0, doneTut = 0, totalHw = 0, doneHw = 0;

  tracked.forEach(entry => {
    let structure, progress;
    if (entry.type === 'public') {
      structure = window.api.getCourseStructure(state.currentUniId, entry.code);
      progress = window.api.getUserProgress(state.currentUser.id, state.currentUniId, entry.code);
    } else {
      structure = window.api.getCustomCourseStructure(state.currentUser.id, entry.id);
      progress = window.api.getCustomCourseProgress(state.currentUser.id, entry.id);
    }
    totalLec += structure.lectures || 0;
    totalTut += structure.tutorials || 0;
    totalHw += structure.homeworks || 0;
    doneLec += Math.min(progress.lectures.length, structure.lectures || 0);
    doneTut += Math.min(progress.tutorials.length, structure.tutorials || 0);
    doneHw += Math.min(progress.homeworks.length, structure.homeworks || 0);
  });

  document.getElementById('sp-total-lectures').textContent = `${doneLec}/${totalLec}`;
  document.getElementById('sp-total-tutorials').textContent = `${doneTut}/${totalTut}`;
  document.getElementById('sp-total-homeworks').textContent = `${doneHw}/${totalHw}`;

  const totalAll = totalLec + totalTut + totalHw;
  const doneAll = doneLec + doneTut + doneHw;
  const pct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;

  document.getElementById('sp-ring-fill').setAttribute('stroke-dasharray', `${pct}, 100`);
  document.getElementById('sp-ring-text').textContent = `${pct}%`;
}

// ==================== GPA CALCULATOR ====================
function loadGpaCalculator() {
  showView('gpa');
  renderGpaCalculator();
}

function getGpaSelectionKey() {
  return `uniTracker_gpa_sel_${state.currentUser.id}_${state.currentUniId}`;
}

function getGpaSelectedIds() {
  try {
    const saved = localStorage.getItem(getGpaSelectionKey());
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  
  // Default: Use catalog codes if no explicit selection exists
  return state.catalogCourseCodes || [];
}

function saveGpaSelectedIds(ids) {
  localStorage.setItem(getGpaSelectionKey(), JSON.stringify(ids));
}

function getGpaCoursesList() {
  const allCourses = window.api.getPublicCourses(state.currentUniId);
  const customProgressCourses = window.api.getCustomProgressCourses(state.currentUser.id) || [];
  const selectedIds = getGpaSelectedIds();
  
  let list = [];
  
  selectedIds.forEach(id => {
    // Check if it's a catalog course
    const c = allCourses.find(x => x.code === id);
    if (c) {
      list.push({ id: c.code, name: c.name, code: c.code, defaultCredits: parseFloat(c.credits) || 0, isPublic: true });
    } else {
      // Check if it's a custom progress course
      const cust = customProgressCourses.find(x => x.id === id);
      if (cust) {
        list.push({ id: cust.id, name: cust.name, code: 'Custom', defaultCredits: cust.credits || 0, isPublic: false });
      }
    }
  });

  return list;
}

function renderGpaCalculator() {
  const courses = getGpaCoursesList();
  const gradesData = window.api.getUserGrades(state.currentUser.id, state.currentUniId);
  
  const tbody = document.getElementById('gpa-table-body');
  const emptyState = document.getElementById('gpa-empty-state');

  if (courses.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateGpaDashboard(courses, gradesData);
  } else {
    emptyState.classList.add('hidden');
    let rowsHtml = '';
    courses.forEach(c => {
      const data = gradesData[c.id] || {};
      const cred = data.credits !== undefined ? data.credits : c.defaultCredits;
      const grade = data.grade !== undefined && data.grade !== null ? data.grade : '';
      const type = data.type || 'numeric';
      
      let resultInputHtml = '';
      if (type === 'numeric') {
        resultInputHtml = `<input type="number" class="gpa-input gpa-grade-input" data-id="${c.id}" value="${grade}" min="0" max="100" placeholder="--">`;
      } else {
        resultInputHtml = `
          <select class="gpa-select gpa-binary-input" data-id="${c.id}">
            <option value="">--</option>
            <option value="pass" ${grade === 'pass' ? 'selected' : ''}>Pass</option>
            <option value="fail" ${grade === 'fail' ? 'selected' : ''}>Fail</option>
          </select>
        `;
      }
      
      rowsHtml += `
        <tr>
          <td data-label="Course" style="padding-left:1.5rem;">
            <div style="font-weight:600; color:var(--text-main); font-size:0.95rem;">${c.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${c.code}</div>
          </td>
          <td data-label="Credits">
            <input type="number" class="gpa-input gpa-credit-input" data-id="${c.id}" value="${cred}" min="0" step="0.5">
          </td>
          <td data-label="Grading Type">
            <select class="gpa-select gpa-type-input" data-id="${c.id}">
              <option value="numeric" ${type === 'numeric' ? 'selected' : ''}>Numeric</option>
              <option value="binary" ${type === 'binary' ? 'selected' : ''}>Pass/Fail</option>
            </select>
          </td>
          <td data-label="Final Result">
            <div style="position:relative;">
              ${resultInputHtml}
            </div>
          </td>
          <td data-label="Action" style="text-align:center;">
             <button class="gpa-btn-remove" data-id="${c.id}" title="Remove course">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                 <line x1="18" y1="6" x2="6" y2="18"></line>
                 <line x1="6" y1="6" x2="18" y2="18"></line>
               </svg>
             </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  }

  // Populate What-If
  const whatIfCourseSelect = document.getElementById('gpa-whatif-course');
  if (whatIfCourseSelect) {
    let whatIfHtml = '<option value="">-- Choose Course --</option>';
    courses.forEach(c => {
      whatIfHtml += `<option value="${c.id}">${c.name}</option>`;
    });
    whatIfCourseSelect.innerHTML = whatIfHtml;
  }

  attachGpaListeners(courses);
  updateGpaDashboard(courses, gradesData);
}

function attachGpaListeners(courses) {
  const gradesData = window.api.getUserGrades(state.currentUser.id, state.currentUniId);

  // Search Catalog Input
  const searchInput = document.getElementById('gpa-catalog-search');
  const resultsDiv = document.getElementById('gpa-search-results');
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) { resultsDiv.classList.add('hidden'); return; }
      
      const allPublic = window.api.getPublicCourses(state.currentUniId);
      const matches = allPublic.filter(c => 
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      ).slice(0, 10);
      
      if (matches.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:1rem; color:var(--text-muted); text-align:center;">No courses found</div>';
      } else {
        let html = '';
        const currentSel = getGpaSelectedIds();
        matches.forEach(m => {
          const isAdded = currentSel.includes(m.code);
          html += `
            <div class="gpa-result-item" onclick="addCourseToGpa('${m.code}')">
              <div class="gpa-result-info">
                <div class="gpa-result-name">${m.name}</div>
                <div class="gpa-result-meta">${m.code} • ${m.credits} Credits</div>
              </div>
              <div class="gpa-result-add">${isAdded ? '✓' : '+'}</div>
            </div>
          `;
        });
        resultsDiv.innerHTML = html;
      }
      resultsDiv.classList.remove('hidden');
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.classList.add('hidden');
      }
    });
  }

  // Toggles and Custom forms
  const btnToggle = document.getElementById('btn-gpa-toggle-custom');
  if (btnToggle && !btnToggle.dataset.bound) {
    btnToggle.dataset.bound = "true";
    btnToggle.addEventListener('click', () => {
      const form = document.getElementById('gpa-custom-form-container');
      form.classList.toggle('hidden');
    });
  }

  const btnSaveCustom = document.getElementById('btn-gpa-save-custom');
  if (btnSaveCustom && !btnSaveCustom.dataset.bound) {
    btnSaveCustom.dataset.bound = "true";
    btnSaveCustom.addEventListener('click', () => {
      const name = document.getElementById('gpa-custom-course-name').value.trim();
      const credits = parseFloat(document.getElementById('gpa-custom-course-credits').value) || 0;
      if (!name) return;
      
      const course = window.api.addCustomProgressCourse(state.currentUser.id, { name, credits });
      const sel = getGpaSelectedIds();
      if (!sel.includes(course.id)) {
        sel.push(course.id);
        saveGpaSelectedIds(sel);
      }
      
      document.getElementById('gpa-custom-course-name').value = '';
      document.getElementById('gpa-custom-course-credits').value = '';
      document.getElementById('gpa-custom-form-container').classList.add('hidden');
      renderGpaCalculator();
    });
  }

  document.getElementById('btn-gpa-cancel-custom').addEventListener('click', () => {
    document.getElementById('gpa-custom-form-container').classList.add('hidden');
  });

  // Table Inputs
  document.querySelectorAll('.gpa-credit-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      let val = parseFloat(e.target.value) || 0;
      if (!gradesData[id]) gradesData[id] = {};
      gradesData[id].credits = val;
      window.api.saveUserGrades(state.currentUser.id, state.currentUniId, gradesData);
      updateGpaDashboard(courses, gradesData);
    });
  });

  document.querySelectorAll('.gpa-type-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (!gradesData[id]) gradesData[id] = {};
      gradesData[id].type = e.target.value;
      gradesData[id].grade = null;
      window.api.saveUserGrades(state.currentUser.id, state.currentUniId, gradesData);
      renderGpaCalculator();
    });
  });

  document.querySelectorAll('.gpa-grade-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.dataset.id;
      let val = e.target.value === '' ? null : parseFloat(e.target.value);
      if (!gradesData[id]) gradesData[id] = {};
      gradesData[id].grade = val;
      window.api.saveUserGrades(state.currentUser.id, state.currentUniId, gradesData);
      updateGpaDashboard(courses, gradesData);
    });
  });

  document.querySelectorAll('.gpa-binary-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (!gradesData[id]) gradesData[id] = {};
      gradesData[id].grade = e.target.value === '' ? null : e.target.value;
      window.api.saveUserGrades(state.currentUser.id, state.currentUniId, gradesData);
      updateGpaDashboard(courses, gradesData);
    });
  });

  // Remove Course from List
  document.querySelectorAll('.gpa-btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      let sel = getGpaSelectedIds();
      sel = sel.filter(x => x !== id);
      saveGpaSelectedIds(sel);
      renderGpaCalculator();
    });
  });

  // What-If Listeners
  const modeSelect = document.getElementById('gpa-whatif-mode');
  if (modeSelect && !modeSelect.dataset.bound) {
    modeSelect.dataset.bound = "true";
    modeSelect.addEventListener('change', (e) => {
      if (e.target.value === 'existing') {
        document.getElementById('gpa-whatif-existing-group').classList.remove('hidden');
        document.getElementById('gpa-whatif-new-group').classList.add('hidden');
      } else {
        document.getElementById('gpa-whatif-existing-group').classList.add('hidden');
        document.getElementById('gpa-whatif-new-group').classList.remove('hidden');
      }
      calculateWhatIfGpa();
    });

    ['gpa-whatif-course', 'gpa-whatif-credits', 'gpa-whatif-grade'].forEach(id => {
      document.getElementById(id).addEventListener('input', calculateWhatIfGpa);
    });
  }
}

function addCourseToGpa(code) {
  let sel = getGpaSelectedIds();
  if (!sel.includes(code)) {
    sel.push(code);
    saveGpaSelectedIds(sel);
  }
  document.getElementById('gpa-catalog-search').value = '';
  document.getElementById('gpa-search-results').classList.add('hidden');
  renderGpaCalculator();
}

function updateGpaDashboard(courses, gradesData) {
  let totalCredits = 0;
  let earnedCredits = 0;
  
  let gpaCredits = 0;
  let sumGradeGpaCredits = 0;

  courses.forEach(c => {
    const data = gradesData[c.id] || {};
    const cred = data.credits !== undefined ? data.credits : c.defaultCredits;
    const grade = data.grade;
    const type = data.type || 'numeric';

    totalCredits += cred;
    
    if (grade !== undefined && grade !== null && grade !== '') {
      if (type === 'numeric') {
        const numGrade = parseFloat(grade);
        if (!isNaN(numGrade)) {
          gpaCredits += cred;
          sumGradeGpaCredits += (numGrade * cred);
          if (numGrade >= 55) earnedCredits += cred; // Passing is 55+
        }
      } else if (type === 'binary') {
        if (grade === 'pass') {
          earnedCredits += cred;
        }
      }
    }
  });

  document.getElementById('gpa-total-credits').textContent = totalCredits;
  document.getElementById('gpa-graded-credits').textContent = earnedCredits;

  const displayVal = document.getElementById('gpa-display-val');
  const card = document.querySelector('.gpa-overall-card');

  if (gpaCredits === 0) {
    displayVal.textContent = '--';
    card.style.borderColor = 'rgba(255,255,255,0.06)';
    displayVal.style.color = 'var(--text-main)';
  } else {
    const gpa = (sumGradeGpaCredits / gpaCredits).toFixed(2);
    displayVal.textContent = gpa;
    
    // Color coding
    if (gpa >= 85) {
      displayVal.style.color = '#10b981'; // Green
      card.style.borderColor = 'rgba(16,185,129,0.3)';
    } else if (gpa >= 70) {
      displayVal.style.color = '#f59e0b'; // Yellow
      card.style.borderColor = 'rgba(245,158,11,0.3)';
    } else {
      displayVal.style.color = '#ef4444'; // Red
      card.style.borderColor = 'rgba(239,68,68,0.3)';
    }
  }
}

function calculateWhatIfGpa() {
  const mode = document.getElementById('gpa-whatif-mode').value;
  const gradeInput = document.getElementById('gpa-whatif-grade').value;
  const simGrade = parseFloat(gradeInput);
  
  const resultDiv = document.getElementById('gpa-whatif-result');

  let baseGpaCredits = 0;
  let baseSum = 0;

  const courses = getGpaCoursesList();
  const gradesData = window.api.getUserGrades(state.currentUser.id, state.currentUniId);

  // Re-calculate the exact baseline without assuming UI matches DB perfectly
  courses.forEach(c => {
    const data = gradesData[c.id] || {};
    const cred = data.credits !== undefined ? data.credits : c.defaultCredits;
    const grade = data.grade;
    const type = data.type || 'numeric';

    if (type === 'numeric' && grade !== undefined && grade !== null && grade !== '') {
      const numGrade = parseFloat(grade);
      if (!isNaN(numGrade)) {
        baseGpaCredits += cred;
        baseSum += (numGrade * cred);
      }
    }
  });

  const baseGpa = baseGpaCredits > 0 ? (baseSum / baseGpaCredits) : 0;

  if (isNaN(simGrade)) {
    resultDiv.innerHTML = `Simulated GPA: <strong>--</strong>`;
    return;
  }

  let simCredits = 0;
  let simSum = baseSum;
  let newTotalCredits = baseGpaCredits;

  if (mode === 'existing') {
    const courseId = document.getElementById('gpa-whatif-course').value;
    if (!courseId) {
      resultDiv.innerHTML = `Simulated GPA: <strong>--</strong>`;
      return;
    }
    const c = courses.find(x => x.id === courseId);
    if (!c) return;
    const data = gradesData[c.id] || {};
    simCredits = data.credits !== undefined ? data.credits : c.defaultCredits;
    const type = data.type || 'numeric';
    
    // remove the old base if it was graded and numeric
    if (type === 'numeric' && data.grade !== undefined && data.grade !== null && data.grade !== '') {
      const oldGrade = parseFloat(data.grade);
      if (!isNaN(oldGrade)) {
        simSum -= (oldGrade * simCredits);
      } else {
        newTotalCredits += simCredits;
      }
    } else {
      newTotalCredits += simCredits;
    }
    simSum += (simGrade * simCredits);

  } else {
    // New Course
    simCredits = parseFloat(document.getElementById('gpa-whatif-credits').value);
    if (isNaN(simCredits) || simCredits <= 0) {
      resultDiv.innerHTML = `Simulated GPA: <strong>--</strong>`;
      return;
    }
    newTotalCredits += simCredits;
    simSum += (simGrade * simCredits);
  }

  if (newTotalCredits === 0) {
    resultDiv.innerHTML = `Simulated GPA: <strong>--</strong>`;
    return;
  }

  const newGpa = simSum / newTotalCredits;
  const diff = newGpa - baseGpa;
  let diffStr = '';
  let color = 'var(--text-main)';

  if (baseGpaCredits > 0) {
    if (diff > 0.01) {
      diffStr = ` <br><span style="color:#10b981; font-size:0.9rem;">(↑ +${diff.toFixed(2)})</span>`;
      color = '#10b981';
    } else if (diff < -0.01) {
      diffStr = ` <br><span style="color:#ef4444; font-size:0.9rem;">(↓ ${diff.toFixed(2)})</span>`;
      color = '#ef4444';
    } else {
      diffStr = ` <br><span style="color:var(--text-muted); font-size:0.9rem;">(No Change)</span>`;
    }
  }

  resultDiv.innerHTML = `Simulated GPA: <strong style="color:${color}">${newGpa.toFixed(2)}</strong>${diffStr}`;
}

// ==================== START ====================
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupProgressListeners();
  initMockupCarousel();
});

// ==================== MOCKUP CAROUSEL ====================
function initMockupCarousel() {
  const slides = document.querySelectorAll('.mockup-slide');
  const dots   = document.querySelectorAll('.mockup-dot');
  if (!slides.length) return;

  let current = 0;
  let timer;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (idx + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function next() { goTo(current + 1); }

  function startTimer() {
    timer = setInterval(next, 3500);
  }

  function resetTimer() {
    clearInterval(timer);
    startTimer();
  }

  // Dot click handlers
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goTo(i);
      resetTimer();
    });
  });

  startTimer();
}

// ==================== USER PROFILE ====================
function renderProfilePage() {
  if (!state.currentUser) return;

  // Identity
  const username = state.isGuest ? 'Guest' : (state.currentUser.username || 'User');
  const email = state.currentUser.email || (state.isGuest ? 'guest@unitracker.local' : '—');
  
  document.getElementById('profile-username').textContent = username;
  document.getElementById('profile-email').textContent = email;

  // Avatar initials
  const avatarEl = document.getElementById('profile-avatar');
  if (!state.isGuest && username.length > 0) {
    const initials = username.charAt(0).toUpperCase();
    avatarEl.innerHTML = `<span style="font-size:1.8rem; font-weight:800; font-family:'Outfit',sans-serif;">${initials}</span>`;
  }

  // Pre-fill edit form
  document.getElementById('edit-profile-username').value = state.isGuest ? '' : username;
  document.getElementById('edit-profile-email').value = state.isGuest ? '' : email;

  // Academic stats
  const courses = typeof getGpaCoursesList === 'function' ? getGpaCoursesList() : [];
  const gradesData = window.api.getUserGrades(state.currentUser.id, state.currentUniId);
  
  let totalCredits = 0;
  let earnedCredits = 0;
  let gpaCredits = 0;
  let sumGrade = 0;

  courses.forEach(c => {
    const data = gradesData[c.id] || {};
    const cred = data.credits !== undefined ? data.credits : c.defaultCredits;
    const grade = data.grade;
    const type = data.type || 'numeric';

    totalCredits += cred;

    if (grade !== undefined && grade !== null && grade !== '') {
      if (type === 'numeric') {
        const numGrade = parseFloat(grade);
        if (!isNaN(numGrade)) {
          gpaCredits += cred;
          sumGrade += numGrade * cred;
          if (numGrade >= 55) earnedCredits += cred;
        }
      } else if (type === 'binary') {
        if (grade === 'pass') earnedCredits += cred;
      }
    }
  });

  document.getElementById('profile-total-credits').textContent = totalCredits;
  document.getElementById('profile-active-courses').textContent = courses.length;

  // Calculate Semester Progress
  const tracked = getTrackedCourses();
  let totalLec = 0, doneLec = 0, totalTut = 0, doneTut = 0, totalHw = 0, doneHw = 0;

  tracked.forEach(entry => {
    let structure, progress;
    if (entry.type === 'public') {
      structure = window.api.getCourseStructure(state.currentUniId, entry.code);
      progress = window.api.getUserProgress(state.currentUser.id, state.currentUniId, entry.code);
    } else {
      structure = window.api.getCustomCourseStructure(state.currentUser.id, entry.id);
      progress = window.api.getCustomCourseProgress(state.currentUser.id, entry.id);
    }
    totalLec += structure.lectures || 0;
    totalTut += structure.tutorials || 0;
    totalHw += structure.homeworks || 0;
    doneLec += Math.min(progress.lectures.length, structure.lectures || 0);
    doneTut += Math.min(progress.tutorials.length, structure.tutorials || 0);
    doneHw += Math.min(progress.homeworks.length, structure.homeworks || 0);
  });

  const totalAll = totalLec + totalTut + totalHw;
  const doneAll = doneLec + doneTut + doneHw;
  const pct = totalAll > 0 ? Math.round((doneAll / totalAll) * 100) : 0;
  document.getElementById('profile-progress-pct').textContent = `${pct}%`;

  // Calculate Active Tasks
  let activeTodos = 0;
  if (state.currentUser) {
    const todos = window.api.getTodos ? window.api.getTodos(state.currentUser.id) : (JSON.parse(localStorage.getItem('unitracker_todos') || '[]').filter(t => t.userId === state.currentUser.id));
    activeTodos = todos.filter(t => !t.completed).length;
  }
  document.getElementById('profile-active-todos').textContent = activeTodos;
}

function toggleEditProfile() {
  const form = document.getElementById('profile-edit-form');
  form.classList.toggle('hidden');
}

function saveProfileChanges() {
  if (!state.currentUser || state.isGuest) {
    alert('Guest accounts cannot edit profile details. Please register first.');
    return;
  }

  const newUsername = document.getElementById('edit-profile-username').value.trim();
  const newEmail = document.getElementById('edit-profile-email').value.trim();
  const newPass = document.getElementById('edit-profile-password').value;
  const confirmPass = document.getElementById('edit-profile-password-confirm').value;

  if (!newUsername) { alert('Username cannot be empty.'); return; }

  if (newPass && newPass !== confirmPass) {
    alert('Passwords do not match.');
    return;
  }

  // Update user data
  const userData = window.api.getUser(state.currentUser.id);
  if (userData) {
    userData.username = newUsername;
    if (newEmail) userData.email = newEmail;
    if (newPass) userData.password = newPass;
    window.api.updateUser(state.currentUser.id, userData);
    state.currentUser = userData;
  }

  // Clear password fields
  document.getElementById('edit-profile-password').value = '';
  document.getElementById('edit-profile-password-confirm').value = '';

  // Re-render
  toggleEditProfile();
  renderProfilePage();

  // Update navbar username
  document.getElementById('nav-user-name').textContent = newUsername;
}

function profileLogout() {
  state.currentUser = null;
  state.currentUniId = null;
  state.authMode = 'login';
  state.isGuest = false;
  state.catalogCourseCodes = [];
  state.previewCourseCodes = [];
  localStorage.removeItem('uniSchedule_session');
  localStorage.removeItem('uniSchedule_guestUni');
  localStorage.removeItem('uniSchedule_catalogCodes');
  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.reset();
  showView('welcome');
}

function showDeleteAccountModal() {
  if (state.isGuest) {
    alert('Guest accounts cannot be deleted. Simply clear your data or close the browser.');
    return;
  }
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('modal-delete-account').classList.remove('hidden');
}

function confirmDeleteAccount() {
  const input = document.getElementById('delete-confirm-input').value.trim();
  const expected = state.currentUser ? state.currentUser.username : '';

  if (input !== expected) {
    alert('Username does not match. Deletion cancelled.');
    return;
  }

  // Delete user data
  if (window.api.deleteUser) {
    window.api.deleteUser(state.currentUser.id);
  }

  // Clear all localStorage keys related to user
  const userId = state.currentUser.id;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes(userId) || key.startsWith('uniSchedule_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  document.getElementById('modal-delete-account').classList.add('hidden');

  state.currentUser = null;
  state.currentUniId = null;
  state.isGuest = false;
  state.catalogCourseCodes = [];
  state.previewCourseCodes = [];

  showView('welcome');
}

function showChangePasswordModal() {
  if (state.isGuest) {
    alert('Guest accounts cannot change passwords. Please register first.');
    return;
  }
  // Show the edit form and focus on password field
  const form = document.getElementById('profile-edit-form');
  if (form.classList.contains('hidden')) {
    form.classList.remove('hidden');
  }
  setTimeout(() => {
    document.getElementById('edit-profile-password').focus();
  }, 100);
}

function openFeedbackModal(type) {
  const titles = {
    bug: '🐛 Report a Bug',
    feature: '💡 Suggest a Feature',
    feedback: '💬 Send Feedback'
  };
  const descs = {
    bug: 'Describe the issue you encountered. Include steps to reproduce if possible.',
    feature: 'Tell us about the feature you\'d like to see in UniTracker.',
    feedback: 'Share your thoughts, suggestions, or general feedback about the app.'
  };

  document.getElementById('feedback-modal-title').textContent = titles[type] || 'Send Feedback';
  document.getElementById('feedback-modal-desc').textContent = descs[type] || '';
  document.getElementById('feedback-subject').value = '';
  document.getElementById('feedback-details').value = '';
  document.getElementById('modal-feedback').classList.remove('hidden');
}

function submitFeedback(e) {
  e.preventDefault();
  const subject = document.getElementById('feedback-subject').value.trim();
  const details = document.getElementById('feedback-details').value.trim();
  
  if (!subject || !details) return;

  // Store feedback in localStorage
  const feedbackList = JSON.parse(localStorage.getItem('unitracker_feedback') || '[]');
  feedbackList.push({
    subject,
    details,
    user: state.currentUser ? state.currentUser.username : 'Guest',
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('unitracker_feedback', JSON.stringify(feedbackList));

  document.getElementById('modal-feedback').classList.add('hidden');
  document.getElementById('form-feedback').reset();

  // Show success toast
  showProfileToast('✅ Thank you! Your feedback has been submitted.');
}

function showClearDataConfirm() {
  document.getElementById('modal-clear-data').classList.remove('hidden');
}

function confirmClearAllData() {
  if (!state.currentUser) return;

  const userId = state.currentUser.id;
  
  // 1. Clear database data via API
  if (window.api && window.api.clearUserData) {
    window.api.clearUserData(userId);
  }
  
  // 2. Clear any lingering user-specific localStorage keys (redundant but safe)
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Remove keys like uniSchedule_sp_USERID, etc.
    if (key && key.includes(userId) && !key.includes('uniSchedule_session')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 3. Reset app state
  state.catalogCourseCodes = [];
  state.previewCourseCodes = [];
  localStorage.removeItem('uniSchedule_catalogCodes');

  // 4. Close modal and show feedback
  document.getElementById('modal-clear-data').classList.add('hidden');

  // 5. Re-render UI (Go to dashboard to reflect changes)
  loadDashboard();
  renderProfilePage();
  showProfileToast('🗑️ All data has been cleared successfully.');
}

function showProfileToast(message) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'profile-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
