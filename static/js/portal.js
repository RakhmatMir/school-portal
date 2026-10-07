import { dataApi, demoAuthApi } from "./portal-data.js?v=83";

const $ = (id) => document.getElementById(id);

const ROLE_LABEL = {
  admin: "Администратор",
  student: "Ученик",
};

const THEME_KEY = "portal_theme";

/** Временно: ученик заходит в тест без «Старт» администратора (для проверки прохождения). */
const PORTAL_SKIP_TEACHER_START = true;

/** Временно: панель «Старт теста» на экране контрольной у администратора. */
const SHOW_EXAM_SESSION_PANEL = false;

/** Временно: блок «Тест: как видит ученик» на экране контрольной. */
const SHOW_STUDENT_PREVIEW_PANEL = false;

const portalState = {
  session: null,
  adminView: "home",
  className: null,
  subjectCode: null,
  subjectTitle: null,
  examId: null,
  examTitle: null,
  examAnswers: {},
  examRunStep: {},
  examQuestionTimes: {},
  examTimerId: null,
  highlightResultExamId: null,
  examExitIntents: {},
  openExamAsReview: false,
  studentExamReturnHome: false,
  staffTestsShortcut: false,
  /** Не открывать единственный тест сразу (кнопка «Назад» / крошки). */
  suppressSingleExamAutoload: false,
  studentBundleMode: false,
};
window.portalState = portalState;

const AUTH_API_PATHS = new Set(["/api/login", "/api/logout", "/api/me"]);

const NOTIFY_RECIPIENTS_KEY = "portal_demo_notify_v2";
const NOTIFY_RECIPIENTS_MAX = 4;
function isNotifyRecipientsPanelOpen() {
  return false;
}

function setNotifyRecipientsPanelOpen(_open) {
  /* collapsed by default on each visit; stays open only until reload via <details> toggle */
}
const EXAM_SESSION_KEY = "portal_demo_exam_sessions_v1";

function normalizeNotifyContact(value) {
  return String(value || "").trim();
}

function loadNotifyRecipients() {
  try {
    const raw = localStorage.getItem(NOTIFY_RECIPIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && (!parsed.length || typeof parsed[0] === "string")) {
        return parsed.map(normalizeNotifyContact).filter(Boolean).slice(0, NOTIFY_RECIPIENTS_MAX);
      }
    }
    const legacyRaw = localStorage.getItem("portal_demo_notify_v1");
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (Array.isArray(legacy)) {
        const out = [];
        for (const row of legacy) {
          const tg = normalizeNotifyContact(row?.telegram);
          const em = normalizeNotifyContact(row?.email);
          if (tg) out.push(tg);
          else if (em) out.push(em);
        }
        const migrated = out.slice(0, NOTIFY_RECIPIENTS_MAX);
        saveNotifyRecipients(migrated);
        return migrated;
      }
    }
    return [];
  } catch {
    return [];
  }
}

function saveNotifyRecipients(contacts) {
  const list = contacts.map(normalizeNotifyContact).filter(Boolean).slice(0, NOTIFY_RECIPIENTS_MAX);
  localStorage.setItem(NOTIFY_RECIPIENTS_KEY, JSON.stringify(list));
  return list;
}

function notifyContactKind(contact) {
  return contact.includes("@") ? "Email" : "Telegram";
}

function loadAllExamSessions() {
  try {
    const raw = localStorage.getItem(EXAM_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllExamSessions(map) {
  localStorage.setItem(EXAM_SESSION_KEY, JSON.stringify(map));
}

function getExamSession(examId) {
  const all = loadAllExamSessions();
  const key = String(examId);
  if (!all[key]) {
    all[key] = { autoStart: false, started: false, ready: {} };
  }
  return all[key];
}

function updateExamSession(examId, patch) {
  const all = loadAllExamSessions();
  const key = String(examId);
  const cur = all[key] || { autoStart: false, started: false, ready: {} };
  all[key] = { ...cur, ...patch };
  saveAllExamSessions(all);
  return all[key];
}

function countReadyStudents(session, totalStudents) {
  const ready = session.ready || {};
  const n = Object.values(ready).filter(Boolean).length;
  return Math.min(n, totalStudents || n);
}

function renderNotifyRecipientsPanel(expanded = isNotifyRecipientsPanelOpen()) {
  const contacts = loadNotifyRecipients();
  const listHtml = contacts.length
    ? `<ul class="notify-list">${contacts
        .map(
          (contact, idx) => `<li class="notify-item">
        <span class="notify-item-kind">${escapeHtml(notifyContactKind(contact))}</span>
        <span class="notify-item-value">${escapeHtml(contact)}</span>
        <button type="button" class="btn-ghost btn-notify-remove" data-idx="${idx}" aria-label="Удалить получателя">×</button>
      </li>`
        )
        .join("")}</ul>`
    : `<p class="muted notify-empty">Получателей пока нет — добавьте Telegram ID или email ниже.</p>`;
  const atMax = contacts.length >= NOTIFY_RECIPIENTS_MAX;
  const openClass = expanded ? " is-open" : "";
  const summaryCount =
    contacts.length > 0
      ? `<span class="muted notify-summary-count">${contacts.length} из ${NOTIFY_RECIPIENTS_MAX}</span>`
      : "";
  return `<div class="panel panel-demo panel-notify" id="panel-notify">
    <div class="notify-disclosure${openClass}">
      <button type="button" class="notify-summary" id="btn-notify-toggle" aria-expanded="${expanded ? "true" : "false"}" aria-controls="notify-panel-body">
        <span class="notify-summary-row">
          <span class="notify-summary-title">Уведомления о сдаче</span>
          <span class="tag tag-demo">Демо</span>
          ${summaryCount}
          <span class="notify-chevron" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </span>
      </button>
      <div class="notify-body" id="notify-panel-body">
        <div class="notify-body-inner">
          <p class="lead muted">До ${NOTIFY_RECIPIENTS_MAX} получателей — Telegram ID или email в одном поле. Сохраняется в браузере; отправка будет позже.</p>
          ${listHtml}
          <div class="notify-add-row">
            <label class="field notify-add-field">
              <span>Контакт</span>
              <input type="text" class="notify-input" id="notify-input" placeholder="123456789 или teacher@school.uz" autocomplete="off" ${atMax ? "disabled" : ""} />
            </label>
            <button type="button" class="btn-primary btn-notify-add" id="btn-notify-add" ${atMax ? "disabled" : ""}>Добавить</button>
          </div>
          <p class="muted notify-counter">Добавлено ${contacts.length} из ${NOTIFY_RECIPIENTS_MAX}</p>
          <p class="demo-save-hint muted" id="notify-save-hint" hidden>Сохранено локально (демо)</p>
        </div>
      </div>
    </div>
  </div>`;
}

function bindNotifyRecipients(root) {
  if (!root.querySelector("#panel-notify")) return;

  const refresh = () => {
    const main = $("app-main");
    const panelEl = main?.querySelector("#panel-notify");
    const scrollY = window.scrollY;
    const hadFocus = document.activeElement?.id === "notify-input";
    const wasOpen =
      panelEl?.querySelector(".notify-disclosure")?.classList.contains("is-open") ??
      isNotifyRecipientsPanelOpen();
    if (!panelEl?.parentElement) return;
    const next = document.createElement("div");
    next.innerHTML = renderNotifyRecipientsPanel(wasOpen);
    const newPanel = next.firstElementChild;
    panelEl.parentElement.replaceChild(newPanel, panelEl);
    bindNotifyRecipients(main);
    if (hadFocus) main.querySelector("#notify-input")?.focus();
    window.scrollTo(0, scrollY);
  };

  const showHint = () => {
    const saveHint = root.querySelector("#notify-save-hint");
    if (!saveHint) return;
    saveHint.hidden = false;
    window.clearTimeout(bindNotifyRecipients._hintTimer);
    bindNotifyRecipients._hintTimer = window.setTimeout(() => {
      saveHint.hidden = true;
    }, 2200);
  };

  const disclosure = root.querySelector(".notify-disclosure");
  const toggleBtn = root.querySelector("#btn-notify-toggle");
  const notifyBody = root.querySelector("#notify-panel-body");
  toggleBtn?.addEventListener("click", () => {
    const open = disclosure?.classList.toggle("is-open");
    const isOpen = Boolean(open);
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    setNotifyRecipientsPanelOpen(isOpen);
  });

  const input = root.querySelector("#notify-input");
  const addBtn = root.querySelector("#btn-notify-add");

  const tryAdd = () => {
    const value = normalizeNotifyContact(input?.value);
    if (!value) return;
    const cur = loadNotifyRecipients();
    if (cur.length >= NOTIFY_RECIPIENTS_MAX) return;
    if (cur.some((c) => c.toLowerCase() === value.toLowerCase())) {
      input?.focus();
      return;
    }
    saveNotifyRecipients([...cur, value]);
    showHint();
    refresh();
  };

  addBtn?.addEventListener("click", tryAdd);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryAdd();
    }
  });

  root.querySelectorAll(".btn-notify-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const cur = loadNotifyRecipients();
      if (!Number.isFinite(idx) || idx < 0 || idx >= cur.length) return;
      cur.splice(idx, 1);
      saveNotifyRecipients(cur);
      showHint();
      refresh();
    });
  });
}

function examSessionViewModel(examId, total) {
  const session = getExamSession(examId);
  const readyN = countReadyStudents(session, total);
  const allReady = total > 0 && readyN >= total;
  const started = session.started;
  const autoStart = session.autoStart;
  let statusText = "Ожидание готовности учеников";
  if (started) statusText = "Тест начат — ученики могут проходить";
  else if (autoStart) statusText = "Автостарт включён — нажмите «Старт»";
  else if (allReady) statusText = "Все отметились «Готов» — можно нажать «Старт»";

  const canStart = autoStart || allReady;
  const startDisabled = !started && !canStart;
  const startBtnClass = started ? "btn-secondary exam-start-btn" : "btn-primary exam-start-btn";
  const startBtnLabel = started ? "Отменить" : "Старт теста";
  let sessionHint = "";
  if (!started && autoStart) {
    sessionHint = "Автостарт: «Старт» не ждёт готовности всех. Снимите галочку, чтобы отменить автостарт.";
  } else if (!started && !canStart) {
    sessionHint = `Кнопка «Старт» активна, когда все отметят «Готов» (${readyN}/${total}), или включён автостарт.`;
  } else if (started) {
    sessionHint = "«Отменить» закроет тест для учеников до следующего «Старт» (демо).";
  }
  return {
    readyN,
    total,
    statusText,
    autoStart,
    started,
    startDisabled,
    startBtnClass,
    startBtnLabel,
    sessionHint,
  };
}

function syncExamSessionPanelUI(panel, examId, total) {
  if (!panel) return;
  const vm = examSessionViewModel(examId, total);
  const values = panel.querySelectorAll(".panel-session-metrics .metric-value");
  if (values[0]) values[0].textContent = `${vm.readyN} / ${vm.total}`;
  if (values[1]) values[1].textContent = vm.statusText;
  if (values[2]) values[2].textContent = vm.autoStart ? "вкл." : "выкл.";

  const auto = panel.querySelector(".exam-auto-start");
  if (auto) {
    auto.checked = vm.autoStart;
    auto.disabled = vm.started;
  }

  const btn = panel.querySelector(".exam-start-btn");
  if (btn) {
    btn.disabled = vm.startDisabled;
    btn.textContent = vm.startBtnLabel;
    btn.className = vm.startBtnClass;
  }

  const actions = panel.querySelector(".session-actions");
  let hint = panel.querySelector(".session-hint");
  if (vm.sessionHint) {
    if (!hint && actions) {
      hint = document.createElement("p");
      hint.className = "muted session-hint";
      actions.appendChild(hint);
    }
    if (hint) hint.textContent = vm.sessionHint;
  } else if (hint) {
    hint.remove();
  }
}

function renderExamSessionPanel(ex, students) {
  if (!SHOW_EXAM_SESSION_PANEL) return "";
  const isTodo = ex.catalog_key === "todo";
  if (!isTodo) {
    return `<div class="panel panel-demo panel-session">
      <div class="panel-demo-head"><h3>Старт теста</h3><span class="tag tag-demo">Демо</span></div>
      <p class="muted">Контроль уже завершён — управление стартом доступно для тестов «к сдаче».</p>
    </div>`;
  }
  const total = students.length;
  const vm = examSessionViewModel(ex.id, total);
  return `<div class="panel panel-demo panel-session" data-exam-id="${ex.id}" data-student-total="${total}">
    <div class="panel-demo-head">
      <h3>Старт теста</h3>
      <span class="tag tag-demo">Демо</span>
    </div>
    <p class="lead muted">Ученик сначала нажимает «Я готов», затем администратор запускает тест. До «Старта» вопросы недоступны.</p>
    <div class="panel-session-metrics">${renderMetricColumns([
      { label: "Готовы", value: `${vm.readyN} / ${vm.total}` },
      { label: "Статус", value: vm.statusText },
      { label: "Автостарт", value: vm.autoStart ? "вкл." : "выкл." },
    ])}</div>
    <label class="check-row">
      <input type="checkbox" class="exam-auto-start" ${vm.autoStart ? "checked" : ""} ${vm.started ? "disabled" : ""} />
      <span>Автостарт — не ждать «Готов» от всех (всё равно нужно нажать «Старт»)</span>
    </label>
    <div class="session-actions">
      <button type="button" class="${vm.startBtnClass}" ${vm.startDisabled ? "disabled" : ""}>
        ${vm.startBtnLabel}
      </button>
      ${vm.sessionHint ? `<p class="muted session-hint">${escapeHtml(vm.sessionHint)}</p>` : ""}
    </div>
  </div>`;
}

