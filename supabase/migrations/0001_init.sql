-- SIGEI Fichas Técnicas de Indicadores — esquema inicial (Poligran, single-tenant)
-- Convención: nombres de columna en snake_case; llave de negocio = id_kawak.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Vocabulario fijo de zonas de semáforo (Deficiente/Alerta/Cumplimiento/Sobrecumplimiento)
-- Reconciliación: Ficha de indicadores.xlsx usa Deficiente/Alerta/Satisfactorio/Sobresaliente;
-- Metas_Historico.xlsx y el PDF de referencia usan Deficiente/Alerta/Cumplimiento/Sobrecumplimiento.
-- Se fija UN solo vocabulario aquí; el ETL mapea ambos orígenes a estos 4 niveles.
create table zonas_semaforo (
    nivel text primary key,          -- 'deficiente' | 'alerta' | 'cumplimiento' | 'sobrecumplimiento'
    etiqueta text not null,          -- texto a mostrar, ej. 'Sobrecumplimiento'
    color_hex text not null,
    color_texto text not null default '#ffffff',
    orden int not null
);

insert into zonas_semaforo (nivel, etiqueta, color_hex, color_texto, orden) values
    ('deficiente',        'Deficiente',        '#E53935', '#ffffff', 1),
    ('alerta',             'Alerta',             '#FFD400', '#000000', 2),
    ('cumplimiento',       'Cumplimiento',       '#2E7D32', '#ffffff', 3),
    ('sobrecumplimiento',  'Sobrecumplimiento',  '#29ABE2', '#ffffff', 4);

-- ---------------------------------------------------------------------------
-- Catálogos de listas desplegables (baja cardinalidad, ver DOC de plan §Catálogo)
create table catalogos (
    id uuid primary key default gen_random_uuid(),
    categoria text not null,   -- ej. 'tipo_indicador', 'clasificacion', 'linea_estrategica'...
    valor text not null,
    orden int not null default 0,
    unique (categoria, valor)
);

create index ix_catalogos_categoria on catalogos(categoria);

-- ---------------------------------------------------------------------------
-- Mapa de procesos (data/Mapa_de_procesos.xlsx)
create table mapa_procesos (
    id uuid primary key default gen_random_uuid(),
    unidad text,
    area text,
    proceso text,          -- Proceso_ps
    subproceso text,
    responsable text,
    tipo_proceso text
);

create index ix_mapa_procesos_proceso on mapa_procesos(proceso);
create index ix_mapa_procesos_subproceso on mapa_procesos(subproceso);

-- ---------------------------------------------------------------------------
-- Usuarios / responsables de aprobación (data/Usuarios.xlsx)
create table usuarios (
    id uuid primary key default gen_random_uuid(),
    proceso text,
    subproceso text,
    usuario_nivel_1 text,
    correo_nivel_1 text,
    usuario_nivel_2 text,
    correo_nivel_2 text,
    n_aprobaciones int default 0
);

create index ix_usuarios_proceso on usuarios(proceso, subproceso);

-- ---------------------------------------------------------------------------
-- Fichas técnicas de indicadores (data/Ficha de indicadores.xlsx)
create table indicadores (
    id_kawak int primary key,           -- llave de negocio real (== Id Ind históricamente)
    id_ind int,
    nombre_indicador text not null,
    descripcion text,
    unidad text,
    proceso text,
    subproceso text,
    linea_estrategica text,
    objetivo_estrategico text,
    tipo_indicador text,
    clasificacion text,
    subclasificacion text,
    clasificacion_cna text,
    frecuencia text,
    fecha_desde date,
    fecha_hasta date,
    tipo_variables text,        -- 'Serie Única' | 'Multiserie'
    series text,
    sentido text,                -- 'Positivo' | 'Negativo'
    formula text,
    variables jsonb not null default '[]',   -- [{nombre, unidad, fuente, orden}]

    -- metas y zonas (nivel Indicador)
    meta_frecuencia text,
    meta_sem1 text,
    meta_sem2 text,
    zona_deficiente text,
    zona_alerta text,
    zona_cumplimiento text,
    zona_sobrecumplimiento text,

    -- metas y zonas (nivel Serie, solo si tipo_variables = 'Multiserie')
    meta_serie_anual text,
    meta_sem1_serie text,
    meta_sem2_serie text,
    zona_deficiente_serie text,
    zona_alerta_serie text,
    zona_cumplimiento_serie text,
    zona_sobrecumplimiento_serie text,

    responsable_calculo text,
    responsable_analisis text,
    aprobador_1 text,
    aprobador_2 text,
    estado_aprobacion text default 'pendiente',
    estado_indicador text default 'Activo',

    formato_evidencia text,
    nombre_evidencia text,
    tipo_kawak text,

    created_at timestamptz not null default now(),
    created_by text,
    updated_at timestamptz not null default now(),
    updated_by text
);

