const initialUniversities = [
  { id: 'huji', name: 'Hebrew University of Jerusalem' },
  { id: 'tau', name: 'Tel Aviv University' },
  { id: 'bgu', name: 'Ben-Gurion University of the Negev' },
  { id: 'haifa', name: 'University of Haifa' }
];

const DB_KEY = 'uniScheduleDB';

class DataStore {
  constructor() {
    this.db = this.loadData();
    this.ensureSeedCourses();
  }

  loadData() {
    const data = localStorage.getItem(DB_KEY);
    if (data) {
      return JSON.parse(data);
    }
    const initialDB = {
      users: [], 
      courses: [], 
      schedules: {} 
    };
    return initialDB;
  }

  saveData() {
    localStorage.setItem(DB_KEY, JSON.stringify(this.db));
  }

  getUniversities() {
    return initialUniversities;
  }

  ensureSeedCourses() {
    if (this.db._seeded) return;
    const seeds = [
      // HUJI courses with multiple sections
      { uniId:'huji', name:'Intro to CS', code:'CS101', faculty:'Computer Science', type:'lecture', lecturer:'Prof. Cohen', room:'Rothberg 01', day:'Sunday', start:'08:00', end:'10:00', group:'1', credits:'4' },
      { uniId:'huji', name:'Intro to CS', code:'CS101', faculty:'Computer Science', type:'lecture', lecturer:'Prof. Levi', room:'Rothberg 02', day:'Tuesday', start:'10:00', end:'12:00', group:'2', credits:'4' },
      { uniId:'huji', name:'Intro to CS', code:'CS101', faculty:'Computer Science', type:'lecture', lecturer:'Prof. Cohen', room:'Rothberg 01', day:'Thursday', start:'14:00', end:'16:00', group:'3', credits:'4' },
      { uniId:'huji', name:'Linear Algebra', code:'MATH201', faculty:'Mathematics', type:'lecture', lecturer:'Dr. Ben-David', room:'Manchester 101', day:'Monday', start:'10:00', end:'12:00', group:'1', credits:'5' },
      { uniId:'huji', name:'Linear Algebra', code:'MATH201', faculty:'Mathematics', type:'lecture', lecturer:'Dr. Shapira', room:'Manchester 202', day:'Wednesday', start:'08:00', end:'10:00', group:'2', credits:'5' },
      { uniId:'huji', name:'Data Structures', code:'CS201', faculty:'Computer Science', type:'lecture', lecturer:'Prof. Amir', room:'Rothberg 03', day:'Sunday', start:'12:00', end:'14:00', group:'1', credits:'4' },
      { uniId:'huji', name:'Data Structures', code:'CS201', faculty:'Computer Science', type:'tutorial', lecturer:'TA Noa', room:'Rothberg Lab', day:'Monday', start:'14:00', end:'16:00', group:'1', credits:'4' },
      { uniId:'huji', name:'Data Structures', code:'CS201', faculty:'Computer Science', type:'tutorial', lecturer:'TA Yossi', room:'Rothberg Lab', day:'Wednesday', start:'12:00', end:'14:00', group:'2', credits:'4' },
      // TAU courses
      { uniId:'tau', name:'Physics I', code:'PHYS101', faculty:'Physics', type:'lecture', lecturer:'Prof. Katz', room:'Shenkar 201', day:'Sunday', start:'09:00', end:'11:00', group:'1', credits:'5' },
      { uniId:'tau', name:'Physics I', code:'PHYS101', faculty:'Physics', type:'lecture', lecturer:'Prof. Rosen', room:'Shenkar 202', day:'Tuesday', start:'11:00', end:'13:00', group:'2', credits:'5' },
      { uniId:'tau', name:'Calculus I', code:'MATH101', faculty:'Mathematics', type:'lecture', lecturer:'Dr. Stern', room:'Dan David 101', day:'Monday', start:'08:00', end:'10:00', group:'1', credits:'5' },
      { uniId:'tau', name:'Calculus I', code:'MATH101', faculty:'Mathematics', type:'lecture', lecturer:'Dr. Weiss', room:'Dan David 102', day:'Thursday', start:'10:00', end:'12:00', group:'2', credits:'5' },
    ];
    seeds.forEach(s => {
      this.db.courses.push({ id: `course_seed_${Math.random().toString(36).substr(2,8)}`, ...s, approvedAt: new Date().toISOString() });
    });
    this.db._seeded = true;
    this.saveData();
  }

  login(username, password) {
    const user = this.db.users.find(u => u.username === username && u.password === password);
    return user || null;
  }

  getUser(userId) {
    return this.db.users.find(u => u.id === userId) || null;
  }

