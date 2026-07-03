// Supabase Edge Function — se dispara vía Database Webhook al hacer INSERT en
// solicitudes_aprobacion. Busca el responsable de aprobación (Usuarios.xlsx importado
// a la tabla `usuarios`) para el proceso/subproceso del indicador, y hace POST al
// webhook HTTP de Power Automate (que a su vez notifica por Teams/Outlook).
//
// La URL del webhook de Power Automate se guarda como secreto de la función, NO en
// el cliente: `supabase secrets set POWER_AUTOMATE_WEBHOOK_URL=...`
//
// Configurar el Database Webhook en Supabase Dashboard -> Database -> Webhooks:
//   tabla: solicitudes_aprobacion, evento: INSERT, tipo: Edge Function, function: notify-approval

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const POWER_AUTOMATE_WEBHOOK_URL = Deno.env.get("POWER_AUTOMATE_WEBHOOK_URL")!;

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const solicitud = payload.record; // fila insertada en solicitudes_aprobacion

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: indicador, error: errInd } = await supabase
      .from("indicadores")
      .select("id_kawak, nombre_indicador, proceso, subproceso")
      .eq("id_kawak", solicitud.id_kawak)
      .single();
    if (errInd) throw errInd;

    const { data: responsables, error: errUsr } = await supabase
      .from("usuarios")
      .select("*")
      .eq("proceso", indicador.proceso)
      .eq("subproceso", indicador.subproceso)
      .limit(1);
    if (errUsr) throw errUsr;

    const responsable = responsables?.[0];
    const nivel = solicitud.nivel_aprobador ?? 1;
    const correoAprobador = nivel === 2 ? responsable?.correo_nivel_2 : responsable?.correo_nivel_1;
    const nombreAprobador = nivel === 2 ? responsable?.usuario_nivel_2 : responsable?.usuario_nivel_1;

    const body = {
      solicitudId: solicitud.id,
      idKawak: indicador.id_kawak,
      nombreIndicador: indicador.nombre_indicador,
      tipo: solicitud.tipo,
      comentarios: solicitud.comentarios,
      aprobadorNombre: nombreAprobador ?? null,
      aprobadorCorreo: correoAprobador ?? null,
      enlaceRevision: `${Deno.env.get("APP_BASE_URL") ?? ""}/pages/consultar.html?id=${indicador.id_kawak}`,
    };

    if (!correoAprobador) {
      console.warn(`Sin responsable de nivel ${nivel} para proceso=${indicador.proceso} subproceso=${indicador.subproceso}`);
    }

    const resp = await fetch(POWER_AUTOMATE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`Power Automate respondió ${resp.status}: ${await resp.text()}`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