function bindExamSessionPanel(root, examId, students) {
  const panel = root.querySelector(`.panel-session[data-exam-id="${examId}"]`);
  if (!panel) return;
  const total =
    Number(panel.getAttribute("data-student-total")) || students.length || 0;
  const auto = panel.querySelector(".exam-auto-start");
  const startBtn = panel.querySelector(".exam-start-btn");

  auto?.addEventListener("change", () => {
    const session = getExamSession(examId);
    if (session.started) return;
    updateExamSession(examId, { autoStart: auto.checked });
    syncExamSessionPanelUI(panel, examId, total);
  });

  startBtn?.addEventListener("click", () => {
    const session = getExamSession(examId);
    const readyN = countReadyStudents(session, total);
    if (session.started) {
      updateExamSession(examId, { started: false });
      syncExamSessionPanelUI(panel, examId, total);
      return;
    }
    if (!session.autoStart && readyN < total) return;
    updateExamSession(examId, { started: true });
    syncExamSessionPanelUI(panel, examId, total);
  });
}

function studentExamHeaderMetrics(ex, preview) {
  const cols = [
    { label: "Дата", value: ex.control_date || "—" },
    { label: "Вопросов", value: String(questionCountLabel(ex)) },
    { label: "Лимит", value: `${ex.duration_minutes || 13} мин` },
  ];
  if (preview.submitted) {
    cols.push({ label: "Результат", value: preview.score_percent != null ? `${preview.score_percent}%` : "—" });
    cols.push({ label: "Время", value: preview.duration_label || "—" });
    const exit =
      preview.exit_intent_count > 0
        ? preview.exit_intent_label?.replace(/^Да,\s*/i, "") || String(preview.exit_intent_count)
        : "нет";
    cols.push({ label: "Выход", value: exit });
  } else if (ex.catalog_key === "todo") {
    cols.push({ label: "Статус", value: "К сдаче" });
  } else {
    cols.push({ label: "Статус", value: ex.kind_label || ex.student_label || "—" });
  }
  return cols;
}

function renderStudentFeedbackTable(preview) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const rows = preview.feedback || [];
  return renderDataTable({
    tableClass: "table-student-answers",
    columns: [
      { label: "№", cellClass: "num", render: (row) => String((row.index ?? 0) + 1) },
      {
        label: "Вопрос",
        render: (row) => escapeHtml(row.question || ""),
      },
      {
        label: "Ваш ответ",
        render: (row, idx) => {
          const sel = row.selected_index;
          if (sel == null || sel < 0) return "—";
          const q = preview.questions?.[idx];
          const text = q?.options?.[sel] ?? "";
          const letter = letters[sel] || String(sel + 1);
          return escapeHtml(`${letter}. ${text}`);
        },
      },
      {
        label: "Итог",
        cellClass: "num",
        render: (row) =>
          row.is_correct
            ? `<span class="tag tag-ok">верно</span>`
            : `<span class="tag tag-warn">ошибка</span>`,
      },
    ],
    rows,
  });
}

function studentFeedbackSummary(preview) {
  const rows = preview.feedback || [];
  const correct = rows.filter((r) => r.is_correct).length;
  const total = rows.length || questionCountLabel(preview.exam);
  return { correct, total: rows.length || questionCountLabel(preview.exam), wrong: rows.length - correct };
}

function renderStudentWaitPanel(ex, examId, userId) {
  const session = getExamSession(examId);
  const readyMap = session.ready || {};
  const isReady = Boolean(readyMap[String(userId)]);
  return `<div class="panel panel-exam-head">
      <h3 class="class-detail-title">${escapeHtml(ex.title)}</h3>
      ${renderMetricColumns([
        { label: "Дата", value: ex.control_date || "—" },
        { label: "Вопросов", value: String(questionCountLabel(ex)) },
        { label: "Лимит", value: `${ex.duration_minutes || 13} мин` },
        { label: "Статус", value: "Ожидание старта" },
        { label: "Вы готовы", value: isReady ? "да" : "нет" },
      ])}
    </div>
    <div class="panel panel-wait">
    <div class="wait-box">
      <p class="wait-title">Ожидайте начала</p>
      <p class="muted">Учитель ещё не нажал «Старт». Сначала подтвердите, что вы готовы сдавать тест.</p>
      <button type="button" class="btn-primary btn-student-ready" ${isReady ? "disabled" : ""}>
        ${isReady ? "Вы отметились «Готов»" : "Я готов к сдаче"}
      </button>
      ${
        isReady
          ? `<p class="muted wait-note">Ожидаем остальных учеников и команду администратора…</p>`
          : `<p class="muted wait-note">После нажатия администратор увидит вас в списке готовых.</p>`
      }
    </div>
    </div>`;
}

function bindStudentReady(main, examId, userId) {
  main.querySelector(".btn-student-ready")?.addEventListener("click", () => {
    const session = getExamSession(examId);
    const ready = { ...(session.ready || {}), [String(userId)]: true };
    updateExamSession(examId, { ready });
    renderStudentFlow();
  });
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
  syncThemeIcons();
}

function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

function syncThemeIcons() {
  const isDark = getTheme() === "dark";
  const icon = isDark ? "☀️" : "🌙";
  const label = isDark ? "Светлая тема" : "Тёмная тема";
  for (const id of ["theme-icon-auth", "theme-icon-app"]) {
    const el = $(id);
    if (el) el.textContent = icon;
  }
  for (const id of ["btn-theme-auth", "btn-theme-app"]) {
    const el = $(id);
    if (el) el.title = label;
  }
}

async function loadStudentCompletedTests(fromSubjectsPayload) {
  if (Array.isArray(fromSubjectsPayload?.completed_tests)) {
    return fromSubjectsPayload.completed_tests;
  }
  try {
    const data = await api("/api/portal/my/completed-tests");
    return data.tests || [];
  } catch (err) {
    console.warn("portal: completed tests unavailable", err);
    return [];
  }
}

function useSiteData() {
  return Boolean(location.hostname.endsWith("github.io") || window.PORTAL_USE_STATIC_DATA);
}

async function api(path, options = {}) {
  if (useSiteData()) {
    if (AUTH_API_PATHS.has(path)) {
      return demoAuthApi(path, options);
    }
    return dataApi(path, options);
  }
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail = data?.detail || res.statusText;
    throw new Error(typeof detail === "string" ? detail : "request_failed");
  }
  return data;
}

const SCROLL_TOP_THRESHOLD = 280;
let scrollTopListenerBound = false;

function updateScrollTopButton() {
  const btn = $("btn-scroll-top");
  const app = $("screen-app");
  if (!btn) return;
  if (!app || app.classList.contains("hidden")) {
    btn.classList.remove("is-visible");
    return;
  }
  btn.classList.toggle("is-visible", window.scrollY > SCROLL_TOP_THRESHOLD);
}

function initScrollTopButton() {
  const btn = $("btn-scroll-top");
  if (!btn) return;
  if (!scrollTopListenerBound) {
    scrollTopListenerBound = true;
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", updateScrollTopButton, { passive: true });
  }
  updateScrollTopButton();
}

function showAuth() {
  $("screen-auth").classList.remove("hidden");
  $("screen-app").classList.add("hidden");
  const bc = $("app-breadcrumbs");
  if (bc) bc.innerHTML = "";
  updateScrollTopButton();
}

function showApp() {
  $("screen-auth").classList.add("hidden");
  $("screen-app").classList.remove("hidden");
  updateScrollTopButton();
}

function setAuthError(msg) {
  const el = $("auth-error");
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encPath(s) {
  return encodeURIComponent(s);
}

function phaseLabel(phase) {
  if (phase === "active") return "Открыт";
  if (phase === "upcoming") return "Скоро";
  return "Закрыт";
}

function questionCountLabel(t) {
  const n = Number(t?.question_count);
  return Number.isFinite(n) ? n : 0;
}

function formatDurationLabel(totalSec) {
  const sec = Math.max(0, Math.round(Number(totalSec) || 0));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes && seconds) return `${minutes}:${String(seconds).padStart(2, "0")}`;
  if (minutes) return `${minutes} мин`;
  return `${seconds} с`;
}

function parseDurationLabelToSeconds(label) {
  if (label == null || label === "") return null;
  const raw = String(label).trim();
  const clock = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }
  const minSec = raw.match(/(\d+)\s*мин(?:\s*(\d+)\s*с)?/i);
  if (minSec) {
    return Number(minSec[1]) * 60 + (minSec[2] ? Number(minSec[2]) : 0);
  }
  const onlySec = raw.match(/^(\d+)\s*с$/i);
  if (onlySec) return Number(onlySec[1]);
  return null;
}

function studentDurationSeconds(student) {
  if (Number.isFinite(student.duration_seconds) && student.duration_seconds >= 0) {
    return student.duration_seconds;
  }
  return parseDurationLabelToSeconds(student.duration_label);
}

function analyticsTimingSummary(ex, students) {
  const submitted = students.filter((s) => s.status === "submitted");
  const submittedCount = submitted.length;
  const durations = submitted
    .map((s) => studentDurationSeconds(s))
    .filter((d) => d != null && d >= 0);
  let avgLabel = ex?.avg_duration_label || null;
  let minLabel = null;
  let maxLabel = null;
  if (durations.length) {
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    avgLabel = avgLabel || formatDurationLabel(avg);
    minLabel = formatDurationLabel(Math.min(...durations));
    maxLabel = formatDurationLabel(Math.max(...durations));
  }
  let exitLabel = ex?.exit_intent_summary_label || null;
  const withExit = submitted.filter((s) => Number(s.exit_intent_count) > 0);
  if (!exitLabel && submittedCount) {
    if (!withExit.length) exitLabel = "выход: никто не выходил";
    else if (withExit.length === 1) exitLabel = "выход: 1 ученик";
    else exitLabel = `выход: ${withExit.length} из ${submittedCount} учеников`;
  }
  return {
    submittedCount,
    timedCount: durations.length,
    avgLabel,
    minLabel,
    maxLabel,
    exitLabel,
    withExit,
  };
}

function renderMetricColumns(items) {
  return `<div class="metric-columns">${items
    .map(
      (it) =>
        `<div class="metric-cell"><span class="metric-label">${escapeHtml(it.label)}</span><span class="metric-value">${it.valueHtml != null ? it.valueHtml : escapeHtml(String(it.value ?? "—"))}</span></div>`
    )
    .join("")}</div>`;
}

function problemQuestionRowFields(pq, questionStats) {
  return {
    failed_percent: pq.failed_percent,
    avg_time_label: pq.avg_time_label || questionStats?.avg_time_label,
    question_exit_total:
      pq.question_exit_total ?? questionStats?.question_exit_total ?? 0,
    question_away_total_seconds:
      pq.question_away_total_seconds ?? questionStats?.question_away_total_seconds ?? 0,
  };
}

function renderProblemQuestionExitCell(meta) {
  const n = Number(meta.question_exit_total) || 0;
  if (n <= 0) return `<span class="tag tag-ok">нет</span>`;
  const away = Number(meta.question_away_total_seconds) || 0;
  const countLabel = n === 1 ? "1 раз" : `${n} раз`;
  const awayHtml =
    away > 0
      ? `<span class="cell-away-sub muted">${escapeHtml(formatDurationLabel(away))} вне</span>`
      : "";
  return `<div class="cell-exit-col"><span class="tag tag-warn">${escapeHtml(countLabel)}</span>${awayHtml}</div>`;
}

