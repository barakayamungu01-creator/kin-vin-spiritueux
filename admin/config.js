/**
 * KINVINS.CD — configuration de l'authentification administrateur.
 *
 * mode:
 *   "locked"   -> administration inaccessible en production (valeur sûre par défaut)
 *   "demo"     -> connexion démo, autorisée UNIQUEMENT en localhost / fichier local
 *   "supabase" -> authentification réelle avec Supabase
 */
window.KINVINS_ADMIN_CONFIG = {
  mode: "demo",

  // À remplir lorsque votre projet Supabase sera créé.
  supabaseUrl: "",
  supabaseAnonKey: "",

  allowedRoles: ["admin", "super_admin"],

  // Utilisé uniquement avec mode="demo" ET uniquement en local.
  localDemoEmail: "admin@kinvins.cd",
  localDemoPassword: "KIN-DEMO-LOCAL"
};
