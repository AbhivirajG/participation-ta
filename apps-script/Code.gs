/**
 * Participation TA — Google Sheet sync endpoint.
 *
 * Paste this into Extensions → Apps Script on the class participation sheet and
 * deploy as a Web app (Execute as: Me, Who has access: Anyone). The web app
 * POSTs JSON here; nothing else calls it.
 *
 * Sheet layout it expects (the existing per-class tabs, e.g. "9/14", "9/16"):
 *   A6:F  Time | Student | Type | What they said | Points | Transcript check
 *   G5    "App ID" — written by this script; hidden-ish column that lets a row
 *         be updated in place when the TA edits it in the app.
 *   I6:I  roster,  J/K roll-up (Entries / Points) — formulas written here
 *   L6    end-of-class note
 *   B2    class date
 * "Attendance" tab: Net ID | First | Last | one column per class date (row 1).
 */

var LOG_FIRST_ROW = 6;
var LOG_COLS = 6;           // A..F
var ID_COL = 7;             // G
var ROSTER_COL = 9;         // I
var ROLLUP_COL = 10;        // J (entries), K (points)
var NOTE_CELL = 'L6';
var DATE_CELL = 'B2';

function doGet() {
  return json_({ ok: true, version: 1, tabs: tabNames_() });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'ping') return json_({ ok: true, version: 1, tabs: tabNames_() });
    if (body.action === 'sync') return json_(sync_(body));
    if (body.action === 'roster') return json_(roster_(body.tab));
    return json_({ ok: false, error: 'unknown action: ' + body.action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function tabNames_() {
  return SpreadsheetApp.getActive().getSheets().map(function (s) { return s.getName(); });
}

function sync_(body) {
  if (!body.tab) throw new Error('missing tab name');
  var ss = SpreadsheetApp.getActive();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var warnings = [];
    var sh = ss.getSheetByName(body.tab);
    if (!sh) { sh = createClassTab_(ss, body.tab); warnings.push('created tab "' + body.tab + '"'); }

    // Where the log can grow to: stop before the "Scoring key" block.
    var scoringRow = findInColA_(sh, 'Scoring key');
    var logEnd = scoringRow ? scoringRow - 2 : Math.max(sh.getLastRow(), LOG_FIRST_ROW + 50);
    if (logEnd < LOG_FIRST_ROW) logEnd = LOG_FIRST_ROW;

    sh.getRange(5, ID_COL).setValue('App ID');
    var n = logEnd - LOG_FIRST_ROW + 1;
    var ids = sh.getRange(LOG_FIRST_ROW, ID_COL, n, 1).getValues();
    var body6 = sh.getRange(LOG_FIRST_ROW, 1, n, LOG_COLS).getValues();
    var idRow = {}, freeRows = [];
    for (var i = 0; i < n; i++) {
      var id = String(ids[i][0] || '');
      if (id) idRow[id] = LOG_FIRST_ROW + i;
      else if (body6[i].every(function (v) { return v === '' || v === null; })) freeRows.push(LOG_FIRST_ROW + i);
    }

    var updated = 0, appended = 0;
    (body.rows || []).forEach(function (r) {
      var values = [[
        r.timeText ? r.timeText : (r.t ? new Date(r.t) : ''),
        r.student || '', r.type || '', r.note || '',
        (r.points === '' || r.points == null) ? '' : Number(r.points),
        r.transcript || ''
      ]];
      var row = idRow[r.id];
      if (row) { updated++; }
      else {
        if (freeRows.length) row = freeRows.shift();
        else { // out of room: insert a row above the scoring key (or at the end)
          var at = scoringRow ? scoringRow - 1 : sh.getLastRow() + 1;
          sh.insertRowBefore(at); row = at; if (scoringRow) scoringRow++;
        }
        idRow[r.id] = row; appended++;
      }
      sh.getRange(row, 1, 1, LOG_COLS).setValues(values);
      sh.getRange(row, ID_COL).setValue(r.id);
    });

    // Roll-up formulas next to the roster (I6:I…): entries and points per student.
    var rosterVals = sh.getRange(LOG_FIRST_ROW, ROSTER_COL, 80, 1).getValues();
    var lastLog = Math.max(logEnd, LOG_FIRST_ROW + 1);
    for (var k = 0; k < rosterVals.length; k++) {
      if (!rosterVals[k][0]) continue;
      var rr = LOG_FIRST_ROW + k;
      sh.getRange(rr, ROLLUP_COL).setFormula('=COUNTIF($B$' + LOG_FIRST_ROW + ':$B$' + lastLog + ',I' + rr + ')');
      sh.getRange(rr, ROLLUP_COL + 1).setFormula('=SUMIF($B$' + LOG_FIRST_ROW + ':$B$' + lastLog + ',I' + rr + ',$E$' + LOG_FIRST_ROW + ':$E$' + lastLog + ')');
    }

    if (typeof body.endNote === 'string') sh.getRange(NOTE_CELL).setValue(body.endNote);
    if (body.classDate) {
      var cur = sh.getRange(DATE_CELL).getValue();
      if (!(cur instanceof Date)) sh.getRange(DATE_CELL).setValue(parseISODate_(body.classDate));
    }

    if (body.attendance && body.classDate) applyAttendance_(ss, body.classDate, body.attendance, warnings);

    return { ok: true, updated: updated, appended: appended, tab: sh.getName(), warnings: warnings };
  } finally {
    lock.releaseLock();
  }
}

/** Roster = column I of the requested tab, or of the most recent numeric tab. */
function roster_(tab) {
  var ss = SpreadsheetApp.getActive();
  var sh = tab ? ss.getSheetByName(tab) : null;
  if (!sh) {
    var numeric = ss.getSheets().filter(function (s) { return /^\d+\/\d+$/.test(s.getName()); });
    sh = numeric.length ? numeric[numeric.length - 1] : null;
  }
  if (!sh) throw new Error('no class tab found');
  var names = sh.getRange(LOG_FIRST_ROW, ROSTER_COL, 100, 1).getValues()
    .map(function (r) { return String(r[0]).trim(); }).filter(Boolean);
  return { ok: true, tab: sh.getName(), names: names };
}

/** New class tab = copy of the most recent date-named tab (e.g. "9/16"), with the log cleared. */
function createClassTab_(ss, name) {
  var sheets = ss.getSheets();
  var numeric = sheets.filter(function (s) { return /^\d+\/\d+$/.test(s.getName()); });
  var tpl = numeric.length ? numeric[numeric.length - 1] : sheets[sheets.length - 1];
  var sh = tpl.copyTo(ss).setName(name);
  ss.setActiveSheet(sh); ss.moveActiveSheet(ss.getNumSheets());
  var scoringRow = findInColA_(sh, 'Scoring key');
  var end = scoringRow ? scoringRow - 2 : sh.getMaxRows();
  if (end >= LOG_FIRST_ROW) sh.getRange(LOG_FIRST_ROW, 1, end - LOG_FIRST_ROW + 1, ID_COL).clearContent();
  sh.getRange(NOTE_CELL).clearContent();
  sh.getRange(DATE_CELL).clearContent();
  var rosterN = sh.getRange(LOG_FIRST_ROW, ROSTER_COL, 80, 1).getValues().filter(function (r) { return r[0]; }).length;
  if (rosterN) sh.getRange(LOG_FIRST_ROW, ROLLUP_COL, rosterN, 2).clearContent();
  return sh;
}

function findInColA_(sh, text) {
  var vals = sh.getRange(1, 1, sh.getLastRow() || 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === text) return i + 1;
  return 0;
}

function parseISODate_(iso) {
  var p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
}

/** Attendance tab: find the column whose header date matches classDate, write 1 / 0.5 / 0 / '' per student. */
function applyAttendance_(ss, classDate, attendance, warnings) {
  var sh = ss.getSheetByName('Attendance');
  if (!sh) { warnings.push('no "Attendance" tab'); return; }
  var want = parseISODate_(classDate);
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var col = 0;
  for (var c = 3; c < header.length; c++) {
    var v = header[c];
    if (v instanceof Date && v.getFullYear() === want.getFullYear() && v.getMonth() === want.getMonth() && v.getDate() === want.getDate()) { col = c + 1; break; }
  }
  if (!col) { warnings.push('Attendance tab has no column for ' + classDate); return; }
  var names = sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues();
  var rowOf = {};
  names.forEach(function (r, i) { var full = (String(r[0]).trim() + ' ' + String(r[1]).trim()).trim(); if (full) rowOf[full.toLowerCase()] = i + 2; });
  var missing = [];
  Object.keys(attendance).forEach(function (name) {
    var row = rowOf[name.toLowerCase()];
    if (!row) { missing.push(name); return; }
    var v = attendance[name];
    sh.getRange(row, col).setValue(v === '' || v == null ? '' : Number(v));
  });
  if (missing.length) warnings.push('not on Attendance tab: ' + missing.join(', '));
}
