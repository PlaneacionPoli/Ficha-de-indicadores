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
  const nav = document.querySelector(".app-nav");
  if (!nav) return;
  const bar = document.createElement("span");
  bar.className = "app-nav__user";
  bar.innerHTML = `${email} · <a href="#" id="btn-salir">Salir</a>`;
  nav.appendChild(bar);
  bar.querySelector("#btn-salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = loginPath;
  });
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
