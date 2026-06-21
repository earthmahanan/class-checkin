/**
 * Google Apps Script — Class Check-in Web App
 *
 * Deploy as: Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Create a Google Sheet with these column headers in row 1:
 *   timestamp | student_id | email | session_token | latitude | longitude | distance_m | accuracy_m
 */

// ── Configuration ──
const CONFIG = {
  API_KEY: 'change-this-api-key',
  GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  ALLOWED_EMAIL_DOMAINS: ['gmail.com'], // empty array = allow any verified Google email
  SHEET_NAME: 'Checkins',
  CLASSROOM_LAT: 13.7563,
  CLASSROOM_LNG: 100.5018,
  RADIUS_METERS: 100,
};

/**
 * Handle POST requests from the check-in frontend.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.apiKey !== CONFIG.API_KEY) {
      return jsonResponse({ error: 'Invalid API key' }, 403);
    }

    const studentId = String(data.studentId || '').trim();
    const sessionToken = String(data.sessionToken || '').trim();
    const idToken = String(data.idToken || '').trim();
    const latitude = parseFloat(data.latitude);
    const longitude = parseFloat(data.longitude);
    const accuracy = data.accuracy != null ? parseFloat(data.accuracy) : '';

    if (!studentId || !sessionToken || !idToken) {
      return jsonResponse({ error: 'Student ID, Gmail sign-in, and session token are required' }, 400);
    }

    const googleUser = verifyGoogleIdToken(idToken);
    if (!googleUser) {
      return jsonResponse({ error: 'Invalid or expired Google sign-in. Please sign in again.' }, 403);
    }

    const email = String(googleUser.email || '').trim().toLowerCase();
    if (!email) {
      return jsonResponse({ error: 'Valid Gmail address is required' }, 400);
    }

    if (!isAllowedEmailDomain(email)) {
      return jsonResponse({ error: 'Please sign in with an allowed Gmail account' }, 403);
    }

    if (isNaN(latitude) || isNaN(longitude)) {
      return jsonResponse({ error: 'Valid coordinates are required' }, 400);
    }

    if (!/^[a-zA-Z0-9\-_]{1,32}$/.test(studentId)) {
      return jsonResponse({ error: 'Invalid Student ID format' }, 400);
    }

    const distance = haversineDistance(
      latitude,
      longitude,
      CONFIG.CLASSROOM_LAT,
      CONFIG.CLASSROOM_LNG
    );

    if (distance > CONFIG.RADIUS_METERS) {
      return jsonResponse({
        error: 'You are not in the classroom',
        distance: Math.round(distance),
      }, 403);
    }

    const sheet = getSheet();

    if (isDuplicate(sheet, email, sessionToken)) {
      return jsonResponse({ error: 'You have already checked in for this session' }, 409);
    }

    const timestamp = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    );

    sheet.appendRow([
      timestamp,
      studentId,
      email,
      sessionToken,
      latitude,
      longitude,
      Math.round(distance * 10) / 10,
      accuracy !== '' ? Math.round(accuracy * 10) / 10 : '',
    ]);

    return jsonResponse({
      success: true,
      message: 'Check-in successful!',
      timestamp: timestamp,
    });
  } catch (err) {
    return jsonResponse({ error: err.message || 'Server error' }, 500);
  }
}

/**
 * Handle GET (health check / CORS preflight workaround).
 */
function doGet() {
  return jsonResponse({ status: 'ok', service: 'class-checkin' });
}

// ── Helpers ──

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'timestamp',
      'student_id',
      'email',
      'session_token',
      'latitude',
      'longitude',
      'distance_m',
      'accuracy_m',
    ]);
  }
  return sheet;
}

function isDuplicate(sheet, email, sessionToken) {
  const data = sheet.getDataRange().getValues();
  const normalizedEmail = String(email).toLowerCase();
  for (let i = 1; i < data.length; i++) {
    const rowEmail = String(data[i][2] || data[i][1] || '').toLowerCase();
    const rowSession = String(data[i][3] || data[i][2] || '');
    if (rowEmail === normalizedEmail && rowSession === sessionToken) {
      return true;
    }
  }
  return false;
}

function verifyGoogleIdToken(idToken) {
  try {
    const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      return null;
    }

    const payload = JSON.parse(response.getContentText());
    if (payload.error_description) {
      return null;
    }
    if (payload.aud !== CONFIG.GOOGLE_CLIENT_ID) {
      return null;
    }
    if (String(payload.email_verified) !== 'true') {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

function isAllowedEmailDomain(email) {
  const domains = CONFIG.ALLOWED_EMAIL_DOMAINS || [];
  if (!domains.length) {
    return true;
  }
  const domain = String(email).split('@')[1] || '';
  return domains.indexOf(domain.toLowerCase()) !== -1;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jsonResponse(obj, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  // Apps Script doesn't support custom HTTP status codes directly,
  // but the client checks the JSON body for errors.
  return output;
}
