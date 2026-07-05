import { buscarIndicadores, actualizarEvaluacion } from "../api/indicadores.js";
import { getCatalogo } from "../api/catalogos.js";
import { getProcesos, getSubprocesos } from "../api/procesos.js";
import { protegerPagina } from "../authGuard.js";

const DECISIONES = ["Pendiente", "Modificar Ficha", "Actualizar Metas", "Crear Indicador", "Eliminar"];

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

async function poblarSelectTipo() {
  const selectTipo = document.querySelector("#filtro-tipo");
  const tipos = await getCatalogo("tipo_indicador");
  for (const t of tipos) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    selectTipo.appendChild(opt);
  }
}

function crearSelectDecision(valorActual) {
  const select = document.createElement("select");
  select.dataset.field = "decision_indicador";
  const opciones = DECISIONES.includes(valorActual) || !valorActual ? DECISIONES : [valorActual, ...DECISIONES];
  for (const op of opciones) {
    const opt = document.createElement("option");
    opt.value = op;
    opt.textContent = op;
    if (op === valorActual) opt.selected = true;
    select.appendChild(opt);
  }
  return select;
}

function crearCheckbox(campo, valor) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.field = campo;
  input.checked = Boolean(valor);
  return input;
}

let paginaActual = 1;
let porPagina = 25;

function renderTablaResultados(rows) {
  const tbody = document.querySelector("#tabla-evaluacion tbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.dataset.idKawak = r.id_kawak;

    const tdId = document.createElement("td");
    tdId.textContent = r.id_kawak;
    const tdNombre = document.createElement("td");
    tdNombre.textContent = r.nombre_indicador ?? "";
    const tdProceso = document.createElement("td");
    tdProceso.textContent = r.proceso ?? "";

    const tdPdi = document.createElement("td");
    tdPdi.appendChild(crearCheckbox("pdi", r.pdi));
    const tdCna = document.createElement("td");
    tdCna.appendChild(crearCheckbox("cna_snies", r.cna_snies));
    const tdDesempeno = document.createElement("td");
    tdDesempeno.appendChild(crearCheckbox("desempeno_proceso", r.desempeno_proceso));
    const tdPermite = document.createElement("td");
    tdPermite.appendChild(crearCheckbox("permite_toma_decisiones", r.permite_toma_decisiones));

    const tdDecision = document.createElement("td");
    tdDecision.appendChild(crearSelectDecision(r.decision_indicador));

    const tdVer = document.createElement("td");
    const linkVer = document.createElement("a");
    linkVer.href = `imprimir.html?id=${r.id_kawak}`;
    linkVer.target = "_blank";
    linkVer.className = "btn secondary";
    linkVer.textContent = "👁 Ver";
    tdVer.appendChild(linkVer);

    const tdGuardar = document.createElement("td");
    const btnGuardar = document.createElement("button");
    btnGuardar.type = "button";
    btnGuardar.className = "tabla-evaluacion__btn-guardar";
    btnGuardar.title = "Actualizar indicador";
    btnGuardar.textContent = "💾";
    btnGuardar.addEventListener("click", () => guardarFila(tr, r.id_kawak));
    tdGuardar.appendChild(btnGuardar);

    tr.append(tdId, tdNombre, tdProceso, tdPdi, tdCna, tdDesempeno, tdPermite, tdDecision, tdVer, tdGuardar);
    tbody.appendChild(tr);
  }
}

async function guardarFila(tr, idKawak) {
  const payload = {
    pdi: tr.querySelector('[data-field="pdi"]').checked,
    cnaSnies: tr.querySelector('[data-field="cna_snies"]').checked,
    desempenoProceso: tr.querySelector('[data-field="desempeno_proceso"]').checked,
    permiteTomaDecisiones: tr.querySelector('[data-field="permite_toma_decisiones"]').checked,
    decisionIndicador: tr.querySelector('[data-field="decision_indicador"]').value,
  };
  try {
    await actualizarEvaluacion(idKawak, payload);
    mostrarToast(`Indicador ${idKawak} actualizado`);
  } catch (e) {
    mostrarToast(`Error actualizando indicador ${idKawak}: ${e.message}`, "error");
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
  const tipo = document.querySelector("#filtro-tipo").value || undefined;
  try {
    const { rows, total } = await buscarIndicadores({ proceso, subproceso, nombre, idKawak, tipo, pagina: paginaActual, porPagina });
    renderTablaResultados(rows);
    renderPaginacion(total);
  } catch (e) {
    mostrarToast(`Error buscando indicadores: ${e.message}`, "error");
  }
}

function buscarDesdeInicio() {
  paginaActual = 1;
  buscar();
}

async function init() {
  if (!(await protegerPagina())) return;
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
  await Promise.all([poblarSelectProcesos(), poblarSelectTipo()]);
  await buscar();
}

init();
