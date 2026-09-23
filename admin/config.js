/**
 * KINVINS.CD — configuration de l'authentification administrateur.
 *
 * mode:
 *   "locked"   -> administration inaccessible en production (valeur sûre par défaut)
 *   "demo"     -> connexion démo, autorisée UNIQUEMENT en localhost / fichier local
 *   "supabase" -> authentification réelle avec Supabase
 */
window.KINVINS_ADMIN_CONFIG = {
  mode: "supabase",

  supabaseUrl: "https://vaioirwtomjtqloanorm.supabase.co",

  supabaseAnonKey: "sb_publishable_LjFgDbPYdwujuoZdafMyUA_DY6dtOU1",

  allowedRoles: [
    "admin",
    "super_admin"
  ]
};
