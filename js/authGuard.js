// Guardia de autenticación compartida por las vistas protegidas (todas excepto login.html).
// Las políticas RLS (supabase/migrations/0002_rls_policies.sql) exigen `to authenticated`,
// así que ninguna llamada a js/api/*.js debe hacerse sin sesión activa.
import { supabase } from "./supabaseClient.js";

function pintarUsuarioNav(email) {
  const nav = document.querySelector(".app-nav");
  if (!nav) return;
  const bar = document.createElement("span");
  bar.className = "app-nav__user";
  bar.innerHTML = `${email} · <a href="#" id="btn-salir">Salir</a>`;
  nav.appendChild(bar);
  bar.querySelector("#btn-salir").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

/** Redirige a login.html si no hay sesión; si la hay, pinta el bloque de usuario en el nav. */
export async function protegerPagina() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname.split("/").pop() + window.location.search);
    window.location.href = `login.html?next=${next}`;
    return null;
  }
  pintarUsuarioNav(session.user.email);
  return session;
}
