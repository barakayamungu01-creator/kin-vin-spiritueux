document.write('<script src="admin-auth-common.js"><\/script>');
document.documentElement.classList.add("admin-auth-pending");
document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.KinAdminAuth;
  if (!auth) {
    location.replace("login.html");
    return;
  }
  const session = await auth.validate();
  if (!session) {
    const here = location.pathname.split("/").pop() || "admin.html";
    location.replace(`login.html?next=${encodeURIComponent(here)}`);
    return;
  }

  document.documentElement.classList.remove("admin-auth-pending");
  document.documentElement.classList.add("admin-authenticated");

  const logout = document.getElementById("adminLogoutBtn");
  if (logout) {
    logout.addEventListener("click", (e) => {
      e.preventDefault();
      auth.logout();
    });
  }
});
