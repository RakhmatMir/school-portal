/**
 * Школьный портал — backend (Google Apps Script).
 * Полный API как у локального FastAPI; данные в листах таблицы.
 */
var SESSION_TTL_SEC = 604800;
var PROBLEM_QUESTION_THRESHOLD_PERCENT = 40;

function doGet() {
  return HtmlService.createTemplateFromFile('WebApp')
    .evaluate()
    .setTitle('Школьный портал')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'users', [
    'id', 'login', 'password', 'role', 'full_name', 'class_name', 'staff_title',
  ], [
    [1, 'admin', 'admin123', 'admin', 'Главный админ', '', ''],
    [2, 'teacher', 'teacher123', 'teacher', 'Абдурашид (учитель)', '', ''],
    [4, 'student1', 'student123', 'student', 'Алиев Дилшод', '6Б', ''],
  ]);
  ensureSheet_(ss, 'config', ['key', 'value'], [
    ['school_name', 'Foundation School — демо'],
  ]);
  ensureSheet_(ss, 'classes', ['class_name', 'student_count', 'test_count'], [
    ['6Б', 24, 5],
    ['7-A', 22, 4],
    ['8-A', 26, 6],
  ]);
  ensureSheet_(ss, 'subjects', ['code', 'title', 'test_count'], [
    ['math', 'Математика', 2],
    ['english', 'Английский язык', 2],
    ['physics', 'Физика', 1],
  ]);
  ensureSheet_(ss, 'exams', [
    'exam_id', 'class_name', 'subject_code', 'subject_title', 'title',
    'control_date', 'duration_minutes', 'kind_label', 'phase', 'catalog_key', 'question_count',
  ], [
    [101, '6Б', 'math', 'Математика', 'Контрольная №2 — дроби', '04.10.2026', 13, 'Контрольная', 'active', 'todo', 3],
    [102, '6Б', 'english', 'Английский язык', 'Unit 5 — Grammar', '01.10.2026', 15, 'Тест', 'done', 'done', 3],
    [103, '7-A', 'math', 'Математика', 'Алгебра — линейные уравнения', '03.10.2026', 20, 'Самостоятельная', 'active', 'todo', 3],
  ]);
  ensureSheet_(ss, 'exam_questions', [
    'exam_id', 'question_index', 'text', 'option_0', 'option_1', 'option_2', 'option_3', 'correct_index',
  ], [
    [101, 0, 'Сколько будет 12 + 8?', '18', '20', '21', '19', 1],
    [101, 1, 'Choose the correct form: She ___ to school every day.', 'go', 'goes', 'going', 'gone', 1],
    [101, 2, 'Единица силы в SI — это…', 'Джоуль', 'Ньютон', 'Паскаль', 'Ватт', 1],
    [102, 0, 'Сколько будет 12 + 8?', '18', '20', '21', '19', 1],
    [102, 1, 'Choose the correct form: She ___ to school every day.', 'go', 'goes', 'going', 'gone', 1],
    [102, 2, 'Единица силы в SI — это…', 'Джоуль', 'Ньютон', 'Паскаль', 'Ватт', 1],
    [103, 0, 'Сколько будет 12 + 8?', '18', '20', '21', '19', 1],
    [103, 1, 'Choose the correct form: She ___ to school every day.', 'go', 'goes', 'going', 'gone', 1],
    [103, 2, 'Единица силы в SI — это…', 'Джоуль', 'Ньютон', 'Паскаль', 'Ватт', 1],
  ]);
  ensureSheet_(ss, 'class_roster', [
    'class_name', 'student_id', 'full_name', 'status', 'score_percent', 'duration_label', 'exit_intent_count',
  ], [
    ['6Б', 4, 'Алиев Дилшод', 'not_started', '', '', 0],
    ['6Б', 5, 'Karimova Malika', 'submitted', 88, '11:20', 0],
    ['6Б', 6, 'Rustamov Bek', 'submitted', 72, '12:05', 1],
  ]);
  ensureSheet_(ss, 'demo_exam_answers', ['exam_id', 'student_id', 'answers_json'], [
    [101, 5, '[1,1,1]'],
    [101, 6, '[1,0,2]'],
    [102, 5, '[1,1,1]'],
    [102, 6, '[1,1,0]'],
  ]);
  ensureSheet_(ss, 'submissions', [
    'exam_id', 'user_id', 'score_percent', 'correct_count', 'question_total',
    'answers_json', 'exit_intent_count', 'duration_label', 'feedback_json',
  ], []);
  ensureSheet_(ss, 'teacher_reports', ['exam_id'], []);
  SpreadsheetApp.getUi().alert(
    'Листы готовы. Скопируйте WebApp + PortalStyles + PortalScript, затем Развернуть → Веб-приложение (см. SETUP-RU.md).'
  );
}

