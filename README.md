# Fichas Técnicas de Indicadores (POLI)

Mini-aplicativo web estático (HTML5 + CSS3 + JS ES6+, sin backend propio) para
gestionar el ciclo de vida de las Fichas Técnicas de Indicadores del Politécnico
Grancolombiano. Es un proyecto **independiente** del monorepo SIGEI: se despliega
en su propio repositorio de GitHub vía GitHub Pages y se inserta como sección en un
sitio HTML institucional existente.

Persistencia: [Supabase](https://supabase.com) (Postgres + Auth + Storage + API REST
autogenerada). Ver el plan completo de diseño para el detalle de decisiones.

## Puesta en marcha

### 1. Crear el proyecto de Supabase

1. Crea un proyecto nuevo en supabase.com.
2. En el SQL Editor, ejecuta en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_rls_policies.sql`
3. En **Authentication**, habilita el proveedor que vayas a usar (Email/Password o
   Magic Link) y crea los usuarios de los responsables (o usa invitaciones). El
   frontend (`pages/login.html`) usa Magic Link: el usuario ingresa su correo y
   recibe un enlace de acceso.

### 2. Importar los Excel existentes (una sola vez)

```bash
pip install openpyxl pandas supabase python-dotenv
export SUPABASE_URL=https://TU-PROYECTO.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...   # Project Settings -> API -> service_role (NO el anon key)
python scripts/import_excel_to_supabase.py --data-dir /ruta/a/SIGEI/data
```

Al final imprime los conteos por tabla — compáralos contra las filas reales de cada
`.xlsx` (528 fichas, 582 metas, 574 cambios, 56 procesos, 56 usuarios). Los archivos
`.xlsx` originales **no se modifican**; después de esta importación dejan de ser la
fuente de verdad.

### 3. Configurar el frontend

```bash
cp js/config.example.js js/config.js
# edita js/config.js con tu SUPABASE_URL y anon key (Project Settings -> API)
```

`js/config.js` está en `.gitignore` — no se sube al repo. El anon key es público
por diseño en apps client-side; la seguridad real la da RLS
(`0002_rls_policies.sql`), no ocultar esa key.

### 4. Flujo de aprobación (Power Automate)

1. Crea un flujo de Power Automate con disparador "Cuando se recibe una solicitud
   HTTP" y una acción que publique en el canal de Teams / envíe correo con los
   datos del payload (ver `supabase/functions/notify-approval/index.ts` para el
   shape del body: `idKawak`, `nombreIndicador`, `aprobadorCorreo`, `enlaceRevision`, etc.).
2. Despliega la Edge Function:
   ```bash
   supabase functions deploy notify-approval
   supabase secrets set POWER_AUTOMATE_WEBHOOK_URL=https://prod-xx.westus.logic.azure.com/...
   supabase secrets set APP_BASE_URL=https://tu-usuario.github.io/fichas-tecnicas-indicadores
   ```
3. En el Dashboard de Supabase, **Database > Webhooks**, crea un webhook: tabla
   `solicitudes_aprobacion`, evento `INSERT`, tipo "Edge Function", función
   `notify-approval`.

### 5. Desplegar en GitHub Pages

1. Sube este repo a GitHub.
2. Settings -> Pages -> Deploy from branch -> `main` / raíz.
3. Enlaza o incrusta `index.html` (o directamente `pages/consultar.html`) como
   sección dentro del sitio HTML institucional existente.

## Estructura

```
index.html, pages/*.html   -> vistas (Crear, Consultar, Editar, Imprimir/PDF)
css/main.css                -> tokens y layout general
css/ficha-print.css         -> especificación visual de la ficha (replica el PDF)
js/api/*.js                 -> wrappers CRUD sobre supabase-js, uno por tabla
js/views/*.js                -> lógica de cada página
js/views/fichaRender.js      -> construcción del DOM de la ficha (compartido lectura/edición/impresión)
scripts/import_excel_to_supabase.py -> ETL de un solo uso
supabase/migrations/*.sql    -> esquema y RLS
supabase/functions/notify-approval  -> Edge Function -> Power Automate
```

## Notas de diseño

- **Llave de negocio real: `id_kawak`** (equivalente a `Id Ind`; ver ficha #560 de
  referencia). Todo el módulo usa `id_kawak`, no un id autoincremental genérico.
- **Vocabulario de zonas de semáforo**: unificado a
  `deficiente/alerta/cumplimiento/sobrecumplimiento` con colores fijos
  (rojo/amarillo/verde/cian). Los dos nombres de origen que usan los Excel
  (`Satisfactorio/Sobresaliente` vs. `Cumplimiento/Sobrecumplimiento`) se reconcilian
  en el ETL, no en el frontend.
- **Variables dinámicas**: se guardan como `jsonb` (`variables: [{nombre, unidad,
  fuente}]`), no como columnas fijas `variable_1..N` — el formulario permite
  agregar/quitar variables sin límite fijo de 3.
- **PDF**: no hay backend para generarlo; la vista `pages/imprimir.html` replica el
  layout exacto de la ficha y usa `window.print()` (CSS `@media print`) para que el
  usuario lo guarde como PDF desde el navegador.
- **Control de cambios**: las ediciones generan un diff campo por campo (una fila
  por campo modificado); nunca se borra ni sobrescribe historial. Las filas
  importadas del Excel original quedan marcadas `campo_modificado = 'legacy'`.
