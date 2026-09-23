(() => {
  "use strict";

  const SESSION_KEY = "kinvins_admin_session";
  const cfg = window.KINVINS_ADMIN_CONFIG || {};
  const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname) || location.protocol === "file:";

  window.KinAdminAuth = {
    cfg,
    isLocal,
    sessionKey: SESSION_KEY,

    getSession() {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
      catch { return null; }
    },

    setSession(session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    },

    clearSession() {
      sessionStorage.removeItem(SESSION_KEY);
    },

    async fetchProfile(accessToken, userId) {
      const url = `${cfg.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role,status&limit=1`;
      const r = await fetch(url, {
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json"
        }
      });
      if (!r.ok) throw new Error("Impossible de vérifier le rôle administrateur.");
      const rows = await r.json();
      return rows[0] || null;
    },

    async signInSupabase(email, password) {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        throw new Error("Supabase n'est pas encore configuré.");
      }
      const r = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: cfg.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok || !data.access_token || !data.user) {
        throw new Error(data.error_description || data.msg || "Email ou mot de passe incorrect.");
      }
      const profile = await this.fetchProfile(data.access_token, data.user.id);
      if (!profile || profile.status !== "active" || !(cfg.allowedRoles || []).includes(profile.role)) {
        throw new Error("Ce compte n'est pas autorisé à accéder à l'administration.");
      }
      const session = {
        mode: "supabase",
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Math.floor(Date.now()/1000) + Number(data.expires_in || 3600),
        user: { id: data.user.id, email: data.user.email },
        profile
      };
      this.setSession(session);
      return session;
    },

    signInLocalDemo(email, password) {
      if (!isLocal || cfg.mode !== "demo") {
        throw new Error("La connexion démo est désactivée sur le site public.");
      }
      if (email !== cfg.localDemoEmail || password !== cfg.localDemoPassword) {
        throw new Error("Identifiants de démonstration incorrects.");
      }
      const session = {
        mode: "demo",
        expiresAt: Math.floor(Date.now()/1000) + 8*3600,
        user: { id: "local-demo-admin", email },
        profile: { role: "admin", status: "active" }
      };
      this.setSession(session);
      return session;
    },

    async validate() {
      const session = this.getSession();
      if (!session || !session.expiresAt || session.expiresAt <= Math.floor(Date.now()/1000)) {
        this.clearSession();
        return null;
      }

      if (session.mode === "demo") {
        if (isLocal && cfg.mode === "demo") return session;
        this.clearSession();
        return null;
      }

      if (session.mode === "supabase" && cfg.mode === "supabase") {
        try {
          const profile = await this.fetchProfile(session.accessToken, session.user.id);
          if (!profile || profile.status !== "active" || !(cfg.allowedRoles || []).includes(profile.role)) {
            this.clearSession();
            return null;
          }
          session.profile = profile;
          this.setSession(session);
          return session;
        } catch {
          this.clearSession();
          return null;
        }
      }

      this.clearSession();
      return null;
    },

    logout() {
      this.clearSession();
      location.replace("login.html");
    }
  };
})();
