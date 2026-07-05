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
    tr.innerHTML = `<td>${r.id_kawak}</td><td>${r.nombre_indicador ?? ""}</td><td>${r.proceso ?? ""}</td><td>${r.subproceso ?? ""}</td><td>${r.frecuencia ?? ""}</td><td>${r.tipo_variables ?? ""}</td><td>${r.responsable_calculo ?? ""}</td>`;
    tr.addEventListener("click", () => mostrarFicha(r.id_kawak));
    tbody.appendChild(tr);
  }
}

/** Calcula qué números de página mostrar: primera, última, actual y vecinos, con "..." en los huecos. */
function paginasAMostrar(actual, total) {
  const set = new Set([1, total, actual, actual - 1, actual + 1]);
  const paginas = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const resultado = [];
  let anterior = 0;
  for (const p of paginas) {
    if (p - anterior > 1) resultado.push("...");
    resultado.push(p);
    anterior = p;
  }
  return resultado;
}

function renderPaginacion(total) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (paginaActual - 1) * porPagina + 1;
  const hasta = Math.min(paginaActual * porPagina, total);
  document.querySelector("#paginacion-info").textContent = `Mostrando ${desde}-${hasta} de ${total}`;

  const cont = document.querySelector("#paginacion-paginas");
  cont.innerHTML = "";
  for (const p of paginasAMostrar(paginaActual, totalPaginas)) {
    if (p === "...") {
      const span = document.createElement("span");
      span.className = "paginacion__ellipsis";
      span.textContent = "…";
      cont.appendChild(span);
      continue;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "paginacion__pagina" + (p === paginaActual ? " active" : "");
    btn.textContent = p;
    btn.addEventListener("click", () => {
      paginaActual = p;
      buscar();
    });
    cont.appendChild(btn);
  }

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

function cerrarModal() {
  document.querySelector("#modal-ficha").hidden = true;
  document.body.style.overflow = "";
}

function abrirModal() {
  document.querySelector("#modal-ficha").hidden = false;
  document.body.style.overflow = "hidden";
}

async function mostrarFicha(idKawak) {
  abrirModal();
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
      <td>${new Date(c.fecha_cambio).toLocaleDateString()}</td>
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
  document.querySelector("#btn-cerrar-modal").addEventListener("click", cerrarModal);
  document.querySelector("#modal-ficha").addEventListener("click", (e) => {
    if (e.target.id === "modal-ficha") cerrarModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.querySelector("#modal-ficha").hidden) cerrarModal();
  });
  await poblarSelectProcesos();
  await buscar();
}

init();
