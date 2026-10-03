(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const cfg = window.KINVINS_SUPABASE_CONFIG || {};
    const form = document.getElementById("updatePasswordForm");
    const button = document.getElementById("updatePasswordButton");
    const errorBox = document.getElementById("updatePasswordError");
    const successBox = document.getElementById("updatePasswordSuccess");
    const notice = document.getElementById("recoveryNotice");

    const configured = Boolean(cfg.url && cfg.publishableKey &&
      !String(cfg.url).includes("VOTRE-PROJET") &&
      !String(cfg.publishableKey).includes("VOTRE_CLE"));

    if (!configured) {
      notice.innerHTML = "<strong>Supabase n'est pas configuré.</strong><br>Renseignez Project URL + Publishable key.";
      notice.className = "admin-security-notice locked";
      button.disabled = true;
      return;
    }

    const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const type = hash.get("type");
    const expiresIn = Number(hash.get("expires_in") || 3600);
    const authError = hash.get("error_description") || hash.get("error") ||
      new URLSearchParams(location.search).get("error_description");

    if (authError) {
      notice.textContent = authError;
      notice.className = "admin-security-notice locked";
      button.disabled = true;
      return;
    }

    if (!accessToken) {
      notice.innerHTML = "<strong>Lien de récupération invalide ou expiré.</strong><br>Demandez un nouveau lien depuis la page « Mot de passe oublié ».";
      notice.className = "admin-security-notice locked";
      button.disabled = true;
      return;
    }

    notice.textContent = type === "recovery"
      ? "Lien de récupération validé. Vous pouvez définir votre nouveau mot de passe."
      : "Session Supabase reçue. Vous pouvez définir votre nouveau mot de passe.";
    notice.className = "admin-security-notice ready";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.textContent = "";
      successBox.textContent = "";

      const fd = new FormData(form);
      const password = String(fd.get("password") || "");
      const passwordConfirm = String(fd.get("passwordConfirm") || "");

      if (password.length < 8) {
        errorBox.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
        return;
      }
      if (password !== passwordConfirm) {
        errorBox.textContent = "Les deux mots de passe ne correspondent pas.";
        return;
      }

      button.disabled = true;
      button.textContent = "Enregistrement…";

      try {
        const response = await fetch(`${cfg.url}/auth/v1/user`, {
          method: "PUT",
          headers: {
            apikey: cfg.publishableKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        });

        let body = {};
        try { body = await response.json(); } catch {}

        if (!response.ok) {
          throw new Error(body.msg || body.message || body.error_description || `${response.status} ${response.statusText}`);
        }

        sessionStorage.setItem("kinvins_admin_session", JSON.stringify({
          mode: "supabase",
          accessToken,
          refreshToken: refreshToken || "",
          expiresAt: Math.floor(Date.now()/1000) + expiresIn,
          user: { id: body?.id || "", email: body?.email || "" },
          profile: null
        }));

        successBox.textContent = "Mot de passe modifié avec succès. Redirection vers la connexion…";
        history.replaceState({}, document.title, location.pathname);

        setTimeout(() => location.replace("login.html?password_updated=1"), 1200);
      } catch (err) {
        errorBox.textContent = err.message || "Impossible de modifier le mot de passe.";
        button.disabled = false;
        button.textContent = "Enregistrer le nouveau mot de passe";
      }
    });
  });
})();