function renderProblemQuestionsTable(questions, problemRows, questionStats) {
  const head = ["№", "Вопрос", "Ошибок", "На вопросе", "Окно"]
    .map((label) => `<th scope="col">${escapeHtml(label)}</th>`)
    .join("");
  const body = problemRows.length
    ? problemRows
        .map((pq) => {
          const meta = problemQuestionRowFields(pq, questionStats[pq.index]);
          const q = questions[pq.index];
          const qText = escapeHtml(q ? q.text : `Вопрос ${pq.index + 1}`);
          const timeCell = meta.avg_time_label
            ? escapeHtml(meta.avg_time_label)
            : "—";
          return `<tr>
            <td class="num">${pq.index + 1}</td>
            <td class="col-question" title="${qText}">${qText}</td>
            <td class="num"><strong>${meta.failed_percent}%</strong></td>
            <td class="num">${timeCell}</td>
            <td class="num col-exit">${renderProblemQuestionExitCell(meta)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td class="muted" colspan="5">Нет данных</td></tr>`;
  return `<div class="problem-table-wrap">
    <div class="student-table-scroll">
      <table class="data-table table-problems">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}

function renderDataTable({ columns, rows, tableClass = "" }) {
  const head = columns.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join("");
  const body = rows.length
    ? rows
        .map(
          (row, rowIndex) =>
            `<tr>${columns.map((c) => `<td class="${c.cellClass || ""}">${c.render(row, rowIndex)}</td>`).join("")}</tr>`
        )
        .join("")
    : `<tr><td class="muted" colspan="${columns.length}">Нет данных</td></tr>`;
  return `<div class="table-scroll"><table class="data-table ${tableClass}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function examSummaryMetrics(ex, students) {
  const timing = analyticsTimingSummary(ex, students);
  const exitShort =
    timing.withExit.length > 0
      ? `${timing.withExit.length} из ${timing.submittedCount}`
      : "0";
  return {
    timing,
    columns: [
      { label: "Учеников", value: String(students.length) },
      { label: "Сдали", value: String(timing.submittedCount) },
      { label: "Ср. время", value: timing.avgLabel || "—" },
      { label: "Диапазон", value: timing.minLabel && timing.maxLabel ? `${timing.minLabel} – ${timing.maxLabel}` : "—" },
      { label: "Выходили", value: exitShort },
    ],
    headerColumns: [
      { label: "Дата", value: ex.control_date || "—" },
      { label: "Вопросов", value: String(questionCountLabel(ex)) },
      { label: "Лимит", value: `${ex.duration_minutes || 13} мин` },
      { label: "Статус", value: ex.kind_label || "—" },
      { label: "Ср. время", value: timing.avgLabel || "—" },
      { label: "Выходили", value: exitShort },
    ],
  };
}

const STUDENTS_TABLE_PREVIEW = 5;

const STUDENT_TABLE_COLUMNS = [
  {
    label: "Ученик",
    render: (st) => escapeHtml(st.full_name),
  },
  {
    label: "Сдача",
    cellClass: "col-submission",
    render: (st) => {
      if (st.status !== "submitted") {
        return `<span class="muted">${escapeHtml(studentStatusLabel(st))}</span>`;
      }
      if (st.results_pending) {
        return `<span class="tag tag-warn">сдан</span>`;
      }
      const line = studentTableSubmissionLine(st);
      return `<strong class="cell-submission">${escapeHtml(line)}</strong>`;
    },
  },
  {
    label: "Время",
    cellClass: "num",
    render: (st) => {
      if (st.status !== "submitted") return "—";
      const sec = studentDurationSeconds(st);
      return sec != null ? escapeHtml(formatDurationLabel(sec)) : escapeHtml(st.duration_label || "—");
    },
  },
  {
    label: "Выход",
    cellClass: "num",
    render: (st) => {
      if (st.status !== "submitted") return "—";
      const n = Number(st.exit_intent_count) || 0;
      if (n <= 0) return `<span class="tag tag-ok">нет</span>`;
      const label = st.exit_intent_label || `${n}`;
      return `<span class="tag tag-warn">${escapeHtml(label.replace(/^Да,\s*/i, ""))}</span>`;
    },
  },
];

function renderTableBodyRows(columns, rows) {
  if (!rows.length) {
    return `<tr><td class="muted" colspan="${columns.length}">Нет данных</td></tr>`;
  }
  return rows
    .map(
      (row, rowIndex) =>
        `<tr>${columns.map((c) => `<td class="${c.cellClass || ""}">${c.render(row, rowIndex)}</td>`).join("")}</tr>`
    )
    .join("");
}

function renderStudentResultsTable(students) {
  const columns = STUDENT_TABLE_COLUMNS;
  const head = columns.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join("");
  const preview = students.slice(0, STUDENTS_TABLE_PREVIEW);
  const hidden = students.slice(STUDENTS_TABLE_PREVIEW);
  const hiddenCount = hidden.length;
  const toggleBtn =
    hiddenCount > 0
      ? `<button type="button" class="btn-ghost btn-students-expand" aria-expanded="false" data-hidden-count="${hiddenCount}">
      Показать ещё ${hiddenCount} ${hiddenCount === 1 ? "ученика" : "учеников"}
    </button>`
      : "";
  return `<div class="student-table-wrap">
    <div class="student-table-scroll">
      <table class="data-table table-students">
        <thead><tr>${head}</tr></thead>
        <tbody>${renderTableBodyRows(columns, preview)}</tbody>
        ${
          hiddenCount
            ? `<tbody class="student-table-more" hidden>${renderTableBodyRows(columns, hidden)}</tbody>`
            : ""
        }
      </table>
    </div>
    ${toggleBtn}
  </div>`;
}

function bindStudentTableExpand(root) {
  root.querySelectorAll(".btn-students-expand").forEach((btn) => {
    const wrap = btn.closest(".student-table-wrap");
    const more = wrap?.querySelector(".student-table-more");
    if (!more) return;
    const count = Number(btn.getAttribute("data-hidden-count")) || 0;
    btn.addEventListener("click", () => {
      const open = more.hidden;
      more.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open
        ? "Свернуть список"
        : `Показать ещё ${count} ${count === 1 ? "ученика" : "учеников"}`;
    });
  });
}

function avgDurationSuffix(t) {
  if (!t?.avg_duration_label) return "";
  return ` · ср. ${t.avg_duration_label}`;
}

function testListMeta(t) {
  const label = t.kind_label || phaseLabel(t.phase);
  return `${label} · ${questionCountLabel(t)} вопр.${avgDurationSuffix(t)}`;
}

function studentSubmissionLine(st) {
  if (st.status !== "submitted") return studentStatusLabel(st.status);
  const parts = [];
  if (st.score_percent != null) parts.push(`${st.score_percent}%`);
  if (st.duration_label) parts.push(st.duration_label);
  if (st.finish_rank_label) parts.push(st.finish_rank_label);
  return parts.length ? parts.join(" · ") : studentStatusLabel(st.status);
}

/** Таблица учеников: отдельные колонки «Время» и «Выход» — здесь только результат. */
function studentTableSubmissionLine(st) {
  if (st.status !== "submitted") return studentStatusLabel(st);
  if (st.results_pending) return "Сдан";
  if (st.score_line && /^\d+%/.test(String(st.score_line))) {
    return String(st.score_line).split(" · ")[0];
  }
  if (st.score_percent != null) return `${st.score_percent}%`;
  return studentStatusLabel(st.status);
}

function studentAttemptMeta(st) {
  const base = studentSubmissionLine(st);
  if (st.status !== "submitted" || !st.exit_intent_label) return base;
  return `${base} · выход: ${st.exit_intent_label}`;
}

function renderDemoTestPanel(preview, { interactive = false, title = "Как видит ученик", innerOnly = false } = {}) {
  const ex = preview.exam;
  const letters = ["A", "B", "C", "D", "E", "F"];
  const submitted = preview.submitted;
  const score = preview.score_percent;
  const note = preview.show_answers
    ? "Демо для админа: зелёным отмечен правильный ответ."
    : submitted
      ? preview.show_answers
        ? `Вы сдали этот тест · результат ${score ?? "—"}%`
        : "Зелёным — верный ответ, красным — ваша ошибка."
      : ex.catalog_key === "todo"
        ? "Выберите вариант на каждый вопрос и нажмите «Сдать тест» внизу страницы."
        : "Просмотр варианта теста.";

  const questionsHtml = (preview.questions || [])
    .map((q, qi) => {
      const fbRow = preview.feedback?.[qi];
      const opts = (q.options || [])
        .map((opt, oi) => {
          const isAdminCorrect = preview.show_answers && q.correct_index === oi;
          const isStudentPick = submitted && !preview.show_answers && fbRow?.selected_index === oi;
          const isStudentOk = isStudentPick && fbRow?.is_correct;
          const isStudentBad = isStudentPick && !fbRow?.is_correct;
          const cls = [
            "test-demo-opt",
            isAdminCorrect || isStudentOk ? "is-correct" : "",
            isStudentBad ? "is-wrong" : "",
            interactive ? "is-pick" : "",
            isStudentPick ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const letter = letters[oi] || String(oi + 1);
          return `<button type="button" class="${cls}" data-q="${qi}" data-opt="${oi}" ${interactive ? "" : "disabled"}>${letter}. ${escapeHtml(opt)}</button>`;
        })
        .join("");
      return `<div class="test-demo-q"><p><strong>${qi + 1}.</strong> ${escapeHtml(q.text)}</p>${opts}</div>`;
    })
    .join("");

  const inner = `
      <p class="test-demo-note">${escapeHtml(note)}</p>
      <div class="test-demo">
        <div class="test-demo-head">
          <span>${escapeHtml(ex.title)}</span>
          <span class="test-demo-timer">${ex.duration_minutes || 13}:00</span>
        </div>
        <div class="test-demo-body">${questionsHtml || "<p class=\"muted\">Нет вопросов</p>"}</div>
      </div>`;
  if (innerOnly) return inner;
  return `<div class="panel"><h3>${escapeHtml(title)}</h3>${inner}</div>`;
}

function renderCollapsiblePanel({ title, hint, hintHtml, open, bodyHtml }) {
  const openClass = open ? "is-open" : "";
  const hintBlock = hintHtml
    ? `<div class="collapse-hint-row">${hintHtml}</div>`
    : hint
      ? `<span class="collapse-hint">${escapeHtml(hint)}</span>`
      : "";
  return `
    <section class="panel panel-collapse ${openClass}">
      <button type="button" class="collapse-trigger" aria-expanded="${open ? "true" : "false"}">
        <span class="collapse-trigger-text">
          <h3>${escapeHtml(title)}</h3>
          ${hintBlock}
        </span>
        <span class="collapse-chevron" aria-hidden="true">›</span>
      </button>
      <div class="collapse-body"><div class="collapse-body-inner">${bodyHtml}</div></div>
    </section>`;
}

function bindCollapsiblePanels(main) {
  main.querySelectorAll(".panel-collapse .collapse-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".panel-collapse");
      if (!panel) return;
      const next = !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", next);
      btn.setAttribute("aria-expanded", next ? "true" : "false");
    });
  });
}

function bindDemoTestPicks(main, examId = null) {
  if (examId != null) {
    if (!portalState.examAnswers[examId]) portalState.examAnswers[examId] = {};
  }
  main.querySelectorAll(".test-demo-opt.is-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-q");
      const opt = btn.getAttribute("data-opt");
      main.querySelectorAll(`.test-demo-opt.is-pick[data-q="${q}"]`).forEach((b) => {
        b.style.outline = "";
        b.classList.remove("is-selected");
      });
      btn.style.outline = "2px solid var(--accent)";
      btn.classList.add("is-selected");
      if (examId != null && q != null && opt != null) {
        portalState.examAnswers[examId][q] = Number(opt);
      }
    });
  });
}

function stopExamTimer() {
  if (portalState.examTimerId != null) {
    clearInterval(portalState.examTimerId);
    portalState.examTimerId = null;
  }
}

const EXAM_GUARD_REASONS = {
  visibility: "Обнаружено переключение вкладки или сворачивание окна.",
  blur: "Окно теста потеряло фокус (другая программа или окно поверх).",
  fullscreen: "Вы вышли из полноэкранного режима.",
  navigation: "Попытка выйти, сменить тему или открыть другой раздел портала.",
  return: "Вернитесь к тесту — до сдачи другие действия недоступны.",
};

let examGuardHandlers = null;

function isExamGuardActive() {
  return examGuardHandlers != null;
}

/** Блокировка навигации только во время пошагового прохождения, не в просмотре результатов. */
function isStudentTestSessionLocked() {
  return isExamGuardActive() && $("screen-app")?.classList.contains("is-test-active");
}

function getExamExitIntentCount(examId) {
  return Number(portalState.examExitIntents?.[examId]) || 0;
}

function syncExamExitIntentStorage(examId) {
  try {
    const n = getExamExitIntentCount(examId);
    if (n > 0) sessionStorage.setItem(`portal_exam_exit_${examId}`, String(n));
    else sessionStorage.removeItem(`portal_exam_exit_${examId}`);
  } catch {
    /* ignore */
  }
}

function restoreExamExitIntentCount(examId) {
  if (getExamExitIntentCount(examId) > 0) return;
  try {
    const stored = Number(sessionStorage.getItem(`portal_exam_exit_${examId}`));
    if (Number.isFinite(stored) && stored > 0) {
      if (!portalState.examExitIntents) portalState.examExitIntents = {};
      portalState.examExitIntents[examId] = stored;
    }
  } catch {
    /* ignore */
  }
}

function showExamGuardModal(reasonKey, { countLine = true } = {}) {
  const modal = $("exam-guard-modal");
  if (!modal) return;
  const reasonEl = $("exam-guard-reason");
  const countEl = $("exam-guard-count");
  if (reasonEl) {
    reasonEl.textContent = EXAM_GUARD_REASONS[reasonKey] || EXAM_GUARD_REASONS.navigation;
  }
  if (countEl && examGuardHandlers && countLine) {
    const n = getExamExitIntentCount(examGuardHandlers.examId);
    if (n > 0) {
      countEl.hidden = false;
      countEl.textContent = `Зафиксировано отвлечений: ${n}. Учитель увидит это в отчёте.`;
    } else {
      countEl.hidden = true;
    }
  }
  modal.classList.remove("hidden");
  document.body.classList.add("exam-guard-open");
  requestAnimationFrame(() => $("exam-guard-ok")?.focus());
}

function isExamGuardModalOpen() {
  const modal = $("exam-guard-modal");
  return modal != null && !modal.classList.contains("hidden");
}

function hideExamGuardModal() {
  if (!isExamGuardActive()) return;
  $("exam-guard-modal")?.classList.add("hidden");
  document.body.classList.remove("exam-guard-open");
}

function getActiveExamQuestionIndex(examId) {
  if (!$("screen-app")?.classList.contains("is-test-active")) return -1;
  const step = portalState.examRunStep[examId];
  return Number.isFinite(step) ? step : 0;
}

function recordExamDistraction(examId, reasonKey, { showModal = true } = {}) {
  if (!portalState.examExitIntents) portalState.examExitIntents = {};
  portalState.examExitIntents[examId] = getExamExitIntentCount(examId) + 1;
  const qIndex = getActiveExamQuestionIndex(examId);
  const timing = portalState.examQuestionTimes[examId];
  if (timing && qIndex >= 0 && qIndex < timing.seconds.length) {
    if (!timing.exitCounts) timing.exitCounts = timing.seconds.map(() => 0);
    timing.exitCounts[qIndex] = (timing.exitCounts[qIndex] || 0) + 1;
  }
  syncExamExitIntentStorage(examId);
  if (showModal) showExamGuardModal(reasonKey);
}

function stopExamFocusGuard() {
  if (!examGuardHandlers) return;
  const { onVisibility, onBlur, onBeforeUnload, onFullscreen, onPageHide, onKeyDown, onPointerBlock } =
    examGuardHandlers;
  document.removeEventListener("visibilitychange", onVisibility);
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("beforeunload", onBeforeUnload);
  document.removeEventListener("fullscreenchange", onFullscreen);
  window.removeEventListener("pagehide", onPageHide);
  if (onKeyDown) document.removeEventListener("keydown", onKeyDown, true);
  if (onPointerBlock) {
    document.removeEventListener("click", onPointerBlock, true);
    document.removeEventListener("touchstart", onPointerBlock, true);
  }
  examGuardHandlers = null;
  $("exam-guard-modal")?.classList.add("hidden");
  document.body.classList.remove("exam-guard-open");
}

