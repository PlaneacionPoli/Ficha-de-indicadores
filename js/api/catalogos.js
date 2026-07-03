import { supabase } from "../supabaseClient.js";

const cache = new Map();

/** Devuelve los valores de un catálogo (ej. 'tipo_indicador') ordenados. */
export async function getCatalogo(categoria) {
  if (cache.has(categoria)) return cache.get(categoria);
  const { data, error } = await supabase
    .from("catalogos")
    .select("valor")
    .eq("categoria", categoria)
    .order("orden", { ascending: true });
  if (error) throw error;
  const valores = data.map((r) => r.valor);
  cache.set(categoria, valores);
  return valores;
}

export async function getZonasSemaforo() {
  const { data, error } = await supabase
    .from("zonas_semaforo")
    .select("*")
    .order("orden", { ascending: true });
  if (error) throw error;
  return data;
}
