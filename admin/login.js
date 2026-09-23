document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KinAdminAuth;
  const cfg = window.KINVINS_ADMIN_CONFIG || {};
  const form = document.getElementById("adminLoginForm");
  const button = document.getElementById("adminLoginButton");
  const error = document.getElementById("adminLoginError");
  const notice = document.getElementById("adminConfigNotice");

  const existing = await auth.validate();
  if (existing) {
    const next = new URLSearchParams(location.search).get("next") || "admin.html";
    location.replace(next);
    return;
  }

  if (cfg.mode === "locked") {
    notice.innerHTML = "<strong>Administration verrouillée.</strong><br>La connexion réelle sera activée après configuration de Supabase.";
    notice.className = "admin-security-notice locked";
    button.disabled = true;
  } else if (cfg.mode === "demo") {
    if (auth.isLocal) {
      notice.innerHTML = `<strong>Mode démo local.</strong><br>Email : <code>${cfg.localDemoEmail}</code><br>Mot de passe : <code>${cfg.localDemoPassword}</code>`;
      notice.className = "admin-security-notice demo";
    } else {
      notice.innerHTML = "<strong>Mode démo refusé.</strong><br>Les identifiants de démonstration ne fonctionnent jamais sur le domaine public.";
      notice.className = "admin-security-notice locked";
      button.disabled = true;
    }
  } else if (cfg.mode === "supabase") {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
      notice.innerHTML = "<strong>Configuration incomplète.</strong><br>Ajoutez l’URL Supabase et la clé publique anon dans <code>admin/config.js</code>.";
      notice.className = "admin-security-notice locked";
      button.disabled = true;
    } else {
      notice.textContent = "Connexion sécurisée via Supabase Auth.";
      notice.className = "admin-security-notice ready";
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    button.disabled = true;
    button.textContent = "Vérification…";
    const data = new FormData(form);

    try {
      if (cfg.mode === "supabase") {
        await auth.signInSupabase(String(data.get("email")).trim(), String(data.get("password")));
      } else if (cfg.mode === "demo") {
        auth.signInLocalDemo(String(data.get("email")).trim(), String(data.get("password")));
      } else {
        throw new Error("L'administration n'est pas encore configurée.");
      }

      const next = new URLSearchParams(location.search).get("next") || "admin.html";
      location.replace(next);
    } catch (err) {
      error.textContent = err.message || "Connexion impossible.";
      button.disabled = false;
      button.textContent = "Se connecter";
    }
  });
});
