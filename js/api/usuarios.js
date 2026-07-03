import { supabase } from "../supabaseClient.js";

/** Responsables de aprobación (nivel 1 / nivel 2) para un proceso/subproceso dado. */
export async function getResponsables(proceso, subproceso) {
  let query = supabase.from("usuarios").select("*");
  if (proceso) query = query.eq("proceso", proceso);
  if (subproceso) query = query.eq("subproceso", subproceso);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getUsuarios() {
  const { data, error } = await supabase.from("usuarios").select("*");
  if (error) throw error;
  return data;
}
