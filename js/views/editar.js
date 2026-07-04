import { getIndicador, editarIndicador } from "../api/indicadores.js";
import { getZonasSemaforo } from "../api/catalogos.js";
import { getUsuarios } from "../api/usuarios.js";
import { renderFicha, leerCamposDelForm } from "./fichaRender.js";
import { protegerPagina } from "../authGuard.js";

function mostrarToast(msg, tipo = "success") {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const idKawak = new URLSearchParams(window.location.search).get("id");

async function poblarResponsables() {
  const usuarios = await getUsuarios();
  const select = document.querySelector("#responsable-cambio");
  const nombres = new Set();
  usuarios.forEach((u) => { if (u.usuario_nivel_1) nombres.add(u.usuario_nivel_1); if (u.usuario_nivel_2) nombres.add(u.usuario_nivel_2); });
  for (const n of nombres) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    select.appendChild(opt);
  }
}

async function init() {
  if (!(await protegerPagina())) return;
  if (!idKawak) {
    mostrarToast("Falta el parámetro ?id= en la URL", "error");
    return;
  }
  const [indicador, zonas] = await Promise.all([getIndicador(idKawak), getZonasSemaforo()]);
  await renderFicha(document.querySelector("#panel-editar"), indicador, "edicion", zonas);
  await poblarResponsables();
  document.querySelector("#fecha-solicitud").value = new Date().toISOString().slice(0, 10);
}

async function guardar() {
  const container = document.querySelector("#panel-editar");
  const cambios = leerCamposDelForm(container);
  const comentarios = document.querySelector("#comentarios-solicitud").value || null;
  const responsableCambio = document.querySelector("#responsable-cambio").value || null;

  const confirmado = window.confirm("¿Confirmas guardar los cambios en esta ficha?");
  if (!confirmado) return;

  try {
    await editarIndicador(idKawak, cambios, { comentarios, responsableCambio });
    mostrarToast("Ficha actualizada. Se registró el cambio y se envió a aprobación.");
  } catch (e) {
    mostrarToast(`Error al guardar: ${e.message}`, "error");
  }
}

document.querySelector("#btn-guardar").addEventListener("click", guardar);
init();