  signup(username, password, uniId, extras = {}) {
    if (this.db.users.find(u => u.username === username)) {
      return { success: false, error: 'Username already exists' };
    }
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      username,
      password,
      uniId,
      email: extras.email || '',
      firstname: extras.firstname || '',
      lastname: extras.lastname || '',
      studentid: extras.studentid || '',
      faculty: extras.faculty || ''
    };
    this.db.users.push(newUser);
    this.db.schedules[newUser.id] = [];
    this.saveData();
    return { success: true, user: newUser };
  }

  getPublicCourses(uniId) {
    return this.db.courses.filter(c => c.uniId === uniId);
  }

  getPersonalSchedule(userId) {
    return this.db.schedules[userId] || [];
  }

  ensureSchedule(userId) {
    if (!this.db.schedules[userId]) {
      this.db.schedules[userId] = [];
      this.saveData();
    }
  }

  migrateGuestData(guestId, registeredId) {
    // Migrate schedule
    if (this.db.schedules[guestId]) {
      if (!this.db.schedules[registeredId]) this.db.schedules[registeredId] = [];
      this.db.schedules[guestId].forEach(id => {
        if (!this.db.schedules[registeredId].includes(id)) {
          this.db.schedules[registeredId].push(id);
        }
      });
      delete this.db.schedules[guestId];
    }

    // Migrate todos
    if (this.db.todos) {
      this.db.todos.forEach(t => {
        if (t.userId === guestId) t.userId = registeredId;
      });
    }

    // Migrate custom events
    if (this.db.customEvents) {
      this.db.customEvents.forEach(e => {
        if (e.userId === guestId) e.userId = registeredId;
      });
    }

    // Migrate preferences
    if (this.db.preferences && this.db.preferences[guestId]) {
      if (!this.db.preferences[registeredId]) this.db.preferences[registeredId] = {};
      Object.assign(this.db.preferences[registeredId], this.db.preferences[guestId]);
      delete this.db.preferences[guestId];
    }

    this.saveData();
  }

  createCourse(courseData) {
    const newCourse = { id: 'c_' + Date.now() + Math.random().toString(36).substr(2,5), ...courseData };
    this.db.courses.push(newCourse);
    this.saveData();
    return newCourse;
  }

  deleteCourseGlobal(courseCode, uniId) {
    // 1. Find all sections of this course code in this university
    const sectionsToDelete = this.db.courses.filter(c => c.code === courseCode && c.uniId === uniId);
    if (sectionsToDelete.length === 0) return false;

    const idsToDelete = sectionsToDelete.map(c => c.id);

    // 2. Remove them from global courses array
    this.db.courses = this.db.courses.filter(c => !idsToDelete.includes(c.id));

    // 3. Remove them from ALL users' schedules
    this.db.users.forEach(user => {
      // Assuming user.schedule exists and is an array of course IDs
      // If user.schedule is not directly on user object but in this.db.schedules[user.id]
      // then this part needs adjustment. Based on signup, it's this.db.schedules[newUser.id]
      if (this.db.schedules[user.id]) {
        this.db.schedules[user.id] = this.db.schedules[user.id].filter(id => !idsToDelete.includes(id));
      }
    });

    this.saveData();
    return true;
  }

  editCourseSession(sessionId, newData) {
    const idx = this.db.courses.findIndex(c => c.id === sessionId);
    if (idx !== -1) {
      this.db.courses[idx] = { ...this.db.courses[idx], ...newData };
      this.saveData();
      return true;
    }
    return false;
  }

  deleteCourseSession(sessionId) {
    this.db.courses = this.db.courses.filter(c => c.id !== sessionId);
    this.db.users.forEach(user => {
      if (this.db.schedules[user.id]) {
        this.db.schedules[user.id] = this.db.schedules[user.id].filter(id => id !== sessionId);
      }
    });
    this.saveData();
    return true;
  }

  addToSchedule(userId, courseId) {
    if (!this.db.schedules[userId]) {
      this.db.schedules[userId] = [];
    }
    if (!this.db.schedules[userId].includes(courseId)) {
      this.db.schedules[userId].push(courseId);
      this.saveData();
      return true;
    }
    return false;
  }

  removeFromSchedule(userId, courseId) {
    if (this.db.schedules[userId]) {
      this.db.schedules[userId] = this.db.schedules[userId].filter(id => id !== courseId);
      this.saveData();
      return true;
    }
    return false;
  }

  getStats(uniId) {
    return {
      totalUsers: this.db.users.filter(u => u.uniId === uniId).length,
      totalApprovedCourses: this.db.courses.filter(c => c.uniId === uniId).length,
      totalPendingRequests: this.db.requests.filter(r => r.uniId === uniId && r.status === 'pending').length,
      totalRejectedRequests: this.db.requests.filter(r => r.uniId === uniId && r.status === 'rejected').length
    };
  }

  // --- Custom Events API ---
  addCustomEvent(userId, eventData) {
    if (!this.db.customEvents) this.db.customEvents = [];
    const newEvent = {
      id: `cust_${Date.now()}`,
      userId,
      ...eventData
    };
    this.db.customEvents.push(newEvent);
    this.saveData();
    return newEvent;
  }

  getCustomEvents(userId) {
    if (!this.db.customEvents) return [];
    return this.db.customEvents.filter(e => e.userId === userId);
  }

  updateCustomEvent(eventId, eventData) {
    if (!this.db.customEvents) return false;
    const idx = this.db.customEvents.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      this.db.customEvents[idx] = { ...this.db.customEvents[idx], ...eventData };
      this.saveData();
      return true;
    }
    return false;
  }

  removeCustomEvent(eventId) {
    if (this.db.customEvents) {
      this.db.customEvents = this.db.customEvents.filter(e => e.id !== eventId);
      this.saveData();
      return true;
    }
    return false;
  }

  // --- External Preferences API (Colours, Overrides) ---
  saveEventPreference(userId, eventId, prefs) {
    if (!this.db.preferences) this.db.preferences = {};
    if (!this.db.preferences[userId]) this.db.preferences[userId] = {};
    const existing = this.db.preferences[userId][eventId] || {};
    this.db.preferences[userId][eventId] = { ...existing, ...prefs };
    this.saveData();
  }

  getEventPreference(userId, eventId) {
    if (!this.db.preferences || !this.db.preferences[userId]) return {};
    return this.db.preferences[userId][eventId] || {};
  }

  // --- Course Links API ---
  saveCourseLinks(uniId, courseCode, linksData) {
    if (!this.db.courseLinks) this.db.courseLinks = {};
    if (!this.db.courseLinks[uniId]) this.db.courseLinks[uniId] = {};
    const existing = this.db.courseLinks[uniId][courseCode] || {};
    this.db.courseLinks[uniId][courseCode] = { ...existing, ...linksData };
    this.saveData();
  }

  getCourseLinks(uniId, courseCode) {
    if (!this.db.courseLinks || !this.db.courseLinks[uniId]) return {};
    return this.db.courseLinks[uniId][courseCode] || {};
  }

  // --- To-Do List API ---
  addTodo(userId, todoData) {
    if (!this.db.todos) this.db.todos = [];
    const newTodo = {
      id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId,
      status: 'pending',
      ...todoData
    };
    this.db.todos.push(newTodo);
    this.saveData();
    return newTodo;
  }

  getTodos(userId) {
    if (!this.db.todos) return [];
    return this.db.todos.filter(t => t.userId === userId);
  }

  updateTodoStatus(todoId, status) {
    if (!this.db.todos) return false;
    const todo = this.db.todos.find(t => t.id === todoId);
    if (todo) {
      todo.status = status;
      this.saveData();
      return true;
    }
    return false;
  }

  removeTodo(todoId) {
    if (!this.db.todos) return false;
    this.db.todos = this.db.todos.filter(t => t.id !== todoId);
    this.saveData();
    return true;
  }

  // --- Exams API ---
  getCourseExams(uniId, courseCode) {
    if (!this.db.courseExams) this.db.courseExams = {};
    if (!this.db.courseExams[uniId]) this.db.courseExams[uniId] = {};
    return this.db.courseExams[uniId][courseCode] || { moeda: '', moedb: '' };
  }

  saveCourseExams(uniId, courseCode, examsData) {
    if (!this.db.courseExams) this.db.courseExams = {};
    if (!this.db.courseExams[uniId]) this.db.courseExams[uniId] = {};
    const existing = this.db.courseExams[uniId][courseCode] || {};
    this.db.courseExams[uniId][courseCode] = { ...existing, ...examsData };
    this.saveData();
  }

  // --- Course Details (Description & Feedback) API ---
  getCourseDetails(uniId, courseCode) {
    if (!this.db.courseDetails) this.db.courseDetails = {};
    if (!this.db.courseDetails[uniId]) this.db.courseDetails[uniId] = {};
    const details = this.db.courseDetails[uniId][courseCode] || {};
    return {
      description: details.description || '',
      feedbacks: details.feedbacks || []
    };
  }

  saveCourseDescription(uniId, courseCode, description) {
    if (!this.db.courseDetails) this.db.courseDetails = {};
    if (!this.db.courseDetails[uniId]) this.db.courseDetails[uniId] = {};
    const existing = this.db.courseDetails[uniId][courseCode] || {};
    this.db.courseDetails[uniId][courseCode] = { ...existing, description };
    this.saveData();
  }

  addCourseFeedback(uniId, courseCode, feedbackData) {
    if (!this.db.courseDetails) this.db.courseDetails = {};
    if (!this.db.courseDetails[uniId]) this.db.courseDetails[uniId] = {};
    const existing = this.db.courseDetails[uniId][courseCode] || { feedbacks: [] };
    if (!existing.feedbacks) existing.feedbacks = [];
    
    const existingIdx = existing.feedbacks.findIndex(f => f.userId === feedbackData.userId);
    if (existingIdx !== -1) {
      existing.feedbacks[existingIdx] = { ...existing.feedbacks[existingIdx], ...feedbackData, date: new Date().toISOString() };
    } else {
      existing.feedbacks.unshift({ ...feedbackData, date: new Date().toISOString() });
    }
    
    this.db.courseDetails[uniId][courseCode] = existing;
    this.saveData();
  }
}

window.api = new DataStore();
