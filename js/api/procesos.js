import { supabase } from "../supabaseClient.js";

export async function getProcesos() {
  const { data, error } = await supabase
    .from("mapa_procesos")
    .select("proceso")
    .order("proceso", { ascending: true });
  if (error) throw error;
  return [...new Set(data.map((r) => r.proceso).filter(Boolean))];
}

/** Subprocesos filtrados por proceso — usado para el select dependiente. */
export async function getSubprocesos(proceso) {
  let query = supabase.from("mapa_procesos").select("subproceso").order("subproceso", { ascending: true });
  if (proceso) query = query.eq("proceso", proceso);
  const { data, error } = await query;
  if (error) throw error;
  return [...new Set(data.map((r) => r.subproceso).filter(Boolean))];
}
