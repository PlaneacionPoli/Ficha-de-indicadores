import { supabase } from "../supabaseClient.js";

const params = new URLSearchParams(window.location.search);
const next = params.get("next") || "consultar.html";

function mostrarMensaje(texto, tipo) {
  const msg = document.querySelector("#login-msg");
  msg.textContent = texto;
  msg.className = `login-msg ${tipo}`;
}

async function redirigirSiYaHaySesion() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = next;
}

async function enviarEnlace(e) {
  e.preventDefault();
  const email = document.querySelector("#login-email").value.trim();
  if (!email) return;

  const btn = document.querySelector("#btn-enviar");
  btn.disabled = true;
  const emailRedirectTo = `${window.location.origin}${window.location.pathname.replace("login.html", next)}`;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  btn.disabled = false;

  if (error) {
    mostrarMensaje(`Error: ${error.message}`, "error");
  } else {
    mostrarMensaje("Revisa tu correo: te enviamos un enlace de acceso.", "success");
  }
}

document.querySelector("#form-login").addEventListener("submit", enviarEnlace);
redirigirSiYaHaySesion();
