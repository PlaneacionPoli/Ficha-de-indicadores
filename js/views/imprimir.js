import { getIndicador, getMetasHistoricas, getControlCambios } from "../api/indicadores.js";
import { getZonasSemaforo } from "../api/catalogos.js";
import { renderFicha, renderMetasHistoricas } from "./fichaRender.js";
import { protegerPagina } from "../authGuard.js";

const idKawak = new URLSearchParams(window.location.search).get("id");

async function init() {
  if (!(await protegerPagina())) return;
  if (!idKawak) return;
  const [indicador, zonas, metas, cambios] = await Promise.all([
    getIndicador(idKawak),
    getZonasSemaforo(),
    getMetasHistoricas(idKawak),
    getControlCambios(idKawak),
  ]);

  await renderFicha(document.querySelector("#panel-ficha"), indicador, "lectura", zonas);

  // El navegador usa document.title como nombre sugerido al "Guardar como PDF" / imprimir.
  document.title = String(indicador.id_kawak);

  await renderMetasHistoricas(document.querySelector("#panel-metas"), metas, zonas);

  document.querySelector("#tabla-cambios tbody").innerHTML = cambios.map((c) => `
    <tr>
      <td>${new Date(c.fecha_cambio).toLocaleDateString()}</td>
      <td>${c.usuario_solicitud ?? ""}</td>
      <td>${c.justificacion ?? ""}</td>
    </tr>
  `).join("");

  // Deja que el navegador termine de pintar antes de abrir el diálogo de impresión.
  setTimeout(() => window.print(), 300);
}

document.querySelector("#btn-imprimir")?.addEventListener("click", () => window.print());
init();
