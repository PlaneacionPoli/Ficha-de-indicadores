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

async function iniciarSesion(e) {
  e.preventDefault();
  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;
  if (!email || !password) return;

  const btn = document.querySelector("#btn-enviar");
  btn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  btn.disabled = false;

  if (error) {
    mostrarMensaje(`Error: ${error.message}`, "error");
  } else {
    window.location.href = next;
  }
}

document.querySelector("#form-login").addEventListener("submit", iniciarSesion);
redirigirSiYaHaySesion();
