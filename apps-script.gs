/**
 * Wedding e-invite backend: RSVPs and wishes go into this Google Sheet.
 *
 * SETUP (one time)
 *  1. Create a new Google Sheet (e.g. "Ashrith & Veena · RSVPs").
 *  2. Extensions → Apps Script. Delete the sample code, paste this whole file, Save.
 *  3. Deploy → New deployment → gear icon → Web app.
 *       Execute as: Me        Who has access: Anyone
 *     Click Deploy and allow the permissions it asks for.
 *  4. Copy the Web app URL (ends in /exec) into CONFIG.endpoint in index.html.
 *     The "RSVPs" and "Wishes" tabs are created automatically on the first submission.
 *
 * MODERATION
 *  To hide a wish from the wall, type x in its "Hide" column.
 *
 * AFTER EDITING THIS SCRIPT
 *  Deploy → Manage deployments → pencil (Edit) → Version: New version → Deploy.
 *  This keeps the same /exec URL, so index.html doesn't need changing.
 */

const RSVP_SHEET = "RSVPs";
const RSVP_HEAD = ["Updated", "Name", "Phone", "Attending", "Adults", "Children", "Total", "Family members", "Note", "ID"];
const RSVP_ID_COL = 10;

const WISH_SHEET = "Wishes";
const WISH_HEAD = ["Posted", "Name", "Wish", "Hide"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const data = JSON.parse(e.postData.contents);
    if (data.type === "rsvp") saveRsvp_(data);
    else if (data.type === "wish") saveWish_(data);
    else throw new Error("Unknown type");
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action !== "wishes") return json_({ ok: false, error: "Unknown action" });
  const sh = sheet_(WISH_SHEET, WISH_HEAD);
  const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues() : [];
  const wishes = rows
    .filter(r => r[1] && r[2] && !String(r[3]).trim())          // anything in Hide (e.g. "x") hides it
    .map(r => ({ at: toIso_(r[0]), name: String(r[1]), message: String(r[2]) }))
    .reverse()                                                   // newest first
    .slice(0, 200);
  return json_({ ok: true, wishes: wishes });
}

function saveRsvp_(d) {
  const id = clip_(d.id, 64);
  const name = clip_(d.name, 80);
  if (!id || !name) throw new Error("Name is required");
  const yes = d.attending !== "no";
  const adults = yes ? int_(d.adults, 1, 15) : 0;
  const children = yes ? int_(d.children, 0, 10) : 0;
  const guests = yes && Array.isArray(d.guests)
    ? d.guests.slice(0, 25).map(g => clip_(g, 60)).filter(String)
    : [];
  const row = [
    new Date(), text_(name), text_(clip_(d.phone, 20)), yes ? "yes" : "no",
    adults, children, adults + children,                         // total recomputed here, never trusted from the client
    text_(guests.join(", ")), text_(clip_(d.message, 500)), text_(id)
  ];

  const sh = sheet_(RSVP_SHEET, RSVP_HEAD);
  const last = sh.getLastRow();
  if (last > 1) {
    const ids = sh.getRange(2, RSVP_ID_COL, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {                            // same guest re-submitting → update their row
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }
  sh.appendRow(row);
}

function saveWish_(d) {
  const name = clip_(d.name, 60);
  const msg = clip_(d.message, 400);
  if (!name || !msg) throw new Error("Name and wish are required");
  sheet_(WISH_SHEET, WISH_HEAD).appendRow([new Date(), text_(name), text_(msg), ""]);
}

// Helpers

function sheet_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function clip_(v, n) {
  return String(v == null ? "" : v).trim().slice(0, n);
}

function int_(v, lo, hi) {
  const n = Math.floor(Number(v));
  return Math.min(hi, Math.max(lo, isFinite(n) ? n : lo));
}

// Keep guest text as plain text: a leading = + - @ would otherwise be read as a formula
// (and "+91…" phone numbers would lose their plus sign).
function text_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function toIso_(v) {
  return v instanceof Date ? v.toISOString() : String(v);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
