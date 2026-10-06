/**
 * Школьный портал — только ВХОД (логин/пароль из Google Таблицы).
 * Все тесты, классы и контент — в репозитории на GitHub (data/portal.json).
 */
var SESSION_TTL_SEC = 604800;

function doGet(e) {
  e = e || { parameter: {} };
  if (String(e.parameter.api || '') === '1') {
    return handleHttpApi_(e.parameter.token, e.parameter.path, e.parameter.method, e.parameter.body || '');
  }
  return HtmlService.createHtmlOutput(
    '<p>API входа для школьного портала. Сайт: GitHub Pages. ' +
      'Разверните как веб-приложение и укажите URL в portal-config.js</p>'
  ).setTitle('Школьный портал — вход');
}

function doPost(e) {
  e = e || {};
  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var envelope = JSON.parse(raw);
    return handleHttpApi_(
      envelope.token,
      envelope.path,
      envelope.method,
      envelope.body == null ? '' : String(envelope.body)
    );
  } catch (err) {
    return jsonErr_(err.message || String(err));
  }
}

function handleHttpApi_(token, path, method, bodyJson) {
  try {
    var data = apiRoute(token, path, method, bodyJson);
    return jsonOk_(data);
  } catch (err) {
    return jsonErr_(err.message || String(err));
  }
}

function jsonOk_(data) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr_(detail) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, detail: String(detail || 'error') }))
    .setMimeType(ContentService.MimeType.JSON);
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'users', [
    'login', 'password', 'role', 'full_name', 'class_name', 'id',
  ], [
    ['admin', 'admin123', 'admin', 'Главный админ', '', 1],
    ['teacher', 'teacher123', 'teacher', 'Абдурашид (учитель)', '', 2],
    ['student1', 'student123', 'student', 'Алиев Дилшод', '6Б', 4],
  ]);
  SpreadsheetApp.getUi().alert(
    'Лист users готов (только вход). Контент портала — в GitHub, файл data/portal.json.'
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
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
}

/** Только авторизация (для GitHub Pages). */
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
  if (path === '/api/login' && method === 'POST') {
    return apiLogin(body.login, body.password);
  }
  if (path === '/api/logout' && method === 'POST') {
    return apiLogout(token);
  }
  if (path === '/api/me' && method === 'GET') {
    return apiMe(token);
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
  };
}

function apiMe(token) {
  var user = userFromToken_(token);
  if (!user) {
    throw new Error('not_authenticated');
  }
  return { user: user };
}

function apiLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove('sess_' + token);
  }
  return { status: 'ok' };
}

function readUsers_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('users');
  if (!sheet) {
    return [];
  }
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    out.push({
      login: String(data[r][0]),
      password: String(data[r][1]),
      role: String(data[r][2] || 'student'),
      full_name: String(data[r][3] || ''),
      class_name: data[r][4] ? String(data[r][4]) : null,
      id: Number(data[r][5]) || r,
    });
  }
  return out;
}

function publicUser_(row) {
  return {
    id: row.id,
    login: row.login,
    full_name: row.full_name,
    role: row.role,
    class_name: row.class_name,
    staff_title: null,
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
