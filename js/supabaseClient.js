// Cliente único de Supabase, compartido por todos los módulos js/api/*.
// Requiere que js/config.js (ver config.example.js) esté cargado antes que este script.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.SIGEI_FICHAS_CONFIG;
if (!cfg) {
  throw new Error(
    "Falta js/config.js — copia js/config.example.js a js/config.js y completa tus credenciales de Supabase."
  );
}

export const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

export async function usuarioActual() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
