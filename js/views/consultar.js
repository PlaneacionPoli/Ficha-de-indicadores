import { buscarIndicadores, getIndicador, getMetasHistoricas, getControlCambios } from "../api/indicadores.js";
import { getZonasSemaforo } from "../api/catalogos.js";
import { getProcesos, getSubprocesos } from "../api/procesos.js";
import { renderFicha } from "./fichaRender.js";
import { protegerPagina } from "../authGuard.js";

function mostrarToast(msg, tipo = "success") {
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function poblarSelectProcesos() {
  const selectProceso = document.querySelector("#filtro-proceso");
  const selectSubproceso = document.querySelector("#filtro-subproceso");
  const procesos = await getProcesos();
  for (const p of procesos) {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    selectProceso.appendChild(opt);
  }
  selectProceso.addEventListener("change", async () => {
    selectSubproceso.innerHTML = '<option value="">Todos</option>';
    const subs = await getSubprocesos(selectProceso.value);
    for (const s of subs) {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      selectSubproceso.appendChild(opt);
    }
  });
}

let paginaActual = 1;
let porPagina = 25;

function renderTablaResultados(rows) {
  const tbody = document.querySelector("#tabla-resultados tbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.id_kawak}</td><td>${r.nombre_indicador ?? ""}</td><td>${r.proceso ?? ""}</td><td>${r.subproceso ?? ""}</td><td>${r.responsable_calculo ?? ""}</td>`;
    tr.addEventListener("click", () => mostrarFicha(r.id_kawak));
    tbody.appendChild(tr);
  }
}

function renderPaginacion(total) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  document.querySelector("#paginacion-info").textContent = `Página ${paginaActual} de ${totalPaginas}`;
  document.querySelector("#btn-pagina-anterior").disabled = paginaActual <= 1;
  document.querySelector("#btn-pagina-siguiente").disabled = paginaActual >= totalPaginas;
}

async function buscar() {
  const proceso = document.querySelector("#filtro-proceso").value || undefined;
  const subproceso = document.querySelector("#filtro-subproceso").value || undefined;
  const nombre = document.querySelector("#filtro-nombre").value || undefined;
  const idKawak = document.querySelector("#filtro-id").value || undefined;
  const responsable = document.querySelector("#filtro-responsable").value || undefined;
  try {
    const { rows, total } = await buscarIndicadores({ proceso, subproceso, nombre, idKawak, responsable, pagina: paginaActual, porPagina });
    renderTablaResultados(rows);
    renderPaginacion(total);
  } catch (e) {
    mostrarToast(`Error buscando fichas: ${e.message}`, "error");
  }
}

function buscarDesdeInicio() {
  paginaActual = 1;
  buscar();
}

function activarTab(nombre) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === nombre));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.dataset.tab === nombre));
}

async function mostrarFicha(idKawak) {
  document.querySelector("#detalle-ficha").style.display = "block";
  document.querySelector("#btn-editar").href = `editar.html?id=${idKawak}`;
  document.querySelector("#btn-imprimir").href = `imprimir.html?id=${idKawak}`;

  const [indicador, zonas, metas, cambios] = await Promise.all([
    getIndicador(idKawak),
    getZonasSemaforo(),
    getMetasHistoricas(idKawak),
    getControlCambios(idKawak),
  ]);

  await renderFicha(document.querySelector("#panel-ficha"), indicador, "lectura", zonas);

  const tbodyMetas = document.querySelector("#tabla-metas tbody");
  tbodyMetas.innerHTML = metas.map((m) => `
    <tr><td>${m.anio}</td><td>${m.meta_frecuencia ?? ""}</td><td>${m.meta_sem1 ?? ""}</td><td>${m.meta_sem2 ?? ""}</td></tr>
  `).join("");

  const tbodyCambios = document.querySelector("#tabla-cambios tbody");
  tbodyCambios.innerHTML = cambios.map((c) => `
    <tr>
      <td>${new Date(c.fecha_cambio).toLocaleString()}</td>
      <td>${c.usuario_solicitud ?? ""}</td>
      <td>${c.campo_modificado ?? ""}</td>
      <td>${c.valor_anterior ?? ""}</td>
      <td>${c.valor_nuevo ?? ""}</td>
      <td>${c.justificacion ?? ""}</td>
    </tr>
  `).join("");

  activarTab("ficha");
}

async function init() {
  if (!(await protegerPagina())) return;
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => activarTab(b.dataset.tab)));
  document.querySelector("#btn-buscar").addEventListener("click", buscarDesdeInicio);
  document.querySelector("#filtro-por-pagina").addEventListener("change", (e) => {
    porPagina = Number(e.target.value);
    buscarDesdeInicio();
  });
  document.querySelector("#btn-pagina-anterior").addEventListener("click", () => {
    paginaActual -= 1;
    buscar();
  });
  document.querySelector("#btn-pagina-siguiente").addEventListener("click", () => {
    paginaActual += 1;
    buscar();
  });
  await poblarSelectProcesos();
  await buscar();
}

init();
