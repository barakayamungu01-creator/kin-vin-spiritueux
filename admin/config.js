window.KINVINS_ADMIN_CONFIG = {
  mode: "supabase",
  supabaseUrl: (window.KINVINS_SUPABASE_CONFIG || {}).url || "",
  supabaseAnonKey: (window.KINVINS_SUPABASE_CONFIG || {}).publishableKey || "",
  allowedRoles: ["admin", "super_admin"]
};
