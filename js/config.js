/**
 * Class Check-in Configuration
 * Update these values for your deployment.
 */
const CONFIG = {
  // ── Classroom location (update to your lecture hall coordinates) ──
  classroom: {
    latitude: 18.826818,   // Example: Bangkok — replace with your coords
    longitude: 98.984067,
    radiusMeters: 2500,
  },

  // ── Storage backend: "php" or "google" ──
  storageMode: "google",

  // PHP endpoint (relative path works when hosted on same server)
  phpApiUrl: "api/checkin.php",

  // Google Apps Script Web App URL (deploy Code.gs first, paste URL here)
  googleApiUrl: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",

  // Shared secret used to validate session tokens (must match lecturer page)
  sessionSecret: "change-this-to-a-long-random-string",

  // Optional API key sent with requests (must match server-side setting)
  apiKey: "JEHU803DJFISD329",

  // Google Sign-In (OAuth 2.0 Web client ID from Google Cloud Console)
  googleClientId: "1060381587593-er7rmh2q3cb7mrfgpe4mt7pjhf60o5i2.apps.googleusercontent.com",

  // Restrict sign-in to these email domains (empty = any Gmail/Google account)
  allowedEmailDomains: ["gmail.com"],
};
