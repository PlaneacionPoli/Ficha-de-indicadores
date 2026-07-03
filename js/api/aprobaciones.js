import { supabase, usuarioActual } from "../supabaseClient.js";

export async function getSolicitud(id) {
  const { data, error } = await supabase.from("solicitudes_aprobacion").select("*, indicadores(*)").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function decidirSolicitud(id, estado /* 'aprobado' | 'rechazado' | 'ajustes' */, comentarios) {
  const usuario = await usuarioActual();
  const { data, error } = await supabase
    .from("solicitudes_aprobacion")
    .update({
      estado,
      comentarios,
      fecha_decision: new Date().toISOString(),
      decidido_por: usuario?.email ?? "desconocido",
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  if (estado === "aprobado") {
    await supabase.from("indicadores").update({ estado_aprobacion: "aprobado" }).eq("id_kawak", data.id_kawak);
  } else if (estado === "rechazado") {
    await supabase.from("indicadores").update({ estado_aprobacion: "rechazado" }).eq("id_kawak", data.id_kawak);
  }

  await supabase.from("control_cambios").insert({
    id_kawak: data.id_kawak,
    usuario_solicitud: usuario?.email ?? "desconocido",
    campo_modificado: "estado_aprobacion",
    valor_anterior: "pendiente",
    valor_nuevo: estado,
    justificacion: comentarios ?? null,
  });

  return data;
}
