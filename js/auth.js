(function () {
  "use strict";

  let googleUser = null;

  const authSection = document.getElementById("auth-section");
  const authPrompt = document.getElementById("auth-prompt");
  const authSignedIn = document.getElementById("auth-signed-in");
  const authEmail = document.getElementById("auth-email");
  const authError = document.getElementById("auth-error");
  const signOutBtn = document.getElementById("sign-out-btn");

  function parseJwt(token) {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  }

  function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove("hidden");
  }

  function hideAuthError() {
    authError.classList.add("hidden");
  }

  function isAllowedEmail(email) {
    const domains = CONFIG.allowedEmailDomains || [];
    if (!domains.length) return true;
    const domain = email.split("@")[1] || "";
    return domains.includes(domain);
  }

  function updateAuthUI() {
    if (googleUser) {
      authPrompt.classList.add("hidden");
      authSignedIn.classList.remove("hidden");
      authEmail.textContent = googleUser.email;
      hideAuthError();
    } else {
      authPrompt.classList.remove("hidden");
      authSignedIn.classList.add("hidden");
      authEmail.textContent = "";
    }

    document.dispatchEvent(
      new CustomEvent("auth-changed", { detail: { user: googleUser } })
    );
  }

  function handleCredentialResponse(response) {
    hideAuthError();

    try {
      const payload = parseJwt(response.credential);
      const email = payload.email || "";

      if (payload.email_verified !== true && payload.email_verified !== "true") {
        showAuthError("Please verify your Google account email first.");
        return;
      }

      if (!isAllowedEmail(email)) {
        const hint =
          CONFIG.allowedEmailDomains.length === 1
            ? `@${CONFIG.allowedEmailDomains[0]}`
            : "your university Gmail";
        showAuthError(`Please sign in with ${hint}.`);
        return;
      }

      googleUser = {
        email,
        name: payload.name || email,
        idToken: response.credential,
      };
      updateAuthUI();
    } catch {
      showAuthError("Sign-in failed. Please try again.");
    }
  }

  function initGoogleAuth() {
    if (!CONFIG.googleClientId || CONFIG.googleClientId.includes("YOUR_CLIENT_ID")) {
      showAuthError(
        "Google Sign-In is not configured. Set googleClientId in js/config.js."
      );
      return;
    }

    if (typeof google === "undefined" || !google.accounts) {
      showAuthError("Google Sign-In failed to load. Check your connection.");
      return;
    }

    const initOptions = {
      client_id: CONFIG.googleClientId,
      callback: handleCredentialResponse,
      auto_select: false,
    };

    if (CONFIG.allowedEmailDomains?.length === 1) {
      initOptions.hd = CONFIG.allowedEmailDomains[0];
    }

    google.accounts.id.initialize(initOptions);

    const btnContainer = document.getElementById("google-signin-btn");
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        theme: "outline",
        size: "large",
        width: 280,
        text: "signin_with",
        shape: "rectangular",
      });
    }
  }

  signOutBtn?.addEventListener("click", () => {
    googleUser = null;
    if (google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
    updateAuthUI();
  });

  window.getGoogleUser = () => googleUser;
  window.isGoogleSignedIn = () => googleUser !== null;

  document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
    if (typeof google !== "undefined" && google.accounts) {
      initGoogleAuth();
    } else {
      window.onload = initGoogleAuth;
    }
  });
})();
