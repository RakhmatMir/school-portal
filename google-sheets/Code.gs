/**
 * Школьный портал — backend (Google Apps Script).
 * Привязан к таблице «Школьный портал».
 */
var SESSION_TTL_SEC = 604800; // 7 days

function doGet() {
  return HtmlService.createHtmlOutputFromFile('WebApp')
    .setTitle('Школьный портал')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, 'users', [
    'login',
    'password',
    'role',
    'full_name',
    'class_name',
  ], [
    ['admin', 'admin123', 'admin', 'Главный админ', ''],
    ['teacher', 'teacher123', 'teacher', 'Абдурашид (учитель)', ''],
    ['student1', 'student123', 'student', 'Алиев Дилшод', '6Б'],
  ]);
  ensureSheet_(ss, 'config', ['key', 'value'], [
    ['school_name', 'Foundation School — демо'],
  ]);
  ensureSheet_(ss, 'classes', ['class_name', 'student_count', 'test_count'], [
    ['6Б', 24, 5],
    ['7-A', 22, 4],
    ['8-A', 26, 6],
  ]);
  SpreadsheetApp.getUi().alert('Листы готовы: users, config, classes. Опубликуйте Web App (см. SETUP-RU.md).');
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
    // getRange(row, col, numRows, numCols) — не lastRow
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
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
  var cache = CacheService.getScriptCache();
  cache.put('sess_' + token, JSON.stringify(publicUser_(found)), SESSION_TTL_SEC);
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

function apiPortalClasses(token) {
  var user = requireStaff_(token);
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

function apiPublicLanding() {
  return {
    has_schools: true,
    school_name: getConfig_('school_name') || 'Школа',
  };
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

function publicUser_(row) {
  return {
    id: row.login,
    login: row.login,
    full_name: row.full_name,
    role: row.role,
    class_name: row.class_name,
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
  if (!user) {
    throw new Error('not_authenticated');
  }
  if (user.role !== 'admin' && user.role !== 'teacher') {
    throw new Error('forbidden');
  }
  return user;
}
