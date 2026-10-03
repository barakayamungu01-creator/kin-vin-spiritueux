(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const cfg = window.KINVINS_SUPABASE_CONFIG || {};
    const form = document.getElementById("forgotPasswordForm");
    const button = document.getElementById("forgotPasswordButton");
    const errorBox = document.getElementById("forgotPasswordError");
    const successBox = document.getElementById("forgotPasswordSuccess");
    const notice = document.getElementById("resetConfigNotice");
    const configured = Boolean(cfg.url && cfg.publishableKey &&
      !String(cfg.url).includes("VOTRE-PROJET") &&
      !String(cfg.publishableKey).includes("VOTRE_CLE"));

    if (!configured) {
      notice.innerHTML = "<strong>Supabase n'est pas configuré.</strong><br>Renseignez Project URL + Publishable key dans <code>assets/supabase-config.js</code>.";
      notice.className = "admin-security-notice locked";
      button.disabled = true;
      return;
    }

    notice.textContent = "Le lien sera envoyé par Supabase Auth.";
    notice.className = "admin-security-notice ready";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.textContent = "";
      successBox.textContent = "";
      const email = String(new FormData(form).get("email") || "").trim();
      if (!email) return;

      button.disabled = true;
      button.textContent = "Envoi…";

      try {
        const redirectTo = new URL("update-password.html", location.href).href.split("#")[0];
        const response = await fetch(`${cfg.url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
          method: "POST",
          headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });

        if (!response.ok) {
          let message = `${response.status} ${response.statusText}`;
          try {
            const body = await response.json();
            message = body.msg || body.message || body.error_description || message;
          } catch {}
          throw new Error(message);
        }

        successBox.textContent = "Si cette adresse correspond à un compte, un email de récupération vient d’être envoyé. Vérifiez aussi vos courriers indésirables.";
        form.reset();
      } catch (err) {
        errorBox.textContent = err.message || "Impossible d'envoyer l'email de récupération.";
      } finally {
        button.disabled = false;
        button.textContent = "Envoyer le lien de récupération";
      }
    });
  });
})();