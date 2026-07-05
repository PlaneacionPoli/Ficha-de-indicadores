import { supabase, usuarioActual } from "../supabaseClient.js";

/** Campos que sí forman parte de la ficha editable (excluye metadatos de auditoría). */
export const CAMPOS_FICHA = [
  "nombre_indicador", "descripcion", "unidad", "proceso", "subproceso",
  "linea_estrategica", "objetivo_estrategico", "tipo_indicador", "clasificacion",
  "subclasificacion", "clasificacion_cna", "frecuencia", "fecha_desde", "fecha_hasta",
  "tipo_variables", "series", "sentido", "formula", "variables",
  "meta_frecuencia", "meta_sem1", "meta_sem2",
  "zona_deficiente", "zona_alerta", "zona_cumplimiento", "zona_sobrecumplimiento",
  "meta_serie_anual", "meta_sem1_serie", "meta_sem2_serie",
  "zona_deficiente_serie", "zona_alerta_serie", "zona_cumplimiento_serie", "zona_sobrecumplimiento_serie",
  "responsable_calculo", "responsable_analisis", "aprobador_1", "aprobador_2",
  "formato_evidencia", "nombre_evidencia", "tipo_kawak",
];

export async function buscarIndicadores({ proceso, subproceso, nombre, idKawak, responsable, tipo, pagina = 1, porPagina = 25 } = {}) {
  let query = supabase.from("indicadores").select("*", { count: "exact" }).in("estado_indicador", ["Activo", "Stand by"]);
  if (proceso) query = query.eq("proceso", proceso);
  if (subproceso) query = query.eq("subproceso", subproceso);
  if (nombre) query = query.ilike("nombre_indicador", `%${nombre}%`);
  if (idKawak) query = query.eq("id_kawak", idKawak);
  if (responsable) query = query.or(`responsable_calculo.ilike.%${responsable}%,responsable_analisis.ilike.%${responsable}%`);
  if (tipo) query = query.eq("tipo_indicador", tipo);
  const desde = (pagina - 1) * porPagina;
  const hasta = desde + porPagina - 1;
  const { data, error, count } = await query.order("id_kawak", { ascending: true }).range(desde, hasta);
  if (error) throw error;
  return { rows: data, total: count };
}

/** Guarda los campos de la pantalla "Evaluación de indicadores" (checkboxes + decisión). */
export async function actualizarEvaluacion(idKawak, { pdi, cnaSnies, desempenoProceso, permiteTomaDecisiones, decisionIndicador }) {
  const usuario = await usuarioActual();
  const { error } = await supabase
    .from("indicadores")
    .update({
      pdi,
      cna_snies: cnaSnies,
      desempeno_proceso: desempenoProceso,
      permite_toma_decisiones: permiteTomaDecisiones,
      decision_indicador: decisionIndicador,
      updated_by: usuario?.email ?? "desconocido",
      updated_at: new Date().toISOString(),
    })
    .eq("id_kawak", idKawak);
  if (error) throw error;
}

export async function getIndicador(idKawak) {
  const { data, error } = await supabase.from("indicadores").select("*").eq("id_kawak", idKawak).single();
  if (error) throw error;
  return data;
}

async function siguienteIdKawak() {
  const { data, error } = await supabase
    .from("indicadores")
    .select("id_kawak")
    .order("id_kawak", { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = data?.[0]?.id_kawak ?? 0;
  return max + 1;
}

/** Crea una ficha nueva: autogenera id_kawak y registra el primer control de cambios. */
export async function crearIndicador(payload) {
  const usuario = await usuarioActual();
  const idKawak = await siguienteIdKawak();
  const row = {
    ...payload,
    id_kawak: idKawak,
    id_ind: idKawak,
    created_by: usuario?.email ?? "desconocido",
    updated_by: usuario?.email ?? "desconocido",
  };
  const { data, error } = await supabase.from("indicadores").insert(row).select().single();
  if (error) throw error;

  await supabase.from("control_cambios").insert({
    id_kawak: idKawak,
    nombre_indicador: row.nombre_indicador,
    usuario_solicitud: usuario?.email ?? "desconocido",
    campo_modificado: "creacion",
    valor_anterior: null,
    valor_nuevo: "Ficha creada",
    justificacion: "Creación inicial de la ficha técnica",
  });

  await crearSolicitudAprobacion(idKawak, "creacion", "Creación de ficha técnica");
  return data;
}

/**
 * Actualiza una ficha existente. Compara contra el registro previo y genera
 * un renglón de control_cambios POR CADA campo que haya cambiado (nunca se
 * sobreescribe/borra historial existente).
 */
export async function editarIndicador(idKawak, cambios, { comentarios, responsableCambio } = {}) {
  const usuario = await usuarioActual();
  const actual = await getIndicador(idKawak);

  const diffs = [];
  for (const campo of CAMPOS_FICHA) {
    if (!(campo in cambios)) continue;
    const anterior = actual[campo];
    const nuevo = cambios[campo];
    const anteriorStr = JSON.stringify(anterior ?? null);
    const nuevoStr = JSON.stringify(nuevo ?? null);
    if (anteriorStr !== nuevoStr) {
      diffs.push({
        id_kawak: idKawak,
        nombre_indicador: cambios.nombre_indicador ?? actual.nombre_indicador,
        usuario_solicitud: usuario?.email ?? "desconocido",
        campo_modificado: campo,
        valor_anterior: anterior == null ? null : String(anterior),
        valor_nuevo: nuevo == null ? null : String(nuevo),
        justificacion: comentarios ?? null,
      });
    }
  }

  if (diffs.length === 0) return actual; // nada que guardar

  const { data, error } = await supabase
    .from("indicadores")
    .update({ ...cambios, updated_by: usuario?.email ?? "desconocido", updated_at: new Date().toISOString() })
    .eq("id_kawak", idKawak)
    .select()
    .single();
  if (error) throw error;

  await supabase.from("control_cambios").insert(diffs);

  if (responsableCambio) {
    await supabase.from("control_cambios").insert({
      id_kawak: idKawak,
      nombre_indicador: data.nombre_indicador,
      usuario_solicitud: usuario?.email ?? "desconocido",
      campo_modificado: "solicitud_modificacion",
      valor_anterior: null,
      valor_nuevo: `Responsable del cambio: ${responsableCambio}`,
      justificacion: comentarios ?? null,
    });
  }

  await crearSolicitudAprobacion(idKawak, "edicion", comentarios);
  return data;
}

async function crearSolicitudAprobacion(idKawak, tipo, comentarios) {
  const { error } = await supabase.from("solicitudes_aprobacion").insert({
    id_kawak: idKawak,
    tipo,
    estado: "pendiente",
    nivel_aprobador: 1,
    comentarios: comentarios ?? null,
  });
  // El INSERT dispara el Database Webhook -> Edge Function notify-approval -> Power Automate.
  if (error) throw error;
}

export async function getMetasHistoricas(idKawak) {
  const { data, error } = await supabase
    .from("metas_historico")
    .select("*")
    .eq("id_kawak", idKawak)
    .order("anio", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getControlCambios(idKawak) {
  const { data, error } = await supabase
    .from("control_cambios")
    .select("*")
    .eq("id_kawak", idKawak)
    .order("fecha_cambio", { ascending: false });
  if (error) throw error;
  return data;
}
