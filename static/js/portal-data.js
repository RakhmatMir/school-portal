/** Данные портала с GitHub (data/portal.json) + сдачи в localStorage. */

const PROBLEM_THRESHOLD = 40;
const SUBMISSIONS_KEY = "portal_site_submissions_v1";
const TEACHER_REPORTS_KEY = "portal_site_teacher_reports_v1";
const DEMO_SESSION_KEY = "portal_demo_session_v1";

let bundlePromise = null;

function dataBasePath() {
  return String(window.PORTAL_DATA_BASE || "data").replace(/\/$/, "");
}

export async function loadPortalBundle() {
  if (!bundlePromise) {
    const url = `${dataBasePath()}/portal.json`;
    bundlePromise = fetch(url, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error("portal_data_load_failed");
      return res.json();
    });
  }
  return bundlePromise;
}

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSubmissions(map) {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(map));
}

function submissionKey(examId, userId) {
  return `${examId}:${userId}`;
}

function getSubmission(map, examId, userId) {
  return map[submissionKey(examId, userId)] || null;
}

function loadTeacherReports() {
  try {
    const raw = localStorage.getItem(TEACHER_REPORTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveTeacherReports(set) {
  localStorage.setItem(TEACHER_REPORTS_KEY, JSON.stringify([...set]));
}

function examById(bundle, examId) {
  return bundle.exams.find((e) => Number(e.id) === Number(examId)) || null;
}

function stripQuestions(ex) {
  const { questions, ...rest } = ex;
  return rest;
}

function testsForClassSubject(bundle, className, subjectCode) {
  return bundle.exams
    .filter((ex) => ex.class_name === className && ex.subject_code === subjectCode)
    .map((ex) => ({
      id: ex.id,
      title: ex.title,
      control_date: ex.control_date,
      kind_label: ex.kind_label,
      phase: ex.phase,
      catalog_key: ex.catalog_key,
      duration_minutes: ex.duration_minutes,
      question_count: ex.question_count,
      submitted_count: ex.catalog_key === "done" ? 2 : 0,
      class_total: 24,
    }));
}

function staffTestsList(bundle) {
  return bundle.exams.map((ex) => ({
    id: ex.id,
    class_name: ex.class_name,
    subject_code: ex.subject_code,
    subject_title: ex.subject_title,
    title: ex.title,
    control_date: ex.control_date,
    kind_label: ex.kind_label,
    catalog_key: ex.catalog_key,
    question_count: ex.question_count,
    submitted_count: ex.catalog_key === "done" ? 2 : 0,
    class_total: 24,
  }));
}

function rosterForClass(bundle, className, examId, submissions) {
  const base = bundle.rosters[className] || [];
  return base.map((row) => {
    const sub = getSubmission(submissions, examId, row.id);
    const out = { ...row };
    if (sub) {
      out.status = "submitted";
      out.score_percent = sub.score_percent;
      out.duration_label = sub.duration_label || out.duration_label;
      out.exit_intent_count = sub.exit_intent_count || 0;
      if (out.exit_intent_count > 0) {
        out.exit_intent_label = `${out.exit_intent_count} раз`;
      }
    }
    return out;
  });
}

function demoAnswers(bundle, examId, studentId) {
  const key = `${examId}:${studentId}`;
  return bundle.demo_exam_answers?.[key] || null;
}

function answersForStudent(bundle, examId, student, questions, submissions) {
  const demo = demoAnswers(bundle, examId, student.id);
  if (demo) return demo;
  const sub = getSubmission(submissions, examId, student.id);
  if (sub?.answers) {
    return questions.map((_, i) => Number(sub.answers[String(i)] ?? 0));
  }
  if (student.status !== "submitted") return null;
  const total = questions.length || 1;
  const pct = student.score_percent || 0;
  const wrong = Math.max(0, Math.round((total * (100 - pct)) / 100));
  const picks = questions.map((q) => q.correct_index);
  for (let w = 0; w < Math.min(wrong, total); w++) {
    const idx = total - 1 - w;
    picks[idx] = (picks[idx] + 1) % 4;
  }
  return picks;
}

function formatSecondsLabel(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes) return `${minutes}:${String(seconds).padStart(2, "0")}`;
  return `${seconds} с`;
}

function parseDurationLabelToSeconds(label) {
  if (label == null || label === "") return null;
  const raw = String(label).trim();
  const clock = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return null;
}

function demoQuestionTimes(bundle, examId, studentId) {
  const key = `${examId}:${studentId}`;
  const arr = bundle.demo_question_times?.[key];
  return Array.isArray(arr) ? arr.map((n) => Number(n)) : null;
}

function questionTimesForStudent(bundle, examId, student, questions, submissions) {
  const sub = getSubmission(submissions, examId, student.id);
  if (sub?.question_times?.length) {
    return sub.question_times.map((n) => Number(n));
  }
  const demo = demoQuestionTimes(bundle, examId, student.id);
  if (demo?.length) return demo;
  const totalSec = parseDurationLabelToSeconds(student.duration_label);
  if (totalSec == null || !questions.length) return null;
  const per = Math.max(30, Math.round(totalSec / questions.length));
  return questions.map((_, qi) => per + (qi === questions.length - 1 ? Math.round(per * 0.25) : 0));
}

function buildAnalytics(bundle, examId, questions, students, submissions) {
  const submitted = students.filter((s) => s.status === "submitted");
  const submittedTotal = submitted.length;
  const stats = questions.map((q, qi) => {
    let failed = 0;
    const times = [];
    if (submittedTotal) {
      for (const st of submitted) {
        const picks = answersForStudent(bundle, examId, st, questions, submissions);
        if (!picks || qi >= picks.length || picks[qi] !== q.correct_index) failed++;
        const qt = questionTimesForStudent(bundle, examId, st, questions, submissions);
        if (qt && qt[qi] != null && qt[qi] >= 0) times.push(qt[qi]);
      }
    }
    const failedPercent = submittedTotal ? Math.round((100 * failed) / submittedTotal) : 0;
    const avgTimeSec = times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null;
    return {
      submitted_total: submittedTotal,
      failed_count: failed,
      failed_percent: failedPercent,
      avg_time_seconds: avgTimeSec,
      avg_time_label: avgTimeSec != null ? formatSecondsLabel(avgTimeSec) : null,
      timed_count: times.length,
    };
  });
  const problem = [];
  if (submittedTotal) {
    stats.forEach((st, index) => {
      if (st.failed_percent >= PROBLEM_THRESHOLD) {
        problem.push({
          index,
          failed_percent: st.failed_percent,
          avg_time_label: st.avg_time_label,
        });
      }
    });
    problem.sort((a, b) => b.failed_percent - a.failed_percent || a.index - b.index);
  }
  return { stats, problem };
}

function parseBody(options) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function publicUser(row) {
  return {
    id: row.id,
    login: row.login,
    full_name: row.full_name,
    role: row.role,
    class_name: row.class_name ?? null,
    staff_title: row.staff_title ?? null,
  };
}

/** Демо-вход из portal.json. Пароли открыты — только для показа. */
export async function demoAuthApi(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const bundle = await loadPortalBundle();

  if (path === "/api/login" && method === "POST") {
    const body = parseBody(options);
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    const users = bundle.demo_users || [];
    const found = users.find(
      (u) => u.login.toLowerCase() === login.toLowerCase() && u.password === password
    );
    if (!found) throw new Error("invalid_credentials");
    const session = { user: publicUser(found), school_name: bundle.school_name };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  if (path === "/api/me" && method === "GET") {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) throw new Error("not_authenticated");
    return JSON.parse(raw);
  }

  if (path === "/api/logout" && method === "POST") {
    localStorage.removeItem(DEMO_SESSION_KEY);
    return { status: "ok" };
  }

  throw new Error("not_found");
}

function currentUser() {
  const session = window.portalState?.session;
  return session?.user || null;
}

export async function dataApi(path, options = {}) {
  const bundle = await loadPortalBundle();
  const method = String(options.method || "GET").toUpperCase();
  const user = currentUser();
  const submissions = loadSubmissions();
  const teacherReports = loadTeacherReports();

  if (path === "/api/public/landing" && method === "GET") {
    return { has_schools: true, school_name: bundle.school_name };
  }

  if (path === "/api/portal/classes" && method === "GET") {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) throw new Error("forbidden");
    return bundle.classes;
  }

  if (path === "/api/portal/staff/tests" && method === "GET") {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) throw new Error("forbidden");
    return { tests: staffTestsList(bundle) };
  }

  if (path === "/api/portal/my/subjects" && method === "GET") {
    if (!user || user.role !== "student") throw new Error("forbidden");
    const cls = user.class_name || "6Б";
    return { class_name: cls, subjects: bundle.subjects };
  }

  if (path === "/api/portal/my/completed-tests" && method === "GET") {
    if (!user || user.role !== "student") throw new Error("forbidden");
    const tests = [];
    for (const [key, sub] of Object.entries(submissions)) {
      if (!key.endsWith(`:${user.id}`)) continue;
      const examId = Number(key.split(":")[0]);
      const ex = examById(bundle, examId);
      if (!ex) continue;
      tests.push({
        exam_id: examId,
        title: ex.title,
        subject_title: ex.subject_title,
        control_date: ex.control_date,
        score_percent: sub.score_percent,
        correct_count: sub.correct_count,
        question_total: sub.question_total,
        duration_label: sub.duration_label || "10:42",
        score_line: `${sub.score_percent}%`,
      });
    }
    return { tests };
  }

  let m = path.match(/^\/api\/portal\/class\/([^/]+)\/subjects$/);
  if (m && method === "GET") {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) throw new Error("forbidden");
    return { subjects: bundle.subjects, class_name: decodeURIComponent(m[1]) };
  }

  m = path.match(/^\/api\/portal\/class\/([^/]+)\/subjects\/([^/]+)\/tests$/);
  if (m && method === "GET") {
    if (!user) throw new Error("not_authenticated");
    const cls = decodeURIComponent(m[1]);
    const code = m[2];
    const subject = bundle.subjects.find((s) => s.code === code);
    if (!subject) throw new Error("subject_not_found");
    const tests = testsForClassSubject(bundle, cls, code);
    if (user.role === "student") {
      for (const t of tests) {
        const sub = getSubmission(submissions, t.id, user.id);
        t.submitted = sub !== null || t.catalog_key === "done";
        t.student_label = t.submitted ? "Сдано" : "К сдаче";
      }
    }
    return { subject_title: subject.title, tests };
  }

  m = path.match(/^\/api\/portal\/exams\/(\d+)\/admin$/);
  if (m && method === "GET") {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) throw new Error("forbidden");
    const examId = Number(m[1]);
    const ex = examById(bundle, examId);
    if (!ex) throw new Error("exam_not_found");
    const students = rosterForClass(bundle, ex.class_name, examId, submissions);
    const submitted = students.filter((s) => s.status === "submitted");
    const { stats, problem } = buildAnalytics(bundle, examId, ex.questions, students, submissions);
    return {
      exam: stripQuestions(ex),
      questions: ex.questions,
      students,
      problem_questions: problem,
      question_stats: stats,
      submitted_count: submitted.length,
      class_total: students.length || 24,
      all_submitted: submitted.length >= (students.length || 1),
      teacher_report_sent: teacherReports.has(examId),
    };
  }

  m = path.match(/^\/api\/portal\/exams\/(\d+)\/preview$/);
  if (m && method === "GET") {
    if (!user) throw new Error("not_authenticated");
    const examId = Number(m[1]);
    const ex = examById(bundle, examId);
    if (!ex) throw new Error("exam_not_found");
    if (user.role === "admin" || user.role === "teacher") {
      return {
        exam: stripQuestions(ex),
        questions: ex.questions,
        show_answers: true,
        submitted: false,
        score_percent: null,
      };
    }
    const sub = getSubmission(submissions, examId, user.id);
    const submitted = sub !== null || ex.catalog_key === "done";
    const score = sub ? sub.score_percent : ex.catalog_key === "done" ? 88 : null;
    return {
      exam: stripQuestions(ex),
      questions: ex.questions,
      show_answers: false,
      submitted,
      score_percent: score,
      feedback: sub?.feedback || null,
    };
  }

  m = path.match(/^\/api\/portal\/exams\/(\d+)\/submit$/);
  if (m && method === "POST") {
    if (!user || user.role !== "student") throw new Error("forbidden");
    const examId = Number(m[1]);
    const ex = examById(bundle, examId);
    if (!ex) throw new Error("exam_not_found");
    const body = parseBody(options);
    const answers = body.answers || {};
    let correct = 0;
    const feedback = ex.questions.map((q, i) => {
      const selected = Number(answers[String(i)] ?? 0);
      const ok = selected === q.correct_index;
      if (ok) correct++;
      return { selected_index: selected, is_correct: ok };
    });
    const total = ex.questions.length || 1;
    const score = Math.round((100 * correct) / total);
    const questionTimes = Array.isArray(body.question_times)
      ? body.question_times.map((n) => Math.max(0, Math.round(Number(n) || 0)))
      : [];
    while (questionTimes.length < total) questionTimes.push(0);
    const durationSec = questionTimes.reduce((a, b) => a + b, 0);
    const durationLabel = durationSec > 0 ? formatSecondsLabel(durationSec) : "10:42";
    const map = loadSubmissions();
    map[submissionKey(examId, user.id)] = {
      score_percent: score,
      correct_count: correct,
      question_total: total,
      answers,
      question_times: questionTimes.slice(0, total),
      exit_intent_count: Number(body.exit_intent_count || 0),
      duration_label: durationLabel,
      feedback,
    };
    saveSubmissions(map);
    return {
      score_percent: score,
      correct_count: correct,
      question_total: total,
      duration_label: durationLabel,
    };
  }

  m = path.match(/^\/api\/portal\/exams\/(\d+)\/send-teacher-report$/);
  if (m && method === "POST") {
    if (!user || (user.role !== "admin" && user.role !== "teacher")) throw new Error("forbidden");
    const examId = Number(m[1]);
    const admin = await dataApi(`/api/portal/exams/${examId}/admin`, { method: "GET" });
    if (!admin.all_submitted) throw new Error("not_all_submitted");
    const reports = loadTeacherReports();
    reports.add(examId);
    saveTeacherReports(reports);
    return { status: "sent" };
  }

  throw new Error("not_found");
}