function ensureSheet_(ss, name, headers, rows) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clear();
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  if (rows && rows.length) {
    // getRange(row, col, numRows, numCols)
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

/** Единая точка входа для фронтенда (google.script.run). */
function apiRoute(token, path, method, bodyJson) {
  path = String(path || '');
  method = String(method || 'GET').toUpperCase();
  var body = {};
  if (bodyJson) {
    try {
      body = JSON.parse(bodyJson);
    } catch (e) {
      body = {};
    }
  }
  if (path === '/api/public/landing' && method === 'GET') {
    return apiPublicLanding();
  }
  if (path === '/api/login' && method === 'POST') {
    return apiLogin(body.login, body.password);
  }
  if (path === '/api/logout' && method === 'POST') {
    return apiLogout(token);
  }
  if (path === '/api/me' && method === 'GET') {
    return apiMe(token);
  }
  if (path === '/api/portal/classes' && method === 'GET') {
    return apiPortalClasses(token);
  }
  if (path === '/api/portal/staff/tests' && method === 'GET') {
    return { tests: staffTestsList_() };
  }
  if (path === '/api/portal/my/subjects' && method === 'GET') {
    return apiPortalMySubjects(token);
  }
  if (path === '/api/portal/my/completed-tests' && method === 'GET') {
    return apiPortalMyCompleted(token);
  }
  var m = path.match(/^\/api\/portal\/class\/([^/]+)\/subjects$/);
  if (m && method === 'GET') {
    return apiPortalClassSubjects(token, decodeURIComponent(m[1]));
  }
  m = path.match(/^\/api\/portal\/class\/([^/]+)\/subjects\/([^/]+)\/tests$/);
  if (m && method === 'GET') {
    return apiPortalClassSubjectTests(token, decodeURIComponent(m[1]), m[2]);
  }
  m = path.match(/^\/api\/portal\/exams\/(\d+)\/admin$/);
  if (m && method === 'GET') {
    return apiPortalExamAdmin(token, Number(m[1]));
  }
  m = path.match(/^\/api\/portal\/exams\/(\d+)\/preview$/);
  if (m && method === 'GET') {
    return apiPortalExamPreview(token, Number(m[1]));
  }
  m = path.match(/^\/api\/portal\/exams\/(\d+)\/submit$/);
  if (m && method === 'POST') {
    return apiPortalExamSubmit(token, Number(m[1]), body);
  }
  m = path.match(/^\/api\/portal\/exams\/(\d+)\/send-teacher-report$/);
  if (m && method === 'POST') {
    return apiPortalSendTeacherReport(token, Number(m[1]));
  }
  throw new Error('not_found');
}

function apiLogin(login, password) {
  login = String(login || '').trim();
  password = String(password || '');
  if (!login || !password) {
    throw new Error('invalid_credentials');
  }
  var users = readUsers_();
  var found = null;
  for (var i = 0; i < users.length; i++) {
    if (users[i].login.toLowerCase() === login.toLowerCase() && users[i].password === password) {
      found = users[i];
      break;
    }
  }
  if (!found) {
    throw new Error('invalid_credentials');
  }
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify(publicUser_(found)), SESSION_TTL_SEC);
  return {
    token: token,
    user: publicUser_(found),
    school_name: getConfig_('school_name') || 'Школа',
  };
}

