# Class Check-in System

A lightweight, mobile-responsive lecture check-in site with geolocation verification and QR session tokens. No MySQL required — data is stored in a CSV file (PHP) or Google Sheet (Apps Script).

## Project structure

```
class_checkin/
├── index.html              # Student check-in page
├── lecturer.html           # Lecturer QR session generator
├── js/
│   ├── config.js           # Shared settings (coords, API URLs, secrets)
│   ├── geo.js              # Haversine distance calculation
│   ├── checkin.js          # Student check-in logic
│   └── lecturer.js         # Session token + QR generation
├── api/
│   └── checkin.php         # PHP backend → data/checkins.csv
├── google-apps-script/
│   └── Code.gs             # Google Sheets backend (alternative)
├── data/
│   ├── .htaccess           # Blocks direct download of CSV
│   └── checkins.csv        # Created automatically on first check-in
└── README.md
```

## How it works

1. **Lecturer** opens `lecturer.html` and clicks **Start new session** — a unique QR code appears.
2. **Student** scans the QR (or opens the link) — this loads `index.html?session=TOKEN`.
3. **Student** enters their Student ID and taps **Check in**.
4. The browser requests GPS location; if within **100 m** of the classroom, the check-in is saved.
5. Duplicate check-ins for the same student + session are rejected.

---

## Step 1 — Configure classroom coordinates

Edit `js/config.js` and set your lecture hall GPS coordinates:

```javascript
classroom: {
  latitude: 13.7563,   // your classroom latitude
  longitude: 100.5018, // your classroom longitude
  radiusMeters: 100,
},
```

**Finding coordinates:** Open [Google Maps](https://maps.google.com), right-click your classroom building → copy latitude/longitude.

Also update the same coordinates in:
- `api/checkin.php` (`CLASSROOM_LAT`, `CLASSROOM_LNG`)
- `google-apps-script/Code.gs` (`CONFIG.CLASSROOM_LAT`, `CONFIG.CLASSROOM_LNG`) if using Google Sheets

Change `sessionSecret` and `apiKey` to long random strings, and use the **same `apiKey`** in your chosen backend.

---

## Step 2 — Choose a storage backend

Set `storageMode` in `js/config.js`:

| Value    | Backend        |
|----------|----------------|
| `"php"`  | CSV file (default) |
| `"google"` | Google Sheet |

---

## Option A — Deploy with PHP + CSV

### Requirements

- Web server with PHP 7.4+ (Apache, Nginx, MAMP, XAMPP, university hosting, etc.)
- HTTPS recommended (required for geolocation on most browsers)

### Deploy

1. Copy the entire `class_checkin` folder to your web root, e.g.:
   - MAMP/XAMPP: `htdocs/class_checkin`
   - Linux: `/var/www/html/class_checkin`

2. Set file permissions so PHP can write the CSV:

   ```bash
   mkdir -p data
   chmod 750 data
   chown www-data:www-data data   # Linux — user may be _www on macOS Apache
   ```

3. Update `api/checkin.php`:
   - `API_KEY` — must match `js/config.js`
   - `CLASSROOM_LAT` / `CLASSROOM_LNG` — your coordinates

4. Ensure `storageMode: "php"` and `phpApiUrl: "api/checkin.php"` in `js/config.js`.

5. Visit:
   - Student: `https://your-domain/class_checkin/`
   - Lecturer: `https://your-domain/class_checkin/lecturer.html`

### View check-in data

Open `data/checkins.csv` on the server (not via browser — `.htaccess` blocks direct access). Import into Excel or Google Sheets as needed.

### CSV columns

| Column         | Description                    |
|----------------|--------------------------------|
| timestamp      | UTC time of check-in           |
| student_id     | Student ID entered             |
| session_token  | Session from QR code           |
| latitude       | Student GPS latitude           |
| longitude      | Student GPS longitude          |
| distance_m     | Distance from classroom (m)    |
| accuracy_m     | GPS accuracy estimate          |
| ip_address     | Client IP (PHP only)           |

---

## Option B — Deploy with Google Sheets

### Setup the spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet named e.g. **Class Check-ins**.
2. Open **Extensions → Apps Script**.
3. Delete any default code and paste the contents of `google-apps-script/Code.gs`.
4. Update `CONFIG.API_KEY`, `CONFIG.CLASSROOM_LAT`, and `CONFIG.CLASSROOM_LNG` in the script.
5. Click **Save** (disk icon).

### Deploy as web app

1. Click **Deploy → New deployment**.
2. Click the gear icon → select **Web app**.
3. Settings:
   - **Description:** Class Check-in API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** and authorize the script when prompted.
5. Copy the **Web app URL** (ends in `/exec`).

### Connect the frontend

1. In `js/config.js`:
   ```javascript
   storageMode: "google",
   googleApiUrl: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec",
   apiKey: "same-key-as-in-Code.gs",
   ```
2. Host `index.html`, `lecturer.html`, and the `js/` folder on any static host (GitHub Pages, Netlify, your university server, etc.) — PHP is not required for this option.

### Re-deploy after code changes

Apps Script caches deployments. After editing `Code.gs`, use **Deploy → Manage deployments → Edit → New version → Deploy**.

---

## Step 3 — Test the flow

1. Open `lecturer.html` on your laptop → **Start new session** → QR appears.
2. On your phone (connected to HTTPS), scan the QR or open the link.
3. Allow location when prompted.
4. Enter a test Student ID and check in.
5. Verify a new row appears in `checkins.csv` or your Google Sheet.

**Geolocation note:** Browsers require a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (HTTPS or `localhost`) for GPS. Testing on `http://192.168.x.x` may fail unless you use localhost or HTTPS.

---

## Security notes

- The QR session token prevents students from checking in remotely without the day's code.
- Geolocation is verified on both the **client** (immediate feedback) and **server** (anti-tampering).
- Change default `apiKey` and `sessionSecret` before production use.
- The CSV directory is protected by `.htaccess`; do not remove it.
- This is suitable for attendance tracking, not high-security authentication.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Location permission denied" | Enable location for the browser; use HTTPS |
| "You are not in the classroom" | Verify classroom coordinates; GPS can be ±20–50 m indoors |
| "Failed to save check-in" (PHP) | Check `data/` folder permissions (750, writable by web server) |
| Google Sheets CORS error | Ensure `storageMode: "google"` uses `text/plain` POST (already configured) |
| Camera scanner not working | Use the direct link from the lecturer page instead |
| Duplicate check-in error | Expected — one check-in per student per session |

---

## Customization

- **Radius:** Change `radiusMeters` in `js/config.js` and `RADIUS_METERS` in the backend.
- **Styling:** Pages use [Tailwind CSS](https://tailwindcss.com) via CDN; edit classes in the HTML files.
- **Student ID format:** Adjust the regex in `api/checkin.php` and `Code.gs` if your IDs use different characters.
