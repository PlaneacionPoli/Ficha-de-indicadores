// Construye el DOM de la ficha técnica replicando el layout del PDF de referencia
// (ver docs/plan §"Especificación visual"). Se reutiliza en modo lectura (Consulta),
// edición (Edición) e impresión (Imprimir) cambiando solo `modo`.
import { getCatalogo } from "../api/catalogos.js";
import { getProcesos, getSubprocesos } from "../api/procesos.js";

const CATALOGOS_SELECT = {
  unidad: null, // deriva de mapa_procesos, se resuelve aparte (ver bindProcesoSubproceso)
  tipo_indicador: "tipo_indicador",
  clasificacion: "clasificacion",
  subclasificacion: "subclasificacion",
  linea_estrategica: "linea_estrategica",
  objetivo_estrategico: "objetivo_estrategico",
  frecuencia: "frecuencia",
  sentido: "sentido",
  tipo_variables: "tipo_variables",
  estado_indicador: "estado_indicador",
  clasificacion_cna: "clasificacion_cna",
  tipo_kawak: "tipo_kawak",
};

function campoLectura(valor) {
  const span = document.createElement("span");
  span.textContent = valor ?? "";
  return span;
}

async function campoInput(nombre, valor, { tipo = "text", select } = {}) {
  if (select) {
    const sel = document.createElement("select");
    sel.name = nombre;
    sel.innerHTML = `<option value="">Seleccione</option>`;
    const opciones = await getCatalogo(select);
    for (const op of opciones) {
      const opt = document.createElement("option");
      opt.value = op;
      opt.textContent = op;
      if (op === valor) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }
  const el = tipo === "textarea" ? document.createElement("textarea") : document.createElement("input");
  if (tipo !== "textarea") el.type = tipo;
  el.name = nombre;
  el.value = valor ?? "";
  return el;
}

async function fila(container, cols, campos, indicador, modo) {
  const filaEl = document.createElement("div");
  filaEl.className = `ficha__fila ficha__fila--${cols}`;
  for (const { nombre, etiqueta, tipo, select, full, clase } of campos) {
    const campoEl = document.createElement("div");
    campoEl.className = "ficha__campo" + (full ? " ficha__campo--full" : "") + (clase ? ` ${clase}` : "");
    const etiquetaEl = document.createElement("div");
    etiquetaEl.className = "ficha__etiqueta";
    etiquetaEl.textContent = etiqueta;
    const valorEl = document.createElement("div");
    valorEl.className = "ficha__valor";
    valorEl.appendChild(
      modo === "edicion"
        ? await campoInput(nombre, indicador[nombre], { tipo, select })
        : campoLectura(indicador[nombre])
    );
    campoEl.append(etiquetaEl, valorEl);
    filaEl.appendChild(campoEl);
  }
  container.appendChild(filaEl);
}

function barraSeccion(container, titulo) {
  const el = document.createElement("div");
  el.className = "ficha__seccion-titulo";
  el.textContent = titulo;
  container.appendChild(el);
}

/** Crea una tarjeta de sección (`.ficha__card`) con su barra de título y devuelve el body para agregarle filas. */
function crearSeccion(container, titulo) {
  const card = document.createElement("section");
  card.className = "ficha__card";
  const body = document.createElement("div");
  body.className = "ficha__card-body";
  barraSeccion(card, titulo);
  card.appendChild(body);
  container.appendChild(card);
  return body;
}

function encabezadoFormato(container) {
  const el = document.createElement("div");
  el.className = "ficha__encabezado";
  el.innerHTML = `
    <div class="ficha__logo"><strong>POLI</strong></div>
    <div class="ficha__titulo-formato">
      FORMATO<br><small>FICHA TÉCNICA DE INDICADORES</small><br>
      <small>PROCESO: Direccionamiento Estratégico · SUBPROCESO: Desempeño institucional</small>
    </div>
    <div class="ficha__meta-formato">
      <div><strong>Código:</strong> DE-DIRGI</div>
      <div><strong>Versión:</strong> 1</div>
    </div>`;
  container.appendChild(el);
}

async function seccionVariables(container, indicador, modo) {
  const body = crearSeccion(container, "Formulas y Variables");
  await fila(
    body, 3,
    [
      { nombre: "tipo_variables", etiqueta: "Tipo de variables", select: "tipo_variables" },
      { nombre: "series", etiqueta: "Series" },
      { nombre: "formula", etiqueta: "Formula", full: false },
    ],
    indicador, modo
  );

  const variables = indicador.variables ?? [];
  const wrap = document.createElement("div");
  wrap.className = "ficha__variables";
  wrap.dataset.role = "variables-wrap";

  for (const [i, v] of variables.entries()) {
    await filaVariable(wrap, v, i, modo);
  }
  body.appendChild(wrap);

  if (modo === "edicion") {
    const header = document.createElement("div");
    header.className = "ficha__variable-header";
    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "btn secondary";
    btnAdd.textContent = "+ Agregar variable";
    btnAdd.addEventListener("click", async () => {
      const idx = wrap.querySelectorAll("[data-variable-row]").length;
      await filaVariable(wrap, { nombre: "", unidad: "", fuente: "", orden: idx + 1 }, idx, modo);
    });
    header.appendChild(btnAdd);
    body.appendChild(header);
  }

  await fila(
    body, 2,
    [
      { nombre: "formato_evidencia", etiqueta: "Formato Evidencia" },
      { nombre: "nombre_evidencia", etiqueta: "Nombre Evidencia" },
    ],
    indicador, modo
  );
}

async function filaVariable(wrap, v, index, modo) {
  const row = document.createElement("div");
  row.className = "ficha__fila ficha__fila--3";
  row.dataset.variableRow = String(index);

  const campos = [
    { key: "nombre", etiqueta: `Variable ${index + 1}` },
    { key: "unidad", etiqueta: `Unidad V${index + 1}` },
    { key: "fuente", etiqueta: `Fuente V${index + 1}` },
  ];
  for (const { key, etiqueta } of campos) {
    const campoEl = document.createElement("div");
    campoEl.className = "ficha__campo";
    const etiquetaEl = document.createElement("div");
    etiquetaEl.className = "ficha__etiqueta";
    etiquetaEl.textContent = etiqueta;
    const valorEl = document.createElement("div");
    valorEl.className = "ficha__valor";
    if (modo === "edicion") {
      const input = document.createElement("input");
      input.dataset.variableField = key;
      input.value = v[key] ?? "";
      valorEl.appendChild(input);
    } else {
      valorEl.appendChild(campoLectura(v[key]));
    }
    campoEl.append(etiquetaEl, valorEl);
    row.appendChild(campoEl);
  }
  if (modo === "edicion") {
    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn secondary";
    btnDel.textContent = "Quitar";
    btnDel.addEventListener("click", () => row.remove());
    row.appendChild(btnDel);
  }
  wrap.appendChild(row);
}

/** Lee las variables actuales del DOM (modo edición) para guardarlas como jsonb. */
export function leerVariablesDelForm(form) {
  const filas = [...form.querySelectorAll("[data-variable-row]")];
  return filas.map((row, i) => ({
    nombre: row.querySelector('[data-variable-field="nombre"]')?.value ?? "",
    unidad: row.querySelector('[data-variable-field="unidad"]')?.value ?? "",
    fuente: row.querySelector('[data-variable-field="fuente"]')?.value ?? "",
    orden: i + 1,
  })).filter((v) => v.nombre);
}

async function tablaZonas(container, titulo, indicador, sufijo, zonas) {
  const tabla = document.createElement("table");
  tabla.className = "ficha__zonas-tabla";
  const caption = document.createElement("caption");
  caption.textContent = titulo;
  tabla.appendChild(caption);

  const thead = document.createElement("tr");
  const tbody = document.createElement("tr");
  for (const z of zonas) {
    const th = document.createElement("th");
    th.textContent = z.etiqueta;
    th.style.background = z.color_hex;
    th.style.color = z.color_texto;
    thead.appendChild(th);

    const td = document.createElement("td");
    td.className = `zona-${z.nivel}`;
    const campo = `zona_${z.nivel}${sufijo}`;
    if (indicador._modo === "edicion") {
      const input = document.createElement("input");
      input.name = campo;
      input.value = indicador[campo] ?? "";
      td.appendChild(input);
    } else {
      td.textContent = indicador[campo] ?? "";
    }
    tbody.appendChild(td);
  }
  tabla.append(thead, tbody);
  container.appendChild(tabla);
}

async function seccionMetasZonas(container, indicador, modo, zonas) {
  const body = crearSeccion(container, "Metas y Zonas");
  await fila(
    body, 3,
    [
      { nombre: "meta_frecuencia", etiqueta: "Meta Frecuencia" },
      { nombre: "meta_sem1", etiqueta: "Meta 1 Semestre" },
      { nombre: "meta_sem2", etiqueta: "Meta 2 Semestre" },
    ],
    indicador, modo
  );
  indicador._modo = modo;
  await tablaZonas(body, "Indicador", indicador, "", zonas);

  if (indicador.tipo_variables === "Multiserie") {
    await fila(
      body, 3,
      [
        { nombre: "meta_serie_anual", etiqueta: "Meta Anual Series" },
        { nombre: "meta_sem1_serie", etiqueta: "Meta 1 Semestre Serie" },
        { nombre: "meta_sem2_serie", etiqueta: "Meta 2 Semestre Serie" },
      ],
      indicador, modo
    );
    await tablaZonas(body, "Series", indicador, "_serie", zonas);
  }
}

/**
 * @param {HTMLElement} container
 * @param {object} indicador
 * @param {'lectura'|'edicion'} modo
 * @param {Array} zonas — resultado de getZonasSemaforo()
 */
export async function renderFicha(container, indicador, modo, zonas) {
  container.innerHTML = "";
  container.classList.add("ficha");
  encabezadoFormato(container);

  const datosBody = crearSeccion(container, "Datos Generales del Indicador");
  await fila(datosBody, 2, [
    { nombre: "nombre_indicador", etiqueta: "Nombre del Indicador", full: true, clase: "ficha__campo--nombre" },
    { nombre: "id_kawak", etiqueta: "Código", clase: "ficha__campo--codigo" },
  ], indicador, "lectura"); // id_kawak nunca es editable
  await fila(datosBody, 1, [
    { nombre: "descripcion", etiqueta: "Descripción del Indicador", tipo: "textarea", full: true },
  ], indicador, modo);
  await fila(datosBody, 3, [
    { nombre: "fecha_desde", etiqueta: "Fecha Desde", tipo: "date" },
    { nombre: "fecha_hasta", etiqueta: "Fecha Hasta", tipo: "date" },
    { nombre: "estado_indicador", etiqueta: "Estado", select: "estado_indicador" },
  ], indicador, modo);
  await fila(datosBody, 2, [
    { nombre: "unidad", etiqueta: "Unidad" },
    { nombre: "proceso", etiqueta: "Proceso" },
  ], indicador, modo);
  await fila(datosBody, 3, [
    { nombre: "tipo_indicador", etiqueta: "Tipo de Indicador", select: "tipo_indicador" },
    { nombre: "clasificacion", etiqueta: "Clasificación", select: "clasificacion" },
    { nombre: "subclasificacion", etiqueta: "Subclasificación", select: "subclasificacion" },
  ], indicador, modo);
  await fila(datosBody, 2, [
    { nombre: "linea_estrategica", etiqueta: "Linea_Estrategica", select: "linea_estrategica" },
    { nombre: "objetivo_estrategico", etiqueta: "Objetivo Estratégico", select: "objetivo_estrategico" },
  ], indicador, modo);

  await seccionVariables(container, indicador, modo);
  await seccionMetasZonas(container, indicador, modo, zonas);

  const respBody = crearSeccion(container, "Responsables");
  await fila(respBody, 3, [
    { nombre: "responsable_analisis", etiqueta: "Responsable del análisis" },
    { nombre: "responsable_calculo", etiqueta: "Responsable del cálculo" },
    { nombre: "aprobador_1", etiqueta: "Usuario_Aprobador" },
  ], indicador, modo);
}

/** Lee todos los campos con [name] del contenedor de la ficha (modo edición), excluyendo id_kawak. */
export function leerCamposDelForm(container) {
  const payload = {};
  container.querySelectorAll("[name]").forEach((el) => {
    if (el.name === "id_kawak") return;
    payload[el.name] = el.value === "" ? null : el.value;
  });
  payload.variables = leerVariablesDelForm(container);
  return payload;
}

export { getProcesos, getSubprocesos };
