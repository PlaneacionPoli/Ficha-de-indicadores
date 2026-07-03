import { crearIndicador, CAMPOS_FICHA } from "../api/indicadores.js";
import { getZonasSemaforo } from "../api/catalogos.js";
import { renderFicha, leerCamposDelForm } from "./fichaRender.js";

function mostrarToast(msg, tipo = "success") {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const FICHA_VACIA = Object.fromEntries(CAMPOS_FICHA.map((c) => [c, c === "variables" ? [] : null]));
FICHA_VACIA.id_kawak = "(se autogenera al guardar)";

async function init() {
  const zonas = await getZonasSemaforo();
  await renderFicha(document.querySelector("#panel-crear"), FICHA_VACIA, "edicion", zonas);
}

async function guardar() {
  const container = document.querySelector("#panel-crear");
  const payload = leerCamposDelForm(container);

  if (!payload.nombre_indicador) {
    mostrarToast("El nombre del indicador es obligatorio", "error");
    return;
  }

  const confirmado = window.confirm("¿Confirmas la creación de esta ficha técnica?");
  if (!confirmado) return;

  try {
    const creado = await crearIndicador(payload);
    mostrarToast(`Ficha creada con ID Kawak ${creado.id_kawak}`);
    setTimeout(() => { window.location.href = `editar.html?id=${creado.id_kawak}`; }, 1000);
  } catch (e) {
    mostrarToast(`Error al crear la ficha: ${e.message}`, "error");
  }
}

document.querySelector("#btn-guardar").addEventListener("click", guardar);
init();