create index ix_indicadores_proceso on indicadores(proceso, subproceso);
create index ix_indicadores_nombre on indicadores(nombre_indicador);

-- ---------------------------------------------------------------------------
-- Metas históricas (data/Metas_Historico.xlsx)
create table metas_historico (
    id uuid primary key default gen_random_uuid(),
    id_kawak int not null references indicadores(id_kawak) on delete cascade,
    nombre_indicador text,
    anio int not null,
    meta_frecuencia text,
    meta_sem1 text,
    meta_sem2 text,
    zona_sobrecumplimiento text,
    zona_cumplimiento text,
    zona_alerta text,
    zona_deficiente text,
    zona_sobrecumplimiento_serie text,
    zona_cumplimiento_serie text,
    zona_alerta_serie text,
    zona_deficiente_serie text,
    meta_serie_anual text,
    meta_sem1_serie text,
    meta_sem2_serie text,
    created_at timestamptz not null default now()
);

create index ix_metas_historico_id_kawak on metas_historico(id_kawak);
create index ix_metas_historico_anio on metas_historico(anio);

-- ---------------------------------------------------------------------------
-- Control de cambios (data/Control_Cambios.xlsx)
-- Filas importadas del Excel quedan como 'legacy' (campo_modificado = 'legacy', texto libre en valor_nuevo).
-- Filas generadas por la app desde ahora en adelante van campo por campo.
create table control_cambios (
    id uuid primary key default gen_random_uuid(),
    id_kawak int not null references indicadores(id_kawak) on delete cascade,
    nombre_indicador text,
    fecha_cambio timestamptz not null default now(),
    usuario_solicitud text not null,
    campo_modificado text not null,   -- 'legacy' para filas importadas del Excel
    valor_anterior text,
    valor_nuevo text,
    justificacion text
);

create index ix_control_cambios_id_kawak on control_cambios(id_kawak);
create index ix_control_cambios_fecha on control_cambios(fecha_cambio desc);

-- ---------------------------------------------------------------------------
-- Solicitudes de aprobación (flujo de aprobación)
create table solicitudes_aprobacion (
    id uuid primary key default gen_random_uuid(),
    id_kawak int not null references indicadores(id_kawak) on delete cascade,
    tipo text not null,                 -- 'creacion' | 'edicion'
    estado text not null default 'pendiente',  -- 'pendiente' | 'aprobado' | 'rechazado' | 'ajustes'
    nivel_aprobador int not null default 1,     -- 1 = Usuario_Nivel_1, 2 = Usuario_Nivel_2
    comentarios text,
    fecha_solicitud timestamptz not null default now(),
    fecha_decision timestamptz,
    decidido_por text
);

create index ix_solicitudes_id_kawak on solicitudes_aprobacion(id_kawak);
create index ix_solicitudes_estado on solicitudes_aprobacion(estado);

-- ---------------------------------------------------------------------------
-- Row Level Security: habilitado en todas las tablas; políticas de detalle
-- (quién puede editar según usuarios.correo_nivel_1/2 vs auth.email()) se agregan
-- en 0002_rls_policies.sql una vez definida la estrategia de Auth (ver plan).
alter table indicadores enable row level security;
alter table metas_historico enable row level security;
alter table control_cambios enable row level security;
alter table solicitudes_aprobacion enable row level security;
alter table mapa_procesos enable row level security;
alter table usuarios enable row level security;
alter table catalogos enable row level security;
alter table zonas_semaforo enable row level security;

-- Lectura abierta a cualquier usuario autenticado; escritura se restringe en 0002.
create policy read_all_authenticated on indicadores for select to authenticated using (true);
create policy read_all_authenticated on metas_historico for select to authenticated using (true);
create policy read_all_authenticated on control_cambios for select to authenticated using (true);
create policy read_all_authenticated on solicitudes_aprobacion for select to authenticated using (true);
create policy read_all_authenticated on mapa_procesos for select to authenticated using (true);
create policy read_all_authenticated on usuarios for select to authenticated using (true);
create policy read_all_authenticated on catalogos for select to authenticated using (true);
create policy read_all_authenticated on zonas_semaforo for select to authenticated using (true);