function startExamFocusGuard(examId) {
  stopExamFocusGuard();
  restoreExamExitIntentCount(examId);
  let blurTimer = null;
  const examIdLocal = examId;

  const onVisibility = () => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (document.visibilityState === "hidden") {
      pauseExamQuestionTimer(examIdLocal);
      examGuardHandlers.awaySince = Date.now();
      recordExamDistraction(examIdLocal, "visibility");
    } else {
      if (examGuardHandlers.awaySince) {
        addExamQuestionAwaySeconds(examIdLocal, examGuardHandlers.awaySince);
        examGuardHandlers.awaySince = null;
      }
      resumeExamQuestionTimer(examIdLocal);
      showExamGuardModal("return", { countLine: true });
    }
  };

  const onBlur = () => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (document.visibilityState !== "visible") return;
    clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => {
      if (!examGuardHandlers || document.visibilityState !== "visible") return;
      if ($("exam-guard-modal") && !$("exam-guard-modal").classList.contains("hidden")) return;
      recordExamDistraction(examIdLocal, "blur");
    }, 120);
  };

  const onBeforeUnload = (e) => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (!portalState.examExitIntents) portalState.examExitIntents = {};
    portalState.examExitIntents[examIdLocal] = getExamExitIntentCount(examIdLocal) + 1;
    syncExamExitIntentStorage(examIdLocal);
    e.preventDefault();
    e.returnValue = "";
  };

  const onFullscreen = () => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (!document.fullscreenElement) recordExamDistraction(examIdLocal, "fullscreen");
  };

  const onPageHide = () => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (!portalState.examExitIntents) portalState.examExitIntents = {};
    portalState.examExitIntents[examIdLocal] = getExamExitIntentCount(examIdLocal) + 1;
    syncExamExitIntentStorage(examIdLocal);
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("fullscreenchange", onFullscreen);
  window.addEventListener("pagehide", onPageHide);

  const onKeyDown = (e) => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (!isExamGuardModalOpen()) recordExamDistraction(examIdLocal, "navigation");
      else showExamGuardModal("navigation", { countLine: true });
    }
  };

  const onPointerBlock = (e) => {
    if (!examGuardHandlers || examGuardHandlers.examId !== examIdLocal) return;
    if (!isExamGuardModalOpen()) return;
    const modal = $("exam-guard-modal");
    const dialog = modal?.querySelector(".exam-guard-dialog");
    if (dialog && e.target instanceof Node && dialog.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("click", onPointerBlock, true);
  document.addEventListener("touchstart", onPointerBlock, true);

  examGuardHandlers = {
    examId: examIdLocal,
    onVisibility,
    onBlur,
    onBeforeUnload,
    onFullscreen,
    onPageHide,
    onKeyDown,
    onPointerBlock,
  };
}

function blockActionIfExamActive() {
  if (!isStudentTestSessionLocked()) return false;
  if (isExamGuardModalOpen()) return true;
  recordExamDistraction(examGuardHandlers.examId, "navigation");
  return true;
}

function studentExamBackLabel() {
  return portalState.studentExamReturnHome || !portalState.subjectCode ? "← На главную" : "← К тестам";
}

function navigateBackFromStudentExam(examMeta) {
  if (blockActionIfExamActive()) return;
  setTestTakingActive(false);
  if (portalState.studentExamReturnHome) {
    portalState.studentExamReturnHome = false;
    portalState.adminView = "home";
    portalState.examId = null;
    portalState.examTitle = null;
    renderStudentFlow();
    return;
  }
  const code = examMeta?.subject_code || portalState.subjectCode;
  if (code) {
    portalState.subjectCode = code;
    portalState.adminView = "subject";
  } else {
    portalState.adminView = "home";
    portalState.subjectCode = null;
  }
  portalState.examId = null;
  portalState.examTitle = null;
  renderStudentFlow();
}

function setTestTakingActive(active, examId = null) {
  $("screen-app")?.classList.toggle("is-test-active", active);
  if (active && examId != null) {
    startExamFocusGuard(examId);
  } else if (!active) {
    stopExamFocusGuard();
  }
}

function formatTimerMs(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getExamDeadlineMs(examId, durationMinutes) {
  const key = `portal_exam_deadline_${examId}`;
  const stored = Number(sessionStorage.getItem(key));
  const fullMs = (durationMinutes || 13) * 60 * 1000;
  if (Number.isFinite(stored) && stored > Date.now()) return stored;
  const end = Date.now() + fullMs;
  sessionStorage.setItem(key, String(end));
  return end;
}

function clearExamDeadline(examId) {
  sessionStorage.removeItem(`portal_exam_deadline_${examId}`);
}

function ensureExamQuestionTiming(examId, questionCount) {
  if (!portalState.examQuestionTimes[examId]) {
    portalState.examQuestionTimes[examId] = {
      stepStartedAt: Date.now(),
      seconds: Array.from({ length: questionCount }, () => 0),
      awaySeconds: Array.from({ length: questionCount }, () => 0),
      exitCounts: Array.from({ length: questionCount }, () => 0),
    };
  }
  return portalState.examQuestionTimes[examId];
}

function flushExamQuestionTimerSlice(examId) {
  const timing = portalState.examQuestionTimes[examId];
  if (!timing || timing.stepStartedAt == null) return;
  const qIndex = getActiveExamQuestionIndex(examId);
  if (qIndex < 0 || qIndex >= timing.seconds.length) return;
  const spent = Math.max(0, Math.round((Date.now() - timing.stepStartedAt) / 1000));
  if (spent > 0) timing.seconds[qIndex] = (timing.seconds[qIndex] || 0) + spent;
  timing.stepStartedAt = Date.now();
}

function pauseExamQuestionTimer(examId) {
  const timing = portalState.examQuestionTimes[examId];
  if (!timing || timing.stepStartedAt == null) return;
  flushExamQuestionTimerSlice(examId);
  timing.stepStartedAt = null;
}

function resumeExamQuestionTimer(examId) {
  const timing = portalState.examQuestionTimes[examId];
  if (!timing || timing.stepStartedAt != null) return;
  timing.stepStartedAt = Date.now();
}

function addExamQuestionAwaySeconds(examId, awaySinceMs) {
  const timing = portalState.examQuestionTimes[examId];
  const qIndex = getActiveExamQuestionIndex(examId);
  if (!timing || qIndex < 0 || !awaySinceMs) return;
  const sec = Math.max(1, Math.round((Date.now() - awaySinceMs) / 1000));
  if (!timing.awaySeconds) timing.awaySeconds = timing.seconds.map(() => 0);
  timing.awaySeconds[qIndex] = (timing.awaySeconds[qIndex] || 0) + sec;
}

function recordQuestionStepTime(examId, stepIndex, questionCount) {
  const timing = portalState.examQuestionTimes[examId];
  if (!timing || stepIndex < 0 || stepIndex >= questionCount) return;
  if (timing.stepStartedAt != null) {
    const spent = Math.max(1, Math.round((Date.now() - timing.stepStartedAt) / 1000));
    timing.seconds[stepIndex] = (timing.seconds[stepIndex] || 0) + spent;
  }
  timing.stepStartedAt = Date.now();
}

async function submitStudentExam(examId, questionCount) {
  const answers = { ...(portalState.examAnswers[examId] || {}) };
  for (let i = 0; i < questionCount; i++) {
    if (answers[String(i)] === undefined) answers[String(i)] = 0;
  }
  const exitCount = getExamExitIntentCount(examId);
  const timing = portalState.examQuestionTimes[examId];
  flushExamQuestionTimerSlice(examId);
  const questionTimes = timing?.seconds?.slice(0, questionCount) || [];
  const questionAwaySeconds = timing?.awaySeconds?.slice(0, questionCount) || [];
  const questionExitCounts = timing?.exitCounts?.slice(0, questionCount) || [];
  const result = await api(`/api/portal/exams/${examId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      answers,
      exit_intent_count: exitCount,
      question_times: questionTimes,
      question_away_seconds: questionAwaySeconds,
      question_exit_counts: questionExitCounts,
    }),
  });
  stopExamTimer();
  clearExamDeadline(examId);
  delete portalState.examAnswers[examId];
  delete portalState.examRunStep[examId];
  delete portalState.examQuestionTimes[examId];
  if (portalState.examExitIntents) delete portalState.examExitIntents[examId];
  try {
    sessionStorage.removeItem(`portal_exam_exit_${examId}`);
  } catch {
    /* ignore */
  }
  setTestTakingActive(false);
  portalState.highlightResultExamId = examId;
  return result;
}

function renderStudentResultCard(t, { orderIndex, total, highlight }) {
  const openClass = highlight ? " is-open" : "";
  const hl = highlight ? " student-result-card--highlight" : "";
  const subject = escapeHtml(t.subject_title || "Тест");
  const orderBadge =
    total > 1
      ? `<span class="student-result-order-badge muted" title="Сдан ${orderIndex + 1}-м по порядку">${orderIndex + 1}</span>`
      : "";
  return `
    <article class="student-result-card panel-collapse${openClass}${hl}" data-exam-id="${t.exam_id}">
      <button type="button" class="collapse-trigger student-result-trigger" aria-expanded="${highlight ? "true" : "false"}">
        <span class="collapse-trigger-text student-result-trigger-text">
          ${orderBadge}
          <span class="student-result-subject-line">${subject}</span>
        </span>
        <span class="collapse-chevron" aria-hidden="true">›</span>
      </button>
      <div class="collapse-body">
        <div class="collapse-body-inner">
        <div class="student-result-details">
          <p class="muted student-result-meta">${escapeHtml(t.title)}${t.control_date ? ` · ${escapeHtml(t.control_date)}` : ""}${t.score_line ? ` · ${escapeHtml(t.score_line)}` : ""}</p>
          ${renderMetricColumns([
            { label: "Результат", value: `${t.score_percent ?? "—"}%` },
            { label: "Верно", value: `${t.correct_count ?? "—"} из ${t.question_total ?? "—"}` },
            { label: "Время", value: t.duration_label || "—" },
            { label: "По времени", value: t.finish_rank_label || "—" },
            { label: "Класс", value: `${t.class_submitted ?? "—"} / ${t.class_total ?? "—"}` },
          ])}
          <button type="button" class="btn-ghost btn-result-detail" data-exam-id="${t.exam_id}" data-subject-code="${escapeHtml(t.subject_code || "")}">Подробные ответы</button>
        </div>
        </div>
      </div>
    </article>`;
}

function renderStudentCompletedTestsBlock(tests, highlightExamId) {
  if (!tests.length) return "";
  const heading = tests.length === 1 ? "Результат теста" : "Пройденные тесты";
  const lead =
    tests.length === 1
      ? "Нажмите на предмет, чтобы открыть результат."
      : `${tests.length} теста — по порядку сдачи. Нажмите предмет для деталей.`;
  const cards = tests
    .map((t, idx) =>
      renderStudentResultCard(t, {
        orderIndex: idx,
        total: tests.length,
        highlight: highlightExamId != null && t.exam_id === highlightExamId,
      })
    )
    .join("");
  return `
    <div class="panel panel-student-results" id="student-results">
      <h3>${heading}</h3>
      <p class="lead muted">${lead}</p>
      <div class="student-results-stack">${cards}</div>
    </div>`;
}

function bindStudentResultCards(main) {
  main.querySelectorAll(".btn-result-detail").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (blockActionIfExamActive()) return;
      portalState.highlightResultExamId = null;
      portalState.openExamAsReview = true;
      portalState.studentExamReturnHome = true;
      const subCode = btn.getAttribute("data-subject-code");
      if (subCode) portalState.subjectCode = subCode;
      if (!portalState.className && portalState.session?.user?.class_name) {
        portalState.className = portalState.session.user.class_name;
      }
      portalState.adminView = "exam";
      portalState.examId = Number(btn.getAttribute("data-exam-id"));
      renderStudentFlow();
    });
  });
}

function isStudentExamTurnedIn(preview) {
  if (!preview) return false;
  return Boolean(preview.submitted || preview.exam?.submitted);
}

function isStudentExamResultsVisible(preview) {
  if (!preview) return false;
  if (preview.results_released === true) return true;
  if (preview.awaiting_release) return false;
  if (Array.isArray(preview.feedback) && preview.feedback.length > 0) return true;
  if (preview.exam?.catalog_key === "done" && isStudentExamTurnedIn(preview)) return true;
  return false;
}

function clearStudentExamRunLocalState(examId) {
  delete portalState.examAnswers[examId];
  delete portalState.examRunStep[examId];
  clearExamDeadline(examId);
  stopExamTimer();
}

function scrollToHighlightedResult(main) {
  const el = main.querySelector(".student-result-card--highlight");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderTeacherReportPanel(data, examId) {
  if (!data.all_submitted) {
    return `<div class="panel panel-muted-inline panel-class-progress">
      <h3>Прогресс класса</h3>
      <p class="lead muted">Сдано <strong>${data.submitted_count ?? 0}</strong> из <strong>${data.class_total ?? 0}</strong>. Оценки и аналитика откроются у всех сразу, когда сдадут последние ученики.</p>
    </div>`;
  }
  if (data.teacher_report_sent) {
    return `<div class="panel panel-stats">
      <h3>Сводка по классу</h3>
      <p class="muted">Все ученики сдали. Отчёт уже отмечен как отправленный (демо).</p>
    </div>`;
  }
  return `<div class="panel panel-stats">
    <h3>Сводка по классу</h3>
    <p class="lead muted">Все ${data.class_total} учеников сдали — можно отправить результаты одним сообщением (демо).</p>
    <button type="button" class="btn-primary" id="btn-send-teacher-report">Отправить отчёт</button>
    <p class="muted" id="teacher-report-msg" hidden></p>
  </div>`;
}

function bindTeacherReportPanel(main, examId) {
  const btn = main.querySelector("#btn-send-teacher-report");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const msg = main.querySelector("#teacher-report-msg");
    try {
      await api(`/api/portal/exams/${examId}/send-teacher-report`, { method: "POST", body: "{}" });
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Сводка отправлена (демо). Таблица отсортирована от лучшего результата к худшему.";
      }
      renderAdminFlow();
    } catch {
      btn.disabled = false;
      if (msg) {
        msg.hidden = false;
        msg.textContent = "Не удалось отправить — проверьте, что сдали все ученики.";
      }
    }
  });
}

function renderStudentTestStepHtml(preview, examId, stepIndex, selectedOpt) {
  const ex = preview.exam;
  const questions = preview.questions || [];
  const q = questions[stepIndex];
  const letters = ["A", "B", "C", "D", "E", "F"];
  const total = questions.length;
  const endMs = getExamDeadlineMs(examId, ex.duration_minutes);
  const remainLabel = formatTimerMs(endMs - Date.now());
  const opts = (q?.options || [])
    .map((opt, oi) => {
      const picked = selectedOpt === oi;
      return `<button type="button" class="student-test-opt${picked ? " is-selected" : ""}" data-opt="${oi}">
        <span class="student-test-opt-letter">${letters[oi] || oi + 1}</span>
        <span class="student-test-opt-text">${escapeHtml(opt)}</span>
      </button>`;
    })
    .join("");
  const isLast = stepIndex >= total - 1;
  return `<div class="student-test-shell" data-step="${stepIndex}">
    <div class="student-test-top">
      <span class="student-test-progress">Вопрос ${stepIndex + 1} из ${total}</span>
      <span class="student-test-timer-wrap">Осталось: <strong class="student-test-timer" id="exam-live-timer">${remainLabel}</strong></span>
    </div>
    <div class="student-test-card">
      <p class="student-test-q">${escapeHtml(q?.text || "")}</p>
      <div class="student-test-opts">${opts}</div>
      <button type="button" class="btn-primary btn-confirm-answer" id="btn-confirm-answer" ${selectedOpt == null ? "disabled" : ""}>
        ${isLast ? "Подтвердить и сдать тест" : "Подтвердить ответ"}
      </button>
      <p class="error" id="confirm-answer-error" hidden></p>
    </div>
  </div>`;
}

function mountStudentTestRunner(container, preview, examId) {
  const questions = preview.questions || [];
  const qCount = questions.length;
  if (!qCount) {
    container.innerHTML = `<p class="muted">В этом тесте нет вопросов.</p>`;
    return;
  }
  if (!portalState.examAnswers[examId]) portalState.examAnswers[examId] = {};
  ensureExamQuestionTiming(examId, qCount);
  portalState.examRunStep[examId] =
    portalState.examRunStep[examId] ??
    (() => {
      const a = portalState.examAnswers[examId];
      for (let i = 0; i < qCount; i++) {
        if (a[String(i)] === undefined) return i;
      }
      return qCount - 1;
    })();

  let step = portalState.examRunStep[examId];
  let pendingOpt = null;
  let submitting = false;

  const paint = () => {
    if (step >= qCount) {
      finishSubmit();
      return;
    }
    pendingOpt =
      portalState.examAnswers[examId][String(step)] !== undefined
        ? portalState.examAnswers[examId][String(step)]
        : null;
    container.innerHTML = renderStudentTestStepHtml(preview, examId, step, pendingOpt);

    container.querySelectorAll(".student-test-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingOpt = Number(btn.getAttribute("data-opt"));
        container.querySelectorAll(".student-test-opt").forEach((b) => b.classList.remove("is-selected"));
        btn.classList.add("is-selected");
        const confirm = container.querySelector("#btn-confirm-answer");
        if (confirm) confirm.disabled = false;
      });
    });

    container.querySelector("#btn-confirm-answer")?.addEventListener("click", async () => {
      const err = container.querySelector("#confirm-answer-error");
      if (pendingOpt == null) return;
      portalState.examAnswers[examId][String(step)] = pendingOpt;
      if (step >= qCount - 1) {
        recordQuestionStepTime(examId, step, qCount);
        await finishSubmit();
        return;
      }
      recordQuestionStepTime(examId, step, qCount);
      step += 1;
      portalState.examRunStep[examId] = step;
      pendingOpt = null;
      paint();
    });
  };

  async function finishSubmit() {
    if (submitting) return;
    submitting = true;
    stopExamTimer();
    const err = container.querySelector("#confirm-answer-error");
    const btn = container.querySelector("#btn-confirm-answer");
    if (btn) btn.disabled = true;
    try {
      await submitStudentExam(examId, qCount);
      clearStudentExamRunLocalState(examId);
      if (portalState.studentBundleMode) {
        try {
          const bundle = await api("/api/portal/my/exam-bundle");
          if (bundle.next_exam_id) {
            portalState.adminView = "exam";
            portalState.examId = bundle.next_exam_id;
            await renderStudentFlow();
            return;
          }
        } catch {
          /* fall through to home */
        }
        portalState.studentBundleMode = false;
      }
      portalState.adminView = "home";
      portalState.examId = null;
      portalState.subjectCode = null;
      await renderStudentFlow();
    } catch (e) {
      submitting = false;
      if (btn) btn.disabled = false;
      if (err) {
        err.hidden = false;
        err.textContent =
          e.message === "already_submitted"
            ? "Вы уже сдали этот тест."
            : "Не удалось сдать. Попробуйте ещё раз.";
      }
    }
  }

  const tickTimer = () => {
    const endMs = getExamDeadlineMs(examId, preview.exam.duration_minutes);
    const left = endMs - Date.now();
    const el = container.querySelector("#exam-live-timer");
    if (el) {
      el.textContent = formatTimerMs(left);
      el.classList.toggle("is-urgent", left <= 60_000);
    }
    if (left <= 0) finishSubmit();
  };

  stopExamTimer();
  paint();
  tickTimer();
  portalState.examTimerId = window.setInterval(tickTimer, 250);
}

function renderStudentAwaitingClassPanel(ex, preview) {
  const n = preview.submitted_count ?? 0;
  const total = preview.class_total ?? 0;
  return `<div class="panel panel-wait panel-await-class">
    <div class="wait-box">
      <p class="wait-title">Тест сдан</p>
      <p class="muted">Ваши ответы сохранены. Результат и разбор откроются, когда сдадут все ученики класса (<strong>${n}</strong> из <strong>${total}</strong>).</p>
      <p class="muted wait-note">Пока можно вернуться к списку тестов — статус: «Сдано · ждём класс».</p>
    </div>
  </div>`;
}

function studentStatusLabel(statusOrStudent) {
  const st =
    typeof statusOrStudent === "object" && statusOrStudent !== null
      ? statusOrStudent
      : { status: statusOrStudent };
  const status = st.status;
  if (status === "submitted" && st.results_pending) return "Ждём класс";
  if (status === "submitted") return "Сдал";
  if (status === "in_progress") return "Пишет";
  return "Не начинал";
}

function isStaffRole() {
  return portalState.session?.user?.role === "admin";
}

function isAdminRole() {
  return isStaffRole();
}


function renderStaffTestsPool(poolKey, label, tests) {
  const mod = poolKey === "done" ? "done" : "active";
  const countLabel = tests.length
    ? `${tests.length} ${tests.length === 1 ? "тест" : "теста"}`
    : "нет тестов";
  return `<section class="staff-tests-pool staff-tests-pool--${mod}" aria-label="${escapeHtml(label)}">
    <div class="staff-tests-pool-head">
      <span class="staff-tests-pool-badge">${escapeHtml(label)}</span>
      <span class="staff-tests-pool-count muted">${escapeHtml(countLabel)}</span>
    </div>
    <ul class="list-plain staff-tests-pool-list">${renderStaffHomeTestRows(tests, poolKey)}</ul>
  </section>`;
}

function renderStaffHomeTestRows(tests, poolKey) {
  if (!tests.length) {
    return `<li class="staff-tests-empty"><span class="muted">Нет тестов в этой группе</span></li>`;
  }
  return tests
    .map((t, idx) => {
      const n = t.submitted_count ?? 0;
      const total = t.class_total ?? 0;
      const pubNote = t.published_to_students ? " · опубликован" : " · не опубликован";
      const sub = total
        ? `${n}/${total} сдали · ${t.kind_label || testListMeta(t)}${pubNote}`
        : `${testListMeta(t)}${pubNote}`;
      const mainLine = [t.class_name, t.subject_title || t.subject_code, t.title]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" · ");
      return `<li class="row-link" role="button" tabindex="0" data-staff-test-pool="${escapeHtml(poolKey)}" data-staff-exam-idx="${idx}">
        <span class="row-link-main">${mainLine}</span>
        <span class="muted">${escapeHtml(sub)}</span>
      </li>`;
    })
    .join("");
}

function bindStaffHomeTestsList(main, pools) {
  bindRowNav(main, "[data-staff-test-pool]", (el) => {
    const poolKey = el.getAttribute("data-staff-test-pool");
    const idx = Number(el.getAttribute("data-staff-exam-idx"));
    const t = pools[poolKey]?.[idx];
    if (!t) return;
    portalState.staffTestsShortcut = true;
    portalState.className = t.class_name;
    portalState.subjectCode = t.subject_code;
    portalState.subjectTitle = t.subject_title || t.subject_code;
    portalState.examId = t.id;
    portalState.examTitle = t.title || null;
    portalState.adminView = "exam";
    renderAdminFlow();
  });
}

function navigateBreadcrumb(level) {
  if (blockActionIfExamActive()) return;
  if (isStaffRole()) {
    if (level === "home") {
      portalState.adminView = "home";
      portalState.className = null;
      portalState.subjectCode = null;
      portalState.subjectTitle = null;
      portalState.examId = null;
      portalState.examTitle = null;
    } else if (level === "class") {
      portalState.adminView = "class";
      portalState.subjectCode = null;
      portalState.subjectTitle = null;
      portalState.examId = null;
      portalState.examTitle = null;
    } else if (level === "subject") {
      portalState.adminView = "subject";
      portalState.examId = null;
      portalState.examTitle = null;
      portalState.suppressSingleExamAutoload = true;
    }
    renderAdminFlow();
    return;
  }
  if (level === "home") {
    portalState.adminView = "home";
    portalState.subjectCode = null;
    portalState.subjectTitle = null;
    portalState.examId = null;
    renderStudentFlow();
    return;
  }
  if (level === "subject") {
    portalState.adminView = "subject";
    portalState.examId = null;
    renderStudentFlow();
  }
}

function buildBreadcrumbItems() {
  const items = [];
  if (!portalState.session) return items;

  if (isStaffRole()) {
    items.push({ level: "home", label: "Главная", link: portalState.adminView !== "home" });
    if (portalState.adminView === "home") {
      items.push({ level: "current", label: "Обзор", link: false });
      return items;
    }
    if (portalState.className) {
      items.push({
        level: "class",
        label: portalState.className,
        link: portalState.adminView !== "class",
      });
    }
    if (portalState.adminView === "class") {
      items.push({ level: "current", label: "Предметы", link: false });
      return items;
    }
    if (portalState.subjectTitle) {
      items.push({
        level: "subject",
        label: portalState.subjectTitle,
        link: portalState.adminView !== "subject",
      });
    }
    if (portalState.adminView === "subject") {
      items.push({ level: "current", label: "Контрольные", link: false });
      return items;
    }
    if (portalState.adminView === "exam") {
      items.push({
        level: "current",
        label: portalState.examTitle || "Контрольная",
        link: false,
      });
    }
    return items;
  }

  if (portalState.session.user.role === "student") {
    items.push({ level: "home", label: "Главная", link: portalState.adminView !== "home" });
    if (portalState.adminView === "home") {
      items.push({ level: "current", label: "Предметы", link: false });
      return items;
    }
    if (portalState.adminView === "subject") {
      const tail = portalState.subjectTitle
        ? `${portalState.subjectTitle} · тесты`
        : "Тесты";
      items.push({ level: "current", label: tail, link: false });
      return items;
    }
    if (portalState.adminView === "exam") {
      if (portalState.subjectTitle) {
        items.push({ level: "subject", label: portalState.subjectTitle, link: true });
      }
      items.push({ level: "current", label: portalState.examTitle || "Тест", link: false });
    }
  }
  return items;
}

function updateBreadcrumbs() {
  const nav = $("app-breadcrumbs");
  if (!nav) return;
  const items = buildBreadcrumbItems();
  if (!items.length) {
    nav.innerHTML = "";
    return;
  }
  nav.innerHTML = `<ol class="breadcrumbs-list">${items
    .map((item) => {
      if (item.level === "current" || !item.link) {
        return `<li><span class="crumb-current">${escapeHtml(item.label)}</span></li>`;
      }
      return `<li><button type="button" class="crumb-link" data-crumb-level="${escapeHtml(item.level)}">${escapeHtml(item.label)}</button></li>`;
    })
    .join("")}</ol>`;
  nav.querySelectorAll("[data-crumb-level]").forEach((btn) => {
    btn.addEventListener("click", () => navigateBreadcrumb(btn.getAttribute("data-crumb-level")));
  });
}

function bindRowNav(main, selector, onPick) {
  main.querySelectorAll(selector).forEach((el) => {
    const go = (e) => {
      const row = e?.target?.closest?.(selector) || el;
      onPick(row);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go();
      }
    });
  });
}

async function loadStaffTestsList() {
  try {
    const data = await api("/api/portal/staff/tests");
    return data.tests || [];
  } catch (err) {
    console.warn("portal: staff tests list", err);
    return [];
  }
}

async function renderAdminHome(main, session) {
  const classes = await api("/api/portal/classes");
  const staffTests = isStaffRole() ? await loadStaffTestsList() : [];
  const rows = classes.length
    ? classes
        .map(
          (c) => `<li class="row-link" role="button" tabindex="0" data-class-name="${encPath(c.class_name)}">
        <span class="row-link-main">${escapeHtml(c.class_name)}</span>
        <span class="muted">${c.student_count} уч. · ${c.test_count} тест.</span>
      </li>`
        )
        .join("")
    : `<li><span class="muted">Нет классов — добавьте учеников с указанием класса</span></li>`;

  const doneTests = staffTests.filter((t) => t.catalog_key === "done");
  const activeTests = staffTests.filter((t) => t.catalog_key !== "done");
  const staffTestPools = { done: doneTests, active: activeTests };

  const testsPanel = isStaffRole()
    ? `<div class="panel panel-staff-tests">
      <h3>Контрольные</h3>
      <p class="lead muted staff-tests-hint">Нажмите тест — откроется проверка и настройка.</p>
      <div class="staff-tests-pools">
        ${renderStaffTestsPool("active", "К сдаче", activeTests)}
        ${renderStaffTestsPool("done", "Пройденные", doneTests)}
      </div>
    </div>`
    : "";
  main.innerHTML = `
    ${renderNotifyRecipientsPanel()}
    <div class="panel">
      <h3>Классы</h3>
      <ul class="list-plain">${rows}</ul>
    </div>
    ${testsPanel}
  `;
  bindNotifyRecipients(main);
  bindStaffHomeTestsList(main, staffTestPools);
  bindRowNav(main, "[data-class-name]", (el) => {
    portalState.staffTestsShortcut = false;
    portalState.adminView = "class";
    portalState.className = decodeURIComponent(el.getAttribute("data-class-name"));
    portalState.subjectCode = null;
    portalState.examId = null;
    portalState.examTitle = null;
    renderAdminFlow();
  });
  updateBreadcrumbs();
}

async function renderAdminClassSubjects(main) {
  const cls = portalState.className;
  const data = await api(`/api/portal/class/${encPath(cls)}/subjects`);
  let classHub = "";
  if (isAdminRole()) {
    try {
      const timingData = await api(`/api/portal/class/${encPath(cls)}/exam-timing`);
      const bundleData = await api(`/api/portal/class/${encPath(cls)}/exam-bundle`);
      classHub = renderAdminClassHubPanel(cls, timingData.schedule, bundleData, data.subjects);
    } catch (err) {
      console.warn("portal: class hub panel", err);
    }
  }
  if (!classHub) {
    const rows = data.subjects
      .map(
        (s) => `<li class="row-link" role="button" tabindex="0" data-subject-code="${escapeHtml(s.code)}">
      <span class="row-link-main">${escapeHtml(s.title)}</span>
      <span class="muted">${s.test_count} тест.</span>
    </li>`
      )
      .join("");
    classHub = `<section class="panel">
      <h3 class="class-detail-title">Класс ${escapeHtml(cls)}</h3>
      <ul class="list-plain">${rows}</ul>
    </section>`;
  }

  main.innerHTML = `
    <button type="button" class="btn-ghost btn-back" id="btn-back-classes">← К классам</button>
    ${classHub}
  `;
  if (isAdminRole()) {
    bindAdminTestsPanel(main, cls);
  }
  $("btn-back-classes").addEventListener("click", () => {
    portalState.adminView = "home";
    portalState.className = null;
    portalState.examTitle = null;
    renderAdminFlow();
  });
  bindRowNav(main, "[data-subject-code]", (el) => {
    portalState.adminView = "subject";
    portalState.subjectCode = el.getAttribute("data-subject-code");
    const sub = data.subjects.find((s) => s.code === portalState.subjectCode);
    portalState.subjectTitle = sub ? sub.title : portalState.subjectCode;
    portalState.suppressSingleExamAutoload = false;
    renderAdminFlow();
  });
  updateBreadcrumbs();
}

async function renderAdminSubjectTests(main) {
  const cls = portalState.className;
  const code = portalState.subjectCode;
  const data = await api(`/api/portal/class/${encPath(cls)}/subjects/${code}/tests`);
  portalState.subjectTitle = data.subject_title || portalState.subjectTitle;
  const suppressAutoload = portalState.suppressSingleExamAutoload;
  portalState.suppressSingleExamAutoload = false;
  if (data.tests.length === 1 && !suppressAutoload) {
    const only = data.tests[0];
    portalState.adminView = "exam";
    portalState.examId = only.id;
    portalState.examTitle = only.title || null;
    await renderAdminExamDetail(main);
    return;
  }
  const rows = data.tests.length
    ? data.tests
        .map(
          (t) => `<li class="row-link" role="button" tabindex="0" data-exam-id="${t.id}">
        <span class="row-link-main">${escapeHtml(t.control_date || "")} · ${escapeHtml(t.title)}</span>
        <span class="muted">${escapeHtml(testListMeta(t))}</span>
      </li>`
        )
        .join("")
    : `<li><span class="muted">В этом предмете пока нет контрольных</span></li>`;

  const backSubjectsLabel = portalState.staffTestsShortcut ? "← На главную" : "← К предметам";
  main.innerHTML = `
    <button type="button" class="btn-ghost btn-back" id="btn-back-subjects">${backSubjectsLabel}</button>
    <div class="panel">
      <h3 class="class-detail-title">${escapeHtml(data.subject_title)}</h3>
      <p class="lead">Класс ${escapeHtml(cls)} · выберите контрольную, как после выбора предмета в классе</p>
      <ul class="list-plain">${rows}</ul>
    </div>
  `;
  $("btn-back-subjects").addEventListener("click", () => {
    if (portalState.staffTestsShortcut) {
      portalState.staffTestsShortcut = false;
      portalState.adminView = "home";
      portalState.className = null;
      portalState.subjectCode = null;
      portalState.subjectTitle = null;
      portalState.examId = null;
    } else {
      portalState.adminView = "class";
      portalState.subjectCode = null;
      portalState.examId = null;
    }
    renderAdminFlow();
  });
  bindRowNav(main, "[data-exam-id]", (el) => {
    portalState.adminView = "exam";
    portalState.examId = Number(el.getAttribute("data-exam-id"));
    renderAdminFlow();
  });
  updateBreadcrumbs();
}

function previewFromAdminPayload(data) {
  return {
    exam: data.exam,
    questions: data.questions || [],
    show_answers: true,
    submitted: false,
    score_percent: null,
  };
}

async function fetchExamPreview(examId) {
  return await api(`/api/portal/exams/${examId}/preview`);
}

const EXAM_EDITOR_LETTERS = ["A", "B", "C", "D", "E", "F"];

function teacherExamQuestionsSnapshot(questions) {
  const rows = (questions || []).map((q) => {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    let correct_index = Number(q.correct_index);
    if (!Number.isFinite(correct_index)) correct_index = 0;
    if (options.length) correct_index = Math.min(correct_index, options.length - 1);
    return {
      text: String(q.text || "").trim(),
      options,
      correct_index,
    };
  });
  return JSON.stringify(rows);
}

function teacherExamQuestionsEqual(a, b) {
  return teacherExamQuestionsSnapshot(a) === teacherExamQuestionsSnapshot(b);
}

function teacherExamEditorActionFlags(currentQuestions, baselineQuestions) {
  const hasChanges = !teacherExamQuestionsEqual(currentQuestions, baselineQuestions);
  return { hasChanges, showSaveDraft: hasChanges, showPublish: false };
}

function applyTeacherExamEditorActions(panel, flags) {
  const saveBtn = panel.querySelector("#btn-save-exam-draft");
  const actions = panel.querySelector(".teacher-exam-editor-actions");
  if (saveBtn) saveBtn.hidden = !flags.showSaveDraft;
  if (actions) actions.hidden = !flags.showSaveDraft;
}

function subjectCodeForBundleExam(exam, subjects) {
  if (exam?.subject_code) return exam.subject_code;
  const title = exam?.subject_title;
  if (!title) return "";
  const sub = (subjects || []).find((s) => s.title === title);
  return sub?.code || "";
}

function renderAdminClassHubPanel(className, schedule, bundleData, subjects) {
  const sch = schedule || bundleData?.schedule || { total_minutes: 45, test_count: 3, minutes_per_test: 15 };
  const perTest =
    sch.minutes_per_test ?? Math.max(5, Math.floor((sch.total_minutes || 45) / (sch.test_count || 3)));
  const count = sch.test_count ?? (bundleData?.exams?.length || 3);
  const exams = bundleData?.exams || [];
  const published = Boolean(bundleData?.bundle_published);
  const bundleRows = exams.length
    ? exams
        .map((ex, i) => {
          const code = subjectCodeForBundleExam(ex, subjects);
          const codeAttr = code ? ` data-subject-code="${escapeHtml(code)}"` : "";
          const interactive = code
            ? ` class="row-link" role="button" tabindex="0"${codeAttr}`
            : "";
          return `<li${interactive}>
      <span class="row-link-main">${i + 1}. ${escapeHtml(ex.subject_title || "")}</span>
      <span class="muted admin-bundle-exam-title">${escapeHtml(ex.title || "")}</span>
    </li>`;
        })
        .join("")
    : (subjects || [])
        .map(
          (s, i) => `<li class="row-link" role="button" tabindex="0" data-subject-code="${escapeHtml(s.code)}">
      <span class="row-link-main">${i + 1}. ${escapeHtml(s.title)}</span>
      <span class="muted">${s.test_count} тест.</span>
    </li>`
        )
        .join("");
  return `<section class="panel panel-admin-class-hub panel-admin-tests" id="admin-tests-panel">
    <h3 class="class-detail-title">Класс ${escapeHtml(className)}</h3>
    <p class="lead muted">Тесты сдаются подряд: математика → русский → английский.</p>
    <div class="admin-tests-timing-block">
      <p class="muted">Общее время на все тесты (делится поровну): <strong>${count}</strong> тест(а) · ≈ <strong id="admin-timing-per-test">${perTest}</strong> мин на каждый.</p>
      <label class="admin-timing-total">
        <span>Общее время</span>
        <input type="number" id="admin-timing-total" class="admin-timing-input" min="15" max="300" step="1" inputmode="numeric" value="${sch.total_minutes ?? 45}" />
        <span class="muted">мин</span>
        <button type="button" class="btn-timing-confirm is-idle" id="btn-save-exam-timing" disabled title="Сохранить время" aria-label="Сохранить время">✓</button>
      </label>
      <p class="muted" id="admin-timing-preview" data-test-count="${count}"></p>
      <p class="muted admin-timing-msg" id="admin-timing-msg" hidden></p>
    </div>
    <p class="muted admin-bundle-hint">Нажмите строку, чтобы открыть и проверить вопросы теста.</p>
    <ul class="list-plain admin-bundle-order admin-class-subjects">${bundleRows}</ul>
    <p class="muted admin-tests-status">Статус: <strong>${published ? "опубликованы для учеников" : "ещё не опубликованы"}</strong></p>
    <div class="admin-tests-publish-row">
      <button type="button" class="btn-primary" id="btn-publish-exam-bundle"${published ? " hidden" : ""}>Опубликовать для учеников</button>
    </div>
    <p class="muted admin-bundle-msg" id="admin-bundle-msg" hidden></p>
  </section>`;
}

function bindAdminTestsPanel(main, className) {
  const panel = main.querySelector("#admin-tests-panel");
  if (!panel) return;

  const saveBtn = panel.querySelector("#btn-save-exam-timing");
  const timingMsg = panel.querySelector("#admin-timing-msg");
  const totalInput = panel.querySelector("#admin-timing-total");
  const preview = panel.querySelector("#admin-timing-preview");
  const perTestEl = panel.querySelector("#admin-timing-per-test");
  const testCount = Number(preview?.getAttribute("data-test-count")) || 3;
  let savedTotalMinutes = Number(totalInput?.value);
  if (!Number.isFinite(savedTotalMinutes)) savedTotalMinutes = 45;

  const syncSaveTimingButton = () => {
    const current = Number(totalInput?.value);
    const dirty = Number.isFinite(current) && current !== savedTotalMinutes;
    if (!saveBtn) return;
    saveBtn.classList.toggle("is-pending", dirty);
    saveBtn.classList.toggle("is-idle", !dirty);
    saveBtn.disabled = !dirty;
  };

  const refreshPreview = () => {
    const total = Number(totalInput?.value) || 45;
    const per = Math.max(5, Math.floor(total / testCount));
    if (perTestEl) perTestEl.textContent = String(per);
    if (preview) preview.textContent = `${total} мин ÷ ${testCount} = ${per} мин на тест.`;
    syncSaveTimingButton();
  };
  totalInput?.addEventListener("input", refreshPreview);
  refreshPreview();

  saveBtn?.addEventListener("click", async () => {
    const total = Number(totalInput?.value);
    saveBtn.disabled = true;
    try {
      await api(`/api/portal/class/${encPath(className)}/exam-timing`, {
        method: "POST",
        body: JSON.stringify({ total_minutes: total }),
      });
      savedTotalMinutes = total;
      if (saveBtn) {
        saveBtn.classList.remove("is-pending");
        saveBtn.classList.add("is-idle");
        saveBtn.disabled = true;
      }
      syncSaveTimingButton();
      if (timingMsg) {
        timingMsg.hidden = false;
        timingMsg.textContent = "Время сохранено.";
      }
      refreshPreview();
    } catch {
      if (timingMsg) {
        timingMsg.hidden = false;
        timingMsg.textContent = "Не удалось сохранить.";
        timingMsg.classList.add("error");
      }
    } finally {
      saveBtn.disabled = false;
    }
  });

  const pubBtn = panel.querySelector("#btn-publish-exam-bundle");
  const pubMsg = panel.querySelector("#admin-bundle-msg");
  pubBtn?.addEventListener("click", async () => {
    pubBtn.disabled = true;
    try {
      await api(`/api/portal/class/${encPath(className)}/exam-bundle`, {
        method: "POST",
        body: JSON.stringify({ action: "publish" }),
      });
      if (pubMsg) {
        pubMsg.hidden = false;
        pubMsg.textContent = "Тесты опубликованы. Ученики сдают их по очереди.";
      }
      pubBtn.hidden = true;
      await renderAdminFlow();
    } catch {
      if (pubMsg) {
        pubMsg.hidden = false;
        pubMsg.textContent = "Не удалось опубликовать.";
        pubMsg.classList.add("error");
      }
    } finally {
      pubBtn.disabled = false;
    }
  });
}

function renderStudentExamBundlePanel(bundle) {
  if (!bundle?.test_count) {
    return `<div class="panel"><p class="muted">Тесты для класса пока не назначены.</p></div>`;
  }
  const steps = (bundle.tests || [])
    .map((t, i) => {
      const mark = t.submitted ? "✓" : bundle.next_exam_id === t.exam_id ? "→" : "○";
      return `<li><span class="bundle-step-mark">${mark}</span> ${escapeHtml(t.subject_title || `Тест ${i + 1}`)}</li>`;
    })
    .join("");
  if (!bundle.published) {
    return `<section class="panel panel-student-bundle">
      <h3>Экзамен (${bundle.test_count} теста)</h3>
      <p class="muted">Ждём публикации администрацией. Всего будет ${bundle.total_minutes} мин (${bundle.minutes_per_test} мин на каждый тест).</p>
      <ol class="list-plain bundle-steps">${steps}</ol>
    </section>`;
  }
  if (bundle.all_submitted) {
    return `<section class="panel panel-student-bundle">
      <h3>Экзамен сдан</h3>
      <p class="muted">Вы прошли все ${bundle.test_count} теста. Результаты появятся, когда сдадут все в классе.</p>
      <ol class="list-plain bundle-steps">${steps}</ol>
    </section>`;
  }
  const cta = bundle.next_exam_id ? "Продолжить экзамен" : "Начать экзамен";
  return `<section class="panel panel-student-bundle">
    <h3>Экзамен (${bundle.test_count} теста подряд)</h3>
    <p class="lead muted">${bundle.total_minutes} мин всего · ${bundle.minutes_per_test} мин на каждый тест. После сдачи одного откроется следующий.</p>
    <ol class="list-plain bundle-steps">${steps}</ol>
    <button type="button" class="btn-primary" id="btn-start-exam-bundle">${escapeHtml(cta)}</button>
  </section>`;
}

function bindStudentExamBundlePanel(main, bundle) {
  const btn = main.querySelector("#btn-start-exam-bundle");
  if (!btn || !bundle?.next_exam_id) return;
  btn.addEventListener("click", () => {
    if (blockActionIfExamActive()) return;
    portalState.studentBundleMode = true;
    portalState.adminView = "exam";
    portalState.examId = bundle.next_exam_id;
    portalState.studentExamReturnHome = true;
    renderStudentFlow();
  });
}

function renderTeacherExamEditorPanel(questions, editorMeta, examMeta) {
  const mins = editorMeta?.duration_minutes ?? examMeta?.duration_minutes ?? "—";
  const initialFlags = teacherExamEditorActionFlags(questions, questions);
  const cards = questions
    .map((q, qi) => {
      const opts = (q.options || []).slice(0, 6);
      const optFields = opts
        .map((opt, oi) => {
          const letter = EXAM_EDITOR_LETTERS[oi] || String(oi + 1);
          const checked = Number(q.correct_index) === oi ? "checked" : "";
          return `<label class="teacher-q-opt-row">
            <input type="radio" name="teacher-q-correct-${qi}" value="${oi}" ${checked} />
            <span class="teacher-q-opt-letter">${letter}</span>
            <input type="text" class="teacher-q-opt-input" data-q="${qi}" data-opt="${oi}" value="${escapeHtml(opt)}" />
          </label>`;
        })
        .join("");
      return `<article class="teacher-q-edit-card" data-q-index="${qi}">
        <div class="teacher-q-edit-head">
          <span class="teacher-q-edit-num">Вопрос ${qi + 1}</span>
        </div>
        <label class="teacher-q-label">Текст вопроса
          <textarea class="teacher-q-text" rows="2" data-q="${qi}">${escapeHtml(q.text || "")}</textarea>
        </label>
        <div class="teacher-q-opts">${optFields}</div>
      </article>`;
    })
    .join("");
  return `<section class="panel panel-teacher-exam-editor" id="teacher-exam-editor">
    <div class="panel-demo-head">
      <h3>Проверка теста</h3>
    </div>
    <p class="lead muted">Исправьте опечатки в вопросах и вариантах ответов и сохраните черновик. Публикация всего комплекта — на главной. Сейчас ≈ <strong>${escapeHtml(String(mins))} мин</strong> на этот тест (общее время делится на число тестов).</p>
    <div class="teacher-exam-editor-main">
      <div class="teacher-q-edit-list">${cards}</div>
      <div class="teacher-exam-editor-actions"${initialFlags.showSaveDraft ? "" : " hidden"}>
        <button type="button" class="btn-secondary" id="btn-save-exam-draft"${initialFlags.showSaveDraft ? "" : " hidden"}>Сохранить черновик</button>
      </div>
    </div>
    <p class="muted teacher-exam-editor-hint" id="exam-editor-msg" hidden></p>
  </section>`;
}

function collectTeacherExamQuestionsFromEditor(root) {
  const cards = root.querySelectorAll(".teacher-q-edit-card");
  const questions = [];
  cards.forEach((card) => {
    const qi = Number(card.getAttribute("data-q-index"));
    const textEl = card.querySelector(".teacher-q-text");
    const text = textEl?.value?.trim() || "";
    const options = [];
    card.querySelectorAll(".teacher-q-opt-input").forEach((inp) => {
      options[Number(inp.getAttribute("data-opt"))] = inp.value.trim();
    });
    const compact = options.filter((o) => o != null && String(o).length > 0);
    const correctRaw = card.querySelector(`input[name="teacher-q-correct-${qi}"]:checked`);
    const correct_index = correctRaw ? Number(correctRaw.value) : 0;
    questions.push({
      text,
      options: compact.length ? compact : [""],
      correct_index: Math.min(correct_index, Math.max(0, compact.length - 1)),
    });
  });
  return questions;
}

function setExamEditorMessage(root, text, isError = false) {
  const el = root.querySelector("#exam-editor-msg");
  if (!el) return;
  if (!text) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function bindTeacherExamEditor(main, examId, examMeta, initialQuestions, editorMeta) {
  const panel = main.querySelector("#teacher-exam-editor");
  if (!panel) return;
  const saveBtn = panel.querySelector("#btn-save-exam-draft");
  let baselineQuestions = initialQuestions || [];
  const editorUiState = () => ({});

  const syncEditorActions = () => {
    const current = collectTeacherExamQuestionsFromEditor(panel);
    const flags = teacherExamEditorActionFlags(current, baselineQuestions, editorUiState());
    applyTeacherExamEditorActions(panel, flags);
    return flags;
  };

  panel.querySelectorAll(".teacher-q-text, .teacher-q-opt-input").forEach((el) => {
    el.addEventListener("input", () => syncEditorActions());
  });
  panel.querySelectorAll('input[type="radio"]').forEach((el) => {
    el.addEventListener("change", () => syncEditorActions());
  });

  saveBtn?.addEventListener("click", async () => {
    const questions = collectTeacherExamQuestionsFromEditor(panel);
    saveBtn.disabled = true;
    try {
      await api(`/api/portal/exams/${examId}/draft`, {
        method: "POST",
        body: JSON.stringify({ questions }),
      });
      baselineQuestions = collectTeacherExamQuestionsFromEditor(panel);
      setExamEditorMessage(panel, "Черновик сохранён.");
      syncEditorActions();
    } catch (e) {
      setExamEditorMessage(panel, "Не удалось сохранить черновик.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

}

async function renderAdminExamDetail(main) {
  const examId = portalState.examId;
  const data = await api(`/api/portal/exams/${examId}/admin`);
  const preview = previewFromAdminPayload(data);
  const ex = data.exam;
  portalState.examTitle = `${ex.control_date || ""} · ${ex.title}`.trim();
  portalState.subjectTitle = ex.subject_title || portalState.subjectTitle;
  updateBreadcrumbs();

  const summary = examSummaryMetrics(ex, data.students);
  const { columns: analyticsCols, headerColumns, timing } = summary;

  const timingPanel = `<section class="panel panel-block panel-timing-stats" aria-labelledby="exam-timing-title">
      <h3 id="exam-timing-title">Время прохождения</h3>
      <p class="lead muted">Среднее по ученикам, которые сдали тест (из ${timing.submittedCount} сдавших)</p>
      ${renderMetricColumns([
        { label: "Среднее", value: timing.avgLabel || "—" },
        { label: "Быстрее всех", value: timing.minLabel || "—" },
        { label: "Дольше всех", value: timing.maxLabel || "—" },
        {
          label: "Лимит теста",
          value: `${ex.duration_minutes || 13} мин`,
        },
      ])}
    </section>`;

  const studentsTable = data.students.length
    ? renderStudentResultsTable(data.students)
    : `<p class="muted">В классе пока нет учеников — добавим позже</p>`;

  const problemPanelLead = [
    timing.avgLabel ? `Ср. время теста (класс): ${timing.avgLabel}` : null,
    timing.exitLabel
      ? timing.exitLabel.replace(/^выход:\s*/i, "Выход из окна: ")
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const problemPanel =
    data.problem_questions.length > 0
      ? `<section class="panel panel-warn panel-block panel-problems-table" aria-labelledby="exam-problems-title">
      <h3 id="exam-problems-title">Сложные вопросы</h3>
      <p class="lead muted">Вопросы, где ≥40% сдавших ошиблись или не ответили</p>
      ${problemPanelLead ? `<p class="problem-panel-meta muted">${escapeHtml(problemPanelLead)}</p>` : ""}
      ${renderProblemQuestionsTable(data.questions, data.problem_questions, data.question_stats)}
    </section>`
      : `<section class="panel panel-muted-inline panel-block" aria-labelledby="exam-problems-title">
      <h3 id="exam-problems-title">Сложные вопросы</h3>
      <p class="muted">Пока нет сданных работ — блок заполнится после первых сдач.</p>
    </section>`;

  const studentsPanel = `<section class="panel panel-block panel-students" aria-labelledby="exam-students-title">
      <h3 id="exam-students-title">Ученики класса</h3>
      ${studentsTable}
    </section>`;

  const questionsTable = data.questions.length
    ? renderDataTable({
        tableClass: "table-questions",
        columns: [
          { label: "№", cellClass: "num", render: (_, idx) => String(idx + 1) },
          {
            label: "Вопрос",
            render: (q) => escapeHtml(q.text),
          },
          {
            label: "Ошибок",
            cellClass: "num col-errors-stack",
            render: (q, idx) => {
              const st = data.question_stats[idx];
              if (!st || !st.submitted_total) return "—";
              const timeHtml = st.avg_time_label
                ? `<span class="cell-time-sub muted">ср. ${escapeHtml(st.avg_time_label)}</span>`
                : "";
              return `<div class="cell-errors-stack"><strong>${st.failed_percent}%</strong>${timeHtml}</div>`;
            },
          },
        ],
        rows: data.questions,
      })
    : `<p class="muted">Вопросы не добавлены</p>`;

  const questionsPanel = `<section class="panel panel-block panel-questions-stats" aria-labelledby="exam-questions-title">
      <h3 id="exam-questions-title">Вопросы и статистика</h3>
      <p class="lead muted">Доля ошибок среди учеников, которые уже сдали работу</p>
      ${questionsTable}
    </section>`;

  const summaryPanel = `<section class="panel panel-block panel-analytics-summary" aria-labelledby="exam-summary-title">
      <h3 id="exam-summary-title">Сводка по классу</h3>
      ${renderMetricColumns(analyticsCols)}
    </section>`;

  const resultsReleased = data.all_submitted;
  const analyticsHoldPanel = `<section class="panel panel-muted-inline panel-block panel-results-locked">
      <p class="muted">Детальная аналитика (время, сложные вопросы, проценты) появится здесь, когда сдадут все <strong>${data.class_total ?? 0}</strong> учеников. Сейчас сдано <strong>${data.submitted_count ?? 0}</strong>.</p>
    </section>`;
  const examAnalyticsStack = resultsReleased
    ? `${summaryPanel}${timingPanel}${problemPanel}${studentsPanel}${questionsPanel}`
    : `${studentsPanel}${analyticsHoldPanel}`;

  const studentPreviewPanel = SHOW_STUDENT_PREVIEW_PANEL
    ? renderCollapsiblePanel({
        title: "Тест: как видит ученик",
        hint: `${questionCountLabel(ex)} вопросов — нажмите, чтобы развернуть`,
        open: false,
        bodyHtml: renderDemoTestPanel(preview, {
          interactive: false,
          title: "Демо: экран прохождения",
          innerOnly: true,
        }),
      })
    : "";

  const sessionPanel = renderExamSessionPanel(ex, data.students);
  const teacherReportPanel = renderTeacherReportPanel(data, examId);
  const editorMeta = data.exam_editor || { published: false };
  const teacherEditorPanel = isStaffRole()
    ? renderTeacherExamEditorPanel(data.questions, editorMeta, { ...ex, id: examId })
    : "";

  main.innerHTML = `
    <button type="button" class="btn-ghost btn-back" id="btn-back-tests">← К контрольным</button>
    <div class="panel panel-exam-head">
      <h3 class="class-detail-title">${escapeHtml(ex.title)}</h3>
      ${renderMetricColumns(headerColumns)}
    </div>
    ${teacherEditorPanel}
    ${teacherReportPanel}
    ${sessionPanel}
    ${studentPreviewPanel}
    <div class="exam-blocks-stack">
      ${examAnalyticsStack}
    </div>
  `;
  bindCollapsiblePanels(main);
  bindStudentTableExpand(main);
  bindExamSessionPanel(main, examId, data.students);
  if (isStaffRole()) {
    bindTeacherExamEditor(main, examId, { ...ex, id: examId }, data.questions, editorMeta);
  }
  bindTeacherReportPanel(main, examId);
  const backTestsBtn = $("btn-back-tests");
  if (backTestsBtn && portalState.staffTestsShortcut) {
    backTestsBtn.textContent = "← На главную";
  }
  backTestsBtn?.addEventListener("click", () => {
    if (blockActionIfExamActive()) return;
    if (portalState.staffTestsShortcut) {
      portalState.staffTestsShortcut = false;
      portalState.adminView = "home";
      portalState.className = null;
      portalState.subjectCode = null;
      portalState.subjectTitle = null;
      portalState.examId = null;
      portalState.examTitle = null;
    } else {
      portalState.adminView = "subject";
      portalState.examId = null;
      portalState.examTitle = null;
      portalState.suppressSingleExamAutoload = true;
    }
    renderAdminFlow();
  });
}

async function renderStudentExamPreview(main) {
  const examId = portalState.examId;
  const reviewOnly = portalState.openExamAsReview;
  portalState.openExamAsReview = false;
  const preview = await fetchExamPreview(examId);
  const ex = preview.exam;
  const turnedIn = isStudentExamTurnedIn(preview);
  const showResults = isStudentExamResultsVisible(preview) || reviewOnly;
  if (turnedIn || showResults) clearStudentExamRunLocalState(examId);
  portalState.examTitle = ex.title;
  portalState.subjectTitle = ex.subject_title || portalState.subjectTitle;
  updateBreadcrumbs();
  const userId = portalState.session?.user?.id;
  const todoNotStarted =
    !turnedIn &&
    !PORTAL_SKIP_TEACHER_START &&
    ex.catalog_key === "todo" &&
    !getExamSession(examId).started;

  if (preview.awaiting_release && !reviewOnly) {
    main.innerHTML = `
      <button type="button" class="btn-ghost btn-back" id="btn-student-exam-back">${studentExamBackLabel()}</button>
      <div class="panel panel-exam-head">
        <h3 class="class-detail-title">${escapeHtml(ex.title)}</h3>
        ${renderMetricColumns([
          { label: "Дата", value: ex.control_date || "—" },
          { label: "Вопросов", value: String(questionCountLabel(ex)) },
          { label: "Статус", value: "Сдан · ждём класс" },
          { label: "Класс", value: `${preview.submitted_count ?? 0} / ${preview.class_total ?? 0} сдали` },
        ])}
      </div>
      ${renderStudentAwaitingClassPanel(ex, preview)}
    `;
    $("btn-student-exam-back").addEventListener("click", () => navigateBackFromStudentExam(ex));
    return;
  }

  if (todoNotStarted && userId != null) {
    main.innerHTML = `
      <button type="button" class="btn-ghost btn-back" id="btn-student-exam-back">${studentExamBackLabel()}</button>
      ${renderStudentWaitPanel(ex, examId, userId)}
    `;
    bindStudentReady(main, examId, userId);
    $("btn-student-exam-back").addEventListener("click", () => navigateBackFromStudentExam(ex));
    return;
  }

  const interactive = !turnedIn && ex.catalog_key === "todo";

  if (interactive) {
    setTestTakingActive(true, examId);
    updateBreadcrumbs();
    main.innerHTML = `<div class="student-test-run" id="student-test-run"></div>`;
    mountStudentTestRunner($("student-test-run"), preview, examId);
    return;
  }

  setTestTakingActive(false);
  const reviewPreview = showResults ? { ...preview, submitted: true, results_released: true } : preview;
  const headerCols = studentExamHeaderMetrics(ex, reviewPreview);
  const testInner = renderDemoTestPanel(reviewPreview, {
    interactive: false,
    title: "Тест",
    innerOnly: true,
  });
  const summary = showResults ? studentFeedbackSummary(reviewPreview) : null;
  const answersBody = showResults
    ? renderStudentFeedbackTable(reviewPreview)
    : `<p class="muted">Ответы появятся после сдачи теста.</p>`;

  main.innerHTML = `
    <button type="button" class="btn-ghost btn-back" id="btn-student-exam-back">${studentExamBackLabel()}</button>
    <div class="panel panel-exam-head">
      <h3 class="class-detail-title">${escapeHtml(ex.title)}</h3>
      ${renderMetricColumns(headerCols)}
    </div>
    ${renderCollapsiblePanel({
      title: showResults ? "Тест: ваши ответы на экране" : "Тест",
      hint: `${questionCountLabel(ex)} вопросов — нажмите, чтобы развернуть`,
      open: showResults,
      bodyHtml: testInner,
    })}
    ${
      showResults
        ? renderCollapsiblePanel({
            title: "Мои ответы",
            hintHtml: renderMetricColumns([
              { label: "Результат", value: `${reviewPreview.score_percent ?? ex.score_percent ?? "—"}%` },
              { label: "Верно", value: `${summary.correct} из ${summary.total}` },
              { label: "Ошибок", value: String(summary.wrong) },
            ]),
            open: true,
            bodyHtml: `<div class="panel panel-nested">${answersBody}</div>`,
          })
        : ""
    }
  `;
  bindCollapsiblePanels(main);
  bindDemoTestPicks(main);
  $("btn-student-exam-back").addEventListener("click", () => navigateBackFromStudentExam(ex));
}

async function renderAdminFlow() {
  const main = $("app-main");
  main.innerHTML = `<p class="muted">Загрузка…</p>`;
  if (portalState.adminView !== "exam" || portalState.examId == null) {
    setTestTakingActive(false);
  }
  try {
    if (portalState.adminView === "home") {
      await renderAdminHome(main, portalState.session);
    } else if (portalState.adminView === "class") {
      await renderAdminClassSubjects(main);
    } else if (portalState.adminView === "subject") {
      await renderAdminSubjectTests(main);
    } else if (portalState.adminView === "exam") {
      await renderAdminExamDetail(main);
    } else {
      updateBreadcrumbs();
    }
  } catch (err) {
    main.innerHTML = `<p class="error">Не удалось загрузить данные. Обновите страницу (Ctrl+F5) или перезапустите сайт: ./run.sh</p>`;
    updateBreadcrumbs();
    console.error("portal", err);
  }
}

async function renderStudentFlow() {
  const main = $("app-main");
  const session = portalState.session;
  const u = session.user;
  if (
    isStudentTestSessionLocked() &&
    (portalState.adminView !== "exam" ||
      portalState.examId == null ||
      portalState.examId !== examGuardHandlers.examId)
  ) {
    recordExamDistraction(examGuardHandlers.examId, "navigation");
    portalState.adminView = "exam";
    portalState.examId = examGuardHandlers.examId;
  }
  if (portalState.adminView !== "exam" || portalState.examId == null) {
    setTestTakingActive(false);
    stopExamTimer();
  }
  main.innerHTML = `<p class="muted">Загрузка…</p>`;

  if (portalState.adminView === "home") {
    const highlightId = portalState.highlightResultExamId;
    const data = await api("/api/portal/my/subjects");
    const completedTests = await loadStudentCompletedTests(data);
    let bundle = null;
    try {
      bundle = await api("/api/portal/my/exam-bundle");
    } catch (err) {
      console.warn("portal: exam bundle", err);
    }
    const bundleBlock = renderStudentExamBundlePanel(bundle);
    const resultsBlock = renderStudentCompletedTestsBlock(completedTests, highlightId);
    main.innerHTML = `
      <span class="badge">${escapeHtml(ROLE_LABEL.student)}</span>
      <div class="panel">
        <h3>${escapeHtml(u.full_name)}</h3>
        <p class="lead">${escapeHtml(session.school_name)} · класс ${escapeHtml(data.class_name)}</p>
      </div>
      ${bundleBlock}
      ${resultsBlock}
    `;
    bindStudentExamBundlePanel(main, bundle);
    bindCollapsiblePanels(main);
    bindStudentResultCards(main);
    if (highlightId != null) {
      scrollToHighlightedResult(main);
      portalState.highlightResultExamId = null;
    }
    updateBreadcrumbs();
    return;
  }

  if (portalState.adminView === "subject") {
    const cls = portalState.className;
    const code = portalState.subjectCode;
    if (!cls || !code) {
      portalState.adminView = "home";
      portalState.examId = null;
      await renderStudentFlow();
      return;
    }
    const data = await api(`/api/portal/class/${encPath(cls)}/subjects/${code}/tests`);
    portalState.subjectTitle = data.subject_title || portalState.subjectTitle;
    const rows = data.tests.length
      ? data.tests
          .map(
            (t) => `<li class="row-link${t.locked ? " is-locked" : ""}" role="button" tabindex="0" data-exam-id="${t.id}" data-exam-locked="${t.locked ? "1" : "0"}" data-exam-submitted="${t.results_released ? "1" : "0"}">
        <span class="row-link-main">${escapeHtml(t.title)}</span>
        <span class="muted">${escapeHtml(t.student_label || testListMeta(t))}</span>
      </li>`
          )
          .join("")
      : `<li><span class="muted">Нет тестов</span></li>`;
    main.innerHTML = `
      <button type="button" class="btn-ghost btn-back" id="btn-student-back">← К предметам</button>
      <div class="panel">
        <h3>${escapeHtml(data.subject_title)}</h3>
        <p class="lead">Нажмите тест, чтобы открыть демо</p>
        <ul class="list-plain">${rows}</ul>
      </div>
    `;
    $("btn-student-back").addEventListener("click", () => {
      if (blockActionIfExamActive()) return;
      portalState.adminView = "home";
      portalState.subjectCode = null;
      portalState.examId = null;
      renderStudentFlow();
    });
    bindRowNav(main, "[data-exam-id]", (el) => {
      if (blockActionIfExamActive()) return;
      if (el.getAttribute("data-exam-locked") === "1") {
        let msg = main.querySelector(".student-exam-locked-msg");
        if (!msg) {
          main.querySelector(".panel")?.insertAdjacentHTML(
            "beforeend",
            `<p class="error student-exam-locked-msg">Тест ещё не опубликован. Подождите, пока администрация откроет сдачу.</p>`
          );
          msg = main.querySelector(".student-exam-locked-msg");
        }
        msg?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      const eid = Number(el.getAttribute("data-exam-id"));
      portalState.openExamAsReview = el.getAttribute("data-exam-submitted") === "1";
      portalState.studentExamReturnHome = false;
      portalState.adminView = "exam";
      portalState.examId = eid;
      renderStudentFlow();
    });
    updateBreadcrumbs();
    return;
  }

  if (portalState.adminView === "exam") {
    try {
      await renderStudentExamPreview(main);
    } catch (err) {
      console.error("portal student exam", err);
      if (err.message === "exam_not_published") {
        main.innerHTML = `
        <button type="button" class="btn-ghost btn-back" id="btn-student-fallback-back">← К тестам</button>
        <div class="panel panel-wait"><p class="wait-title">Тест пока недоступен</p>
        <p class="muted">Экзамен ещё не опубликован. Зайдите позже.</p></div>`;
        $("btn-student-fallback-back")?.addEventListener("click", () => {
          portalState.adminView = "subject";
          renderStudentFlow();
        });
        return;
      }
      main.innerHTML = `
        <p class="error">Не удалось открыть тест.</p>
        <button type="button" class="btn-ghost btn-back" id="btn-student-fallback-back">← На главную</button>`;
      $("btn-student-fallback-back")?.addEventListener("click", () => {
        portalState.adminView = "home";
        portalState.examId = null;
        renderStudentFlow();
      });
      updateBreadcrumbs();
    }
  }
}

async function renderDashboard(session) {
  portalState.session = session;
  portalState.adminView = "home";
  portalState.className = session.user.class_name || null;
  portalState.subjectCode = null;
  portalState.examId = null;
  portalState.examTitle = null;
  portalState.subjectTitle = null;

  $("app-school-name").textContent = session.school_name || "";
  const role = session.user?.role || "";
  const roleLabel = ROLE_LABEL[role] || role;
  const userLineEl = $("app-user-line");
  userLineEl.hidden = false;
  userLineEl.textContent = `${session.user.full_name} · ${roleLabel}`;
  showApp();

  if (role === "admin") {
    await renderAdminFlow();
  } else if (role === "student") {
    try {
      await renderStudentFlow();
    } catch (err) {
      console.error("portal student home", err);
      const hint =
        err?.message === "no_class"
          ? "У учётной записи не указан класс — обратитесь к администратору."
          : "Обновите страницу (Ctrl+F5). Если не помогло — перезапустите портал: ./run.sh";
      $("app-main").innerHTML = `<p class="error">Не удалось загрузить кабинет ученика.</p><p class="muted">${escapeHtml(hint)}</p>`;
    }
  } else {
    $("app-main").innerHTML = `
      <div class="panel"><p class="muted">Для этой роли кабинет пока не настроен.</p></div>
    `;
  }
}

async function loadLanding() {
  try {
    const data = await api("/api/public/landing");
    if (data.school_name) {
      $("landing-school-name").textContent = data.school_name;
    }
  } catch {
    $("landing-sub").textContent =
      "Не удалось загрузить data/portal.json — проверьте GitHub Pages и файл data/portal.json";
  }
}

async function enrichSessionSchoolName(session) {
  if (session.school_name) return session;
  if (!useSiteData()) return session;
  try {
    const land = await dataApi("/api/public/landing");
    session.school_name = land.school_name;
  } catch {
    session.school_name = "Школа";
  }
  return session;
}

async function tryRestoreSession() {
  try {
    const session = await enrichSessionSchoolName(await api("/api/me"));
    await renderDashboard(session);
    return true;
  } catch {
    showAuth();
    return false;
  }
}

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthError("");
  const btn = $("btn-submit");
  btn.disabled = true;
  try {
    const session = await enrichSessionSchoolName(
      await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          login: $("input-login").value.trim(),
          password: $("input-password").value,
        }),
      })
    );
    await renderDashboard(session);
  } catch (err) {
    const msg =
      err.message === "invalid_credentials"
        ? "Неверный логин или пароль"
        : "Ошибка входа. Попробуйте снова.";
    setAuthError(msg);
  } finally {
    btn.disabled = false;
  }
});

$("btn-logout").addEventListener("click", async () => {
  if (blockActionIfExamActive()) return;
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
  } catch {
    /* ignore */
  }
  portalState.session = null;
  showAuth();
  $("input-password").value = "";
});

$("btn-theme-auth").addEventListener("click", () => {
  if (blockActionIfExamActive()) return;
  toggleTheme();
});
$("btn-theme-app").addEventListener("click", () => {
  if (blockActionIfExamActive()) return;
  toggleTheme();
});

$("exam-guard-ok")?.addEventListener("click", () => hideExamGuardModal());
syncThemeIcons();

initScrollTopButton();
await loadLanding();
await tryRestoreSession();
