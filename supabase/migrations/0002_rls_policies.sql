-- Políticas de escritura. Punto de partida simple: cualquier usuario autenticado
-- (Supabase Auth) puede crear/editar fichas y registrar control de cambios; el
-- flujo de aprobación es lo que realmente autoriza el paso a producción, no el
-- INSERT/UPDATE en sí. Si más adelante se requiere restringir edición a
-- responsables específicos, añadir aquí una condición sobre
-- usuarios.correo_nivel_1/correo_nivel_2 = auth.jwt() ->> 'email'.

create policy insert_authenticated on indicadores for insert to authenticated with check (true);
create policy update_authenticated on indicadores for update to authenticated using (true) with check (true);

create policy insert_authenticated on metas_historico for insert to authenticated with check (true);

-- control_cambios: solo INSERT (nunca se edita ni borra un registro de auditoría).
create policy insert_authenticated on control_cambios for insert to authenticated with check (true);

create policy insert_authenticated on solicitudes_aprobacion for insert to authenticated with check (true);
create policy update_authenticated on solicitudes_aprobacion for update to authenticated using (true) with check (true);

create policy insert_authenticated on mapa_procesos for insert to authenticated with check (true);
create policy insert_authenticated on usuarios for insert to authenticated with check (true);
create policy insert_authenticated on catalogos for insert to authenticated with check (true);