function apiMe(token) {
  var user = userFromToken_(token);
  if (!user) {
    throw new Error('not_authenticated');
  }
  return {
    user: user,
    school_name: getConfig_('school_name') || 'Школа',
  };
}

function apiLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove('sess_' + token);
  }
  return { status: 'ok' };
}

function apiPublicLanding() {
  return {
    has_schools: true,
    school_name: getConfig_('school_name') || 'Школа',
  };
}

function apiPortalClasses(token) {
  requireStaff_(token);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('classes');
  if (!sheet) {
    return [];
  }
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    out.push({
      class_name: String(data[r][0]),
      student_count: Number(data[r][1]) || 0,
      test_count: Number(data[r][2]) || 0,
    });
  }
  return out;
}

function apiPortalMySubjects(token) {
  var user = requireRole_(token, 'student');
  var cls = user.class_name || '6Б';
  return { class_name: cls, subjects: readSubjects_() };
}

function apiPortalMyCompleted(token) {
  var user = requireRole_(token, 'student');
  var uid = Number(user.id);
  var subs = readSubmissionsForUser_(uid);
  var tests = [];
  for (var i = 0; i < subs.length; i++) {
    var sub = subs[i];
    var ex = getExamById_(sub.exam_id);
    if (!ex) continue;
    tests.push({
      exam_id: sub.exam_id,
      title: ex.title,
      subject_title: ex.subject_title,
      control_date: ex.control_date,
      score_percent: sub.score_percent,
      correct_count: sub.correct_count,
      question_total: sub.question_total,
      duration_label: sub.duration_label || '10:42',
      score_line: sub.score_percent + '%',
    });
  }
  return { tests: tests };
}

function apiPortalClassSubjects(token, className) {
  requireStaff_(token);
  return { subjects: readSubjects_(), class_name: className };
}

function apiPortalClassSubjectTests(token, className, subjectCode) {
  var user = userFromToken_(token);
  if (!user) {
    throw new Error('not_authenticated');
  }
  var subject = null;
  var subjects = readSubjects_();
  for (var i = 0; i < subjects.length; i++) {
    if (subjects[i].code === subjectCode) {
      subject = subjects[i];
      break;
    }
  }
  if (!subject) {
    throw new Error('subject_not_found');
  }
  var tests = testsForClassSubject_(className, subjectCode);
  if (user.role === 'student') {
    var uid = Number(user.id);
    for (var t = 0; t < tests.length; t++) {
      var sub = getSubmission_(tests[t].id, uid);
      tests[t].submitted = sub !== null || tests[t].catalog_key === 'done';
      tests[t].student_label = tests[t].submitted ? 'Сдано' : 'К сдаче';
    }
  }
  return { subject_title: subject.title, tests: tests };
}

function apiPortalExamAdmin(token, examId) {
  requireStaff_(token);
  var ex = getExamById_(examId);
  if (!ex) {
    throw new Error('exam_not_found');
  }
  var students = readRosterForClass_(ex.class_name, examId);
  var submitted = students.filter(function (s) { return s.status === 'submitted'; });
  var analytics = buildQuestionAnalytics_(examId, ex.questions, students);
  return {
    exam: stripQuestions_(ex),
    questions: ex.questions,
    students: students,
    problem_questions: analytics.problem,
    question_stats: analytics.stats,
    submitted_count: submitted.length,
    class_total: students.length || 24,
    all_submitted: submitted.length >= (students.length || 1),
    teacher_report_sent: isTeacherReportSent_(examId),
  };
}

