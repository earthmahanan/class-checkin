/**
 * Class Check-in Configuration
 * Update these values for your deployment.
 */
const CONFIG = {
  // ── Classroom location (update to your lecture hall coordinates) ──
  classroom: {
    latitude: 18.7995874, // ilc  //18.826818 plamv Example: Bangkok — replace with your coords
    longitude: 98.9508825, // ilc //98.984067 plamv
    radiusMeters: 2500,
  },

  // ── Storage backend: "php" or "google" ──
  storageMode: "google",

  // PHP endpoint (relative path works when hosted on same server)
  phpApiUrl: "api/checkin.php",

  // Google Apps Script Web App URL (deploy Code.gs first, paste URL here)
  googleApiUrl: "https://script.google.com/macros/s/AKfycbxAs7U1yND_cQncSxyHDavY5M8b2m-y0p2x9BC4l9rbw-LsnYwGU1SilHqIcheDPY8JgQ/exec",

  // Shared secret used to validate session tokens (must match lecturer page)
  sessionSecret: "change-this-to-a-long-random-string",

  // Optional API key sent with requests (must match server-side setting)
  apiKey: "JEHU803DJFISD329",

  // Google Sign-In (OAuth 2.0 Web client ID from Google Cloud Console)
  googleClientId: "1060381587593-er7rmh2q3cb7mrfgpe4mt7pjhf60o5i2.apps.googleusercontent.com",

  // Restrict sign-in to these email domains (empty = any Gmail/Google account)
  allowedEmailDomains: ["gmail.com"],
};
