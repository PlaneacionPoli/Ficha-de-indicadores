// Guardia de autenticación compartida por las vistas protegidas (todas excepto login.html).
// Las políticas RLS (supabase/migrations/0002_rls_policies.sql) exigen `to authenticated`,
// así que ninguna llamada a js/api/*.js debe hacerse sin sesión activa.
// Se usa tanto desde index.html (raíz) como desde pages/*.html, así que las rutas
// hacia login.html/index.html se calculan según desde dónde se llame.
import { supabase } from "./supabaseClient.js";

function rutas() {
  const enPages = window.location.pathname.includes("/pages/");
  return {
    login: enPages ? "login.html" : "pages/login.html",
    next: enPages
      ? window.location.pathname.split("/").pop() + window.location.search
      : "../index.html" + window.location.search,
  };
}

function pintarUsuarioNav(email, loginPath) {
  const topbarUser = document.querySelector("#topbar-user");
  if (topbarUser) {
    const iniciales = email.slice(0, 2).toUpperCase();
    topbarUser.innerHTML = `<span class="topbar__avatar">${iniciales}</span><span class="topbar__email">${email}</span>`;
  }
  const btnSalir = document.querySelector("#btn-salir");
  if (btnSalir) {
    btnSalir.addEventListener("click", async (e) => {
      e.preventDefault();
      await supabase.auth.signOut();
      window.location.href = loginPath;
    });
  }
}

/** Redirige a login.html si no hay sesión; si la hay, pinta el bloque de usuario en el nav. */
export async function protegerPagina() {
  const { login, next } = rutas();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${login}?next=${encodeURIComponent(next)}`;
    return null;
  }
  pintarUsuarioNav(session.user.email, login);
  return session;
}