function apiPortalExamPreview(token, examId) {
  var user = userFromToken_(token);
  if (!user) {
    throw new Error('not_authenticated');
  }
  var ex = getExamById_(examId);
  if (!ex) {
    throw new Error('exam_not_found');
  }
  if (user.role === 'admin' || user.role === 'teacher') {
    return {
      exam: stripQuestions_(ex),
      questions: ex.questions,
      show_answers: true,
      submitted: false,
      score_percent: null,
    };
  }
  return studentPreview_(examId, user, ex);
}

function apiPortalExamSubmit(token, examId, body) {
  var user = requireRole_(token, 'student');
  var ex = getExamById_(examId);
  if (!ex) {
    throw new Error('exam_not_found');
  }
  var questions = ex.questions;
  var answers = body.answers || {};
  var correct = 0;
  var feedback = [];
  for (var i = 0; i < questions.length; i++) {
    var selected = Number(answers[String(i)] || 0);
    var ok = selected === questions[i].correct_index;
    if (ok) correct++;
    feedback.push({ selected_index: selected, is_correct: ok });
  }
  var total = questions.length || 1;
  var score = Math.round(100 * correct / total);
  writeSubmission_(examId, Number(user.id), {
    score_percent: score,
    correct_count: correct,
    question_total: total,
    answers: answers,
    exit_intent_count: Number(body.exit_intent_count || 0),
    duration_label: '10:42',
    feedback: feedback,
  });
  return {
    score_percent: score,
    correct_count: correct,
    question_total: total,
    duration_label: '10:42',
  };
}

function apiPortalSendTeacherReport(token, examId) {
  requireStaff_(token);
  var data = apiPortalExamAdmin(token, examId);
  if (!data.all_submitted) {
    throw new Error('not_all_submitted');
  }
  markTeacherReportSent_(examId);
  return { status: 'sent' };
}

function readUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  if (!sheet) {
    return [];
  }
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][1]) continue;
    out.push({
      id: Number(data[r][0]) || r,
      login: String(data[r][1]),
      password: String(data[r][2]),
      role: String(data[r][3] || 'student'),
      full_name: String(data[r][4] || ''),
      class_name: data[r][5] ? String(data[r][5]) : null,
      staff_title: data[r][6] ? String(data[r][6]) : null,
    });
  }
  return out;
}

function getConfig_(key) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('config');
  if (!sheet) return '';
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]) === key) {
      return String(data[r][1] || '');
    }
  }
  return '';
}

function readSubjects_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('subjects');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    out.push({
      code: String(data[r][0]),
      title: String(data[r][1]),
      test_count: Number(data[r][2]) || 0,
    });
  }
  return out;
}

function getExamById_(examId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('exams');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) === Number(examId)) {
      var ex = {
        id: Number(data[r][0]),
        class_name: String(data[r][1]),
        subject_code: String(data[r][2]),
        subject_title: String(data[r][3]),
        title: String(data[r][4]),
        control_date: String(data[r][5]),
        duration_minutes: Number(data[r][6]) || 0,
        kind_label: String(data[r][7]),
        phase: String(data[r][8]),
        catalog_key: String(data[r][9]),
        question_count: Number(data[r][10]) || 0,
        questions: readQuestionsForExam_(examId),
      };
      return ex;
    }
  }
  return null;
}

function readQuestionsForExam_(examId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('exam_questions');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) !== Number(examId)) continue;
    rows.push({
      index: Number(data[r][1]),
      text: String(data[r][2]),
      options: [String(data[r][3]), String(data[r][4]), String(data[r][5]), String(data[r][6])],
      correct_index: Number(data[r][7]) || 0,
    });
  }
  rows.sort(function (a, b) { return a.index - b.index; });
  return rows.map(function (q) {
    return { text: q.text, options: q.options, correct_index: q.correct_index };
  });
}

function stripQuestions_(ex) {
  var copy = {};
  for (var k in ex) {
    if (k !== 'questions') copy[k] = ex[k];
  }
  return copy;
}

