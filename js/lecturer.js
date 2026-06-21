(function () {
  "use strict";

  const generateBtn = document.getElementById("generate-btn");
  const qrContainer = document.getElementById("qr-container");
  const sessionInfo = document.getElementById("session-info");
  const checkinLink = document.getElementById("checkin-link");
  const copyLinkBtn = document.getElementById("copy-link-btn");

  function generateSessionToken() {
    const date = new Date().toISOString().slice(0, 10);
    const raw = `${date}:${CONFIG.sessionSecret}:${Math.random().toString(36).slice(2)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return `${date}-${Math.abs(hash).toString(36)}`;
  }

  function buildCheckinUrl(token) {
    const base = window.location.href.replace(/lecturer\.html.*$/, "index.html");
    return `${base}?session=${encodeURIComponent(token)}`;
  }

  function renderQr(url) {
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: url,
      width: 256,
      height: 256,
      colorDark: "#1e293b",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  generateBtn.addEventListener("click", () => {
    const token = generateSessionToken();
    const url = buildCheckinUrl(token);

    renderQr(url);

    sessionInfo.textContent = `Session token: ${token}`;
    sessionInfo.classList.remove("hidden");

    checkinLink.href = url;
    checkinLink.textContent = url;
    checkinLink.classList.remove("hidden");

    copyLinkBtn.classList.remove("hidden");
  });

  copyLinkBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(checkinLink.href);
      copyLinkBtn.textContent = "Copied!";
      setTimeout(() => {
        copyLinkBtn.textContent = "Copy link";
      }, 2000);
    } catch {
      copyLinkBtn.textContent = "Copy failed";
    }
  });
})();
