(function () {
  "use strict";

  const form = document.getElementById("checkin-form");
  const studentIdInput = document.getElementById("student-id");
  const submitBtn = document.getElementById("submit-btn");
  const statusBox = document.getElementById("status-box");
  const scannerSection = document.getElementById("scanner-section");
  const sessionBadge = document.getElementById("session-badge");

  let sessionToken = null;
  let html5QrCode = null;

  // ── Session token from URL (?session=...) or QR scan ──
  function getSessionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("session");
  }

  function showStatus(message, type) {
    statusBox.textContent = message;
    statusBox.className =
      "rounded-lg px-4 py-3 text-sm font-medium " +
      (type === "success"
        ? "bg-green-100 text-green-800"
        : type === "error"
          ? "bg-red-100 text-red-800"
          : type === "loading"
            ? "bg-blue-100 text-blue-800"
            : "bg-gray-100 text-gray-700");
    statusBox.classList.remove("hidden");
  }

  function hideStatus() {
    statusBox.classList.add("hidden");
  }

  function setFormEnabled(enabled) {
    studentIdInput.disabled = !enabled;
    submitBtn.disabled = !enabled;
  }

  function activateSession(token) {
    sessionToken = token;
    sessionBadge.textContent = "Session active";
    sessionBadge.className =
      "inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800";
    if (scannerSection) scannerSection.classList.add("hidden");
    updateFormVisibility();
  }

  function updateFormVisibility() {
    if (sessionToken && window.isGoogleSignedIn?.()) {
      form.classList.remove("hidden");
    } else {
      form.classList.add("hidden");
    }
  }

  // ── Built-in QR scanner (html5-qrcode) ──
  function initScanner() {
    if (!scannerSection || typeof Html5Qrcode === "undefined") return;

    const sessionFromUrl = getSessionFromUrl();
    if (sessionFromUrl) {
      activateSession(sessionFromUrl);
      return;
    }

    html5QrCode = new Html5Qrcode("qr-reader");
    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const url = new URL(decodedText);
            const token = url.searchParams.get("session");
            if (token) {
              html5QrCode.stop().then(() => {
                activateSession(token);
                showStatus(
                  window.isGoogleSignedIn?.()
                    ? "QR code scanned. Enter your Student ID."
                    : "QR code scanned. Please sign in with Gmail to continue.",
                  "info"
                );
              });
            }
          } catch {
            showStatus("Invalid QR code. Please scan the lecturer's code.", "error");
          }
        },
        () => {}
      )
      .catch(() => {
        scannerSection.innerHTML =
          '<p class="text-sm text-amber-700">Camera unavailable. Ask your lecturer for the check-in link instead.</p>';
      });
  }

  // ── Geolocation + submit ──
  async function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => {
          const messages = {
            1: "Location permission denied. Please allow location access.",
            2: "Unable to determine your location.",
            3: "Location request timed out.",
          };
          reject(new Error(messages[err.code] || "Location error."));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  async function submitCheckin(payload) {
    const isGoogle = CONFIG.storageMode === "google";
    const url = isGoogle ? CONFIG.googleApiUrl : CONFIG.phpApiUrl;

    // text/plain avoids CORS preflight with Google Apps Script web apps
    const response = await fetch(url, {
      method: "POST",
      headers: isGoogle
        ? { "Content-Type": "text/plain;charset=utf-8" }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (data.error) {
      throw new Error(data.error);
    }
    if (!response.ok) {
      throw new Error("Check-in failed. Please try again.");
    }
    return data;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideStatus();

    if (!sessionToken) {
      showStatus("Please scan the session QR code first.", "error");
      return;
    }

    const googleUser = window.getGoogleUser?.();
    if (!googleUser) {
      showStatus("Please sign in with your Gmail account first.", "error");
      return;
    }

    const studentId = studentIdInput.value.trim();
    if (!studentId) {
      showStatus("Please enter your Student ID.", "error");
      return;
    }

    setFormEnabled(false);
    showStatus("Verifying location…", "loading");

    try {
      const location = await getLocation();
      const { allowed, distance } = isWithinClassroom(
        location.latitude,
        location.longitude,
        CONFIG.classroom
      );

      if (!allowed) {
        showStatus(
          `Error: You are not in the classroom (${Math.round(distance)} m away). Check-in blocked.`,
          "error"
        );
        setFormEnabled(true);
        return;
      }

      showStatus("Submitting check-in…", "loading");

      const result = await submitCheckin({
        studentId,
        email: googleUser.email,
        idToken: googleUser.idToken,
        sessionToken,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        apiKey: CONFIG.apiKey,
      });

      showStatus(result.message || "Check-in successful!", "success");
      studentIdInput.value = "";
    } catch (err) {
      showStatus(err.message || "An unexpected error occurred.", "error");
    } finally {
      setFormEnabled(true);
    }
  });

  document.addEventListener("auth-changed", updateFormVisibility);
  document.addEventListener("DOMContentLoaded", initScanner);
})();