function testsForClassSubject_(className, subjectCode) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('exams');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][1]) !== className || String(data[r][2]) !== subjectCode) continue;
    var catalogKey = String(data[r][9]);
    out.push({
      id: Number(data[r][0]),
      title: String(data[r][4]),
      control_date: String(data[r][5]),
      kind_label: String(data[r][7]),
      phase: String(data[r][8]),
      catalog_key: catalogKey,
      duration_minutes: Number(data[r][6]) || 0,
      question_count: Number(data[r][10]) || 0,
      submitted_count: catalogKey === 'done' ? 2 : 0,
      class_total: 24,
    });
  }
  return out;
}

function staffTestsList_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('exams');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    var catalogKey = String(data[r][9]);
    out.push({
      id: Number(data[r][0]),
      class_name: String(data[r][1]),
      subject_code: String(data[r][2]),
      subject_title: String(data[r][3]),
      title: String(data[r][4]),
      control_date: String(data[r][5]),
      kind_label: String(data[r][7]),
      catalog_key: catalogKey,
      question_count: Number(data[r][10]) || 0,
      submitted_count: catalogKey === 'done' ? 2 : 0,
      class_total: 24,
    });
  }
  return out;
}

function readRosterForClass_(className, examId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('class_roster');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0]) !== className) continue;
    var studentId = Number(data[r][1]);
    var sub = getSubmission_(examId, studentId);
    var row = {
      id: studentId,
      full_name: String(data[r][2]),
      status: String(data[r][3]),
      score_percent: data[r][4] === '' ? null : Number(data[r][4]),
      duration_label: data[r][5] ? String(data[r][5]) : undefined,
      exit_intent_count: Number(data[r][6]) || 0,
    };
    if (sub) {
      row.status = 'submitted';
      row.score_percent = sub.score_percent;
      if (sub.duration_label) row.duration_label = sub.duration_label;
      row.exit_intent_count = sub.exit_intent_count || 0;
      if (row.exit_intent_count > 0) {
        row.exit_intent_label = row.exit_intent_count + ' раз';
      }
    }
    out.push(row);
  }
  return out;
}

function getDemoAnswers_(examId, studentId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('demo_exam_answers');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) === Number(examId) && Number(data[r][1]) === Number(studentId)) {
      try {
        return JSON.parse(String(data[r][2]));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

function answersForStudent_(examId, student, questions) {
  var demo = getDemoAnswers_(examId, student.id);
  if (demo) return demo;
  var sub = getSubmission_(examId, student.id);
  if (sub && sub.answers) {
    var picks = [];
    for (var i = 0; i < questions.length; i++) {
      picks.push(Number(sub.answers[String(i)] || 0));
    }
    return picks;
  }
  if (student.status !== 'submitted') return null;
  var total = questions.length || 1;
  var pct = student.score_percent || 0;
  var wrong = Math.max(0, Math.round(total * (100 - pct) / 100));
  var picks = questions.map(function (q) { return q.correct_index; });
  for (var w = 0; w < Math.min(wrong, total); w++) {
    var idx = total - 1 - w;
    picks[idx] = (picks[idx] + 1) % 4;
  }
  return picks;
}

function buildQuestionAnalytics_(examId, questions, students) {
  var submitted = students.filter(function (s) { return s.status === 'submitted'; });
  var submittedTotal = submitted.length;
  var stats = [];
  for (var qi = 0; qi < questions.length; qi++) {
    var failed = 0;
    if (submittedTotal) {
      for (var si = 0; si < submitted.length; si++) {
        var picks = answersForStudent_(examId, submitted[si], questions);
        if (!picks || qi >= picks.length || picks[qi] !== questions[qi].correct_index) {
          failed++;
        }
      }
    }
    var failedPercent = submittedTotal ? Math.round(100 * failed / submittedTotal) : 0;
    stats.push({
      submitted_total: submittedTotal,
      failed_count: failed,
      failed_percent: failedPercent,
    });
  }
  var problem = [];
  if (submittedTotal) {
    for (var pi = 0; pi < stats.length; pi++) {
      if (stats[pi].failed_percent >= PROBLEM_QUESTION_THRESHOLD_PERCENT) {
        problem.push({ index: pi, failed_percent: stats[pi].failed_percent });
      }
    }
    problem.sort(function (a, b) {
      return b.failed_percent - a.failed_percent || a.index - b.index;
    });
  }
  return { stats: stats, problem: problem };
}

function studentPreview_(examId, user, ex) {
  var uid = Number(user.id);
  var sub = getSubmission_(examId, uid);
  var submitted = sub !== null || ex.catalog_key === 'done';
  var score = sub ? sub.score_percent : (ex.catalog_key === 'done' ? 88 : null);
  var feedback = sub ? sub.feedback : null;
  return {
    exam: stripQuestions_(ex),
    questions: ex.questions,
    show_answers: false,
    submitted: submitted,
    score_percent: score,
    feedback: feedback,
  };
}

function getSubmission_(examId, userId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('submissions');
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) === Number(examId) && Number(data[r][1]) === Number(userId)) {
      return {
        exam_id: Number(data[r][0]),
        user_id: Number(data[r][1]),
        score_percent: Number(data[r][2]),
        correct_count: Number(data[r][3]),
        question_total: Number(data[r][4]),
        answers: JSON.parse(String(data[r][5] || '{}')),
        exit_intent_count: Number(data[r][6]) || 0,
        duration_label: String(data[r][7] || ''),
        feedback: JSON.parse(String(data[r][8] || '[]')),
      };
    }
  }
  return null;
}

function readSubmissionsForUser_(userId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('submissions');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][1]) !== Number(userId)) continue;
    out.push({
      exam_id: Number(data[r][0]),
      score_percent: Number(data[r][2]),
      correct_count: Number(data[r][3]),
      question_total: Number(data[r][4]),
      duration_label: String(data[r][7] || ''),
    });
  }
  return out;
}

function writeSubmission_(examId, userId, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('submissions');
  if (!sheet) {
    sheet = ss.insertSheet('submissions');
    sheet.appendRow([
      'exam_id', 'user_id', 'score_percent', 'correct_count', 'question_total',
      'answers_json', 'exit_intent_count', 'duration_label', 'feedback_json',
    ]);
  }
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) === Number(examId) && Number(data[r][1]) === Number(userId)) {
      rowIndex = r + 1;
      break;
    }
  }
  var row = [
    examId,
    userId,
    payload.score_percent,
    payload.correct_count,
    payload.question_total,
    JSON.stringify(payload.answers || {}),
    payload.exit_intent_count || 0,
    payload.duration_label || '10:42',
    JSON.stringify(payload.feedback || []),
  ];
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function isTeacherReportSent_(examId) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('teacher_reports');
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    if (Number(data[r][0]) === Number(examId)) return true;
  }
  return false;
}

function markTeacherReportSent_(examId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('teacher_reports');
  if (!sheet) {
    sheet = ss.insertSheet('teacher_reports');
    sheet.appendRow(['exam_id']);
  }
  if (!isTeacherReportSent_(examId)) {
    sheet.appendRow([examId]);
  }
}

function publicUser_(row) {
  return {
    id: row.id,
    login: row.login,
    full_name: row.full_name,
    role: row.role,
    class_name: row.class_name,
    staff_title: row.staff_title || null,
  };
}

function userFromToken_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function requireStaff_(token) {
  var user = userFromToken_(token);
  if (!user) throw new Error('not_authenticated');
  if (user.role !== 'admin' && user.role !== 'teacher') throw new Error('forbidden');
  return user;
}

function requireRole_(token, role) {
  var user = userFromToken_(token);
  if (!user) throw new Error('not_authenticated');
  if (user.role !== role) throw new Error('forbidden');
  return user;
}
