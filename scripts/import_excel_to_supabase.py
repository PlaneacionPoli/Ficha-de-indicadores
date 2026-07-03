"""ETL de un solo uso: migra los 5 Excel de origen (SharePoint export) a Supabase.

Después de correr esto, los .xlsx dejan de ser la fuente de verdad — la app solo
lee/escribe contra Supabase. Este script NO modifica los archivos .xlsx.

Uso:
    pip install openpyxl pandas supabase python-dotenv
    export SUPABASE_URL=...
    export SUPABASE_SERVICE_ROLE_KEY=...   # service role, no el anon key (bypassa RLS para la carga)
    python scripts/import_excel_to_supabase.py --data-dir /ruta/a/data

Verifica al final que los conteos de filas coincidan con los Excel de origen.
"""
from __future__ import annotations

import argparse
import os
import unicodedata
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

PLACEHOLDER_VALUES = {"seleccione", ""}

# Campos de catálogo fijo a extraer de "Ficha de indicadores.xlsx"
CATALOGO_COLUMNAS = {
    "tipo_indicador": "Tipo de Indicador",
    "clasificacion": "Clasificación",
    "subclasificacion": "SubClasificación",
    "linea_estrategica": "Linea_Estrategica",
    "objetivo_estrategico": "Objetivo_Estrategico",
    "frecuencia": "Frecuencia",
    "sentido": "Sentido",
    "tipo_variables": "Tipo de variables",
    "estado_indicador": "Estado_Indicador",
    "clasificacion_cna": "Clasificación_ CNA",
    "tipo_kawak": "Tipo_Kawak",
    "unidad_medida": "Unidad V1",  # + Unidad V2 / V3, se combinan abajo
}

# Reconciliación de vocabulario de zonas: ambos nombres de origen -> nivel canónico
ZONA_MAP = {
    "sobrecumplimiento": "sobrecumplimiento",
    "sobresaliente": "sobrecumplimiento",
    "cumplimiento": "cumplimiento",
    "satisfactorio": "cumplimiento",
    "alerta": "alerta",
    "deficiente": "deficiente",
    "peligro": "deficiente",
}


def _norm(s: str) -> str:
    if s is None:
        return ""
    s = unicodedata.normalize("NFKD", str(s)).strip()
    return s


def _clean(v):
    if v is None:
        return None
    s = str(v).strip()
    if s.lower() in PLACEHOLDER_VALUES:
        return None
    return s


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def load_sheet(path: Path, sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet_name, dtype=str)
    df.columns = [_norm(c) for c in df.columns]
    return df


def import_mapa_procesos(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Mapa_de_procesos.xlsx", "Hoja1")
    rows = []
    for _, r in df.iterrows():
        proceso = _clean(r.get("Proceso_ps"))
        if proceso is None:
            continue
        rows.append({
            "unidad": _clean(r.get("Unidad")),
            "area": _clean(r.get("Área")) or _clean(r.get("Area")),
            "proceso": proceso,
            "subproceso": _clean(r.get("Subproceso")),
            "responsable": _clean(r.get("Responsable")),
            "tipo_proceso": _clean(r.get("Tipo de proceso")),
        })
    if rows:
        sb.table("mapa_procesos").insert(rows).execute()
    return len(rows)


def import_usuarios(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Usuarios.xlsx", "Hoja1")
    rows = []
    for _, r in df.iterrows():
        proceso = _clean(r.get("Procesos_p"))
        if proceso is None:
            continue
        rows.append({
            "proceso": proceso,
            "subproceso": _clean(r.get("Subproceso")),
            "usuario_nivel_1": _clean(r.get("Usuario_Nivel_1")),
            "correo_nivel_1": _clean(r.get("Correo_Nivel_1")),
            "usuario_nivel_2": _clean(r.get("Usuario_Nivel_2")),
            "correo_nivel_2": _clean(r.get("Correo_Nivel_2")),
            "n_aprobaciones": int(_clean(r.get("N_Aprobaciones")) or 0),
        })
    if rows:
        sb.table("usuarios").insert(rows).execute()
    return len(rows)


def _extract_variables(r: pd.Series) -> list[dict]:
    variables = []
    for i in (1, 2, 3):
        nombre = _clean(r.get(f"Variable {i}"))
        if nombre is None:
            continue
        variables.append({
            "nombre": nombre,
            "unidad": _clean(r.get(f"Unidad V{i}")),
            "fuente": _clean(r.get(f"Fuente V{i}")),
            "orden": i,
        })
    return variables


def _zona(r: pd.Series, excel_col: str) -> str | None:
    """Traduce una columna de zona del Excel (nombre variable según archivo) al nivel canónico."""
    val = _clean(r.get(excel_col))
    return val  # el valor en sí (rango) se guarda tal cual; el nivel ya está fijo por columna destino


def import_indicadores(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Ficha de indicadores.xlsx", "BD FICHAS IND")
    rows = []
    for _, r in df.iterrows():
        id_kawak = _clean(r.get("ID Kawak"))
        if id_kawak is None:
            continue
        rows.append({
            "id_kawak": int(id_kawak),
            "id_ind": int(_clean(r.get("Id Ind")) or id_kawak),
            "nombre_indicador": _clean(r.get("Nombre del indicador")),
            "descripcion": _clean(r.get("Descripción del indicador")),
            "unidad": _clean(r.get("Unidad")),
            "proceso": _clean(r.get("Proceso/Subproceso")),
            "subproceso": None,  # 'Proceso/Subproceso' viene combinado en el Excel origen; separar manualmente si aplica
            "linea_estrategica": _clean(r.get("Linea_Estrategica")),
            "objetivo_estrategico": _clean(r.get("Objetivo_Estrategico")),
            "tipo_indicador": _clean(r.get("Tipo de Indicador")),
            "clasificacion": _clean(r.get("Clasificación")),
            "subclasificacion": _clean(r.get("SubClasificación")),
            "clasificacion_cna": _clean(r.get("Clasificación_ CNA")),
            "frecuencia": _clean(r.get("Frecuencia")),
            "fecha_desde": _clean(r.get("Fecha Desde")),
            "fecha_hasta": _clean(r.get("Fecha Hasta")),
            "tipo_variables": _clean(r.get("Tipo de variables")),
            "series": _clean(r.get("Series")),
            "sentido": _clean(r.get("Sentido")),
            "formula": _clean(r.get("Formula")),
            "variables": _extract_variables(r),
            "meta_frecuencia": _clean(r.get("Meta Frecuencia")),
            "meta_sem1": _clean(r.get("Semestre_1")),
            "meta_sem2": _clean(r.get("Semestre_2")),
            "zona_deficiente": _zona(r, "Deficiente"),
            "zona_alerta": _zona(r, "Alerta"),
            "zona_cumplimiento": _zona(r, "Satisfactorio"),
            "zona_sobrecumplimiento": _zona(r, "Sobresaliente"),
            "meta_serie_anual": _clean(r.get("Meta Anual Series")),
            "meta_sem1_serie": _clean(r.get("Meta 1 Semestre Serie")),
            "meta_sem2_serie": _clean(r.get("Meta 2 Semestre Serie")),
            "zona_deficiente_serie": _zona(r, "Deficiente <= Serie"),
            "zona_alerta_serie": _zona(r, "Alerta Serie"),
            "zona_cumplimiento_serie": _zona(r, "Satisfactorio Serie"),
            "zona_sobrecumplimiento_serie": _zona(r, "Sobresaliente >= Serie"),
            "responsable_calculo": _clean(r.get("Responsable del calculo")),
            "responsable_analisis": _clean(r.get("Responsable del analisis")),
            "aprobador_1": _clean(r.get("Usuario_Aprobador")),
            "aprobador_2": None,
            "estado_aprobacion": _clean(r.get("Estado_aprobacion")) or "pendiente",
            "estado_indicador": _clean(r.get("Estado_Indicador")) or "Activo",
            "formato_evidencia": _clean(r.get("Formato_Evidencia")),
            "nombre_evidencia": _clean(r.get("Nombre_Evidencia")),
            "tipo_kawak": _clean(r.get("Tipo_Kawak")),
            "created_by": _clean(r.get("Creado por")),
        })
    # Insertar en lotes de 200 para no exceder límites de payload
    for i in range(0, len(rows), 200):
        sb.table("indicadores").insert(rows[i:i + 200]).execute()
    return len(rows)


def import_metas_historico(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Metas_Historico.xlsx", "METAS")
    rows = []
    for _, r in df.iterrows():
        id_kawak = _clean(r.get("ID_Kawak"))
        anio = _clean(r.get("Año")) or _clean(r.get("Año"))
        if id_kawak is None or anio is None:
            continue
        rows.append({
            "id_kawak": int(id_kawak),
            "nombre_indicador": _clean(r.get("Nombre del Indicador")),
            "anio": int(anio),
            "meta_frecuencia": _clean(r.get("Meta_Frecuencia")),
            "meta_sem1": _clean(r.get("Meta_Sem1")),
            "meta_sem2": _clean(r.get("Meta_Sem2")),
            "zona_sobrecumplimiento": _clean(r.get("Sobrecumplimiento")),
            "zona_cumplimiento": _clean(r.get("Cumplimiento")),
            "zona_alerta": _clean(r.get("Alerta")),
            "zona_deficiente": _clean(r.get("Peligro")),
            "zona_sobrecumplimiento_serie": _clean(r.get("Sobrecumplimiento_Serie")),
            "zona_cumplimiento_serie": _clean(r.get("Cumplimiento_Serie")),
            "zona_alerta_serie": _clean(r.get("Alerta_Serie")),
            "zona_deficiente_serie": _clean(r.get("Peligro_Serie")),
            "meta_serie_anual": _clean(r.get("Meta_Serie_Anual")),
            "meta_sem1_serie": _clean(r.get("Meta_Sem1_Serie")),
            "meta_sem2_serie": _clean(r.get("Meta_Sem2_Serie")),
        })
    # Solo insertar metas cuyo id_kawak ya exista en indicadores (integridad referencial)
    existentes = {row["id_kawak"] for row in sb.table("indicadores").select("id_kawak").execute().data}
    rows = [r for r in rows if r["id_kawak"] in existentes]
    for i in range(0, len(rows), 200):
        sb.table("metas_historico").insert(rows[i:i + 200]).execute()
    return len(rows)


def import_control_cambios(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Control_Cambios.xlsx", "Hoja1")
    rows = []
    for _, r in df.iterrows():
        id_kawak = _clean(r.get("ID_Kawak"))
        if id_kawak is None:
            continue
        rows.append({
            "id_kawak": int(id_kawak),
            "nombre_indicador": _clean(r.get("Nombre del indicador")),
            "fecha_cambio": str(r.get("Fecha_Cambio")) if r.get("Fecha_Cambio") is not None else None,
            "usuario_solicitud": _clean(r.get("Usuario_Solicitud")) or "desconocido",
            "campo_modificado": "legacy",
            "valor_anterior": None,
            "valor_nuevo": _clean(r.get("Cambios")),
            "justificacion": None,
        })
    existentes = {row["id_kawak"] for row in sb.table("indicadores").select("id_kawak").execute().data}
    rows = [r for r in rows if r["id_kawak"] in existentes]
    for i in range(0, len(rows), 200):
        sb.table("control_cambios").insert(rows[i:i + 200]).execute()
    return len(rows)


def import_catalogos(sb: Client, data_dir: Path) -> int:
    df = load_sheet(data_dir / "Ficha de indicadores.xlsx", "BD FICHAS IND")
    rows = []
    for categoria, col in CATALOGO_COLUMNAS.items():
        if categoria == "unidad_medida":
            valores = set()
            for c in ("Unidad V1", "Unidad V2", "Unidad V3"):
                valores |= {v for v in df.get(c, pd.Series(dtype=str)).map(_clean) if v}
        else:
            valores = {v for v in df.get(col, pd.Series(dtype=str)).map(_clean) if v}
        for orden, valor in enumerate(sorted(valores)):
            rows.append({"categoria": categoria, "valor": valor, "orden": orden})
    if rows:
        sb.table("catalogos").insert(rows).execute()
    return len(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, required=True, help="Carpeta con los 5 .xlsx de origen")
    args = parser.parse_args()

    sb = get_client()

    print("Importando mapa_procesos...", n := import_mapa_procesos(sb, args.data_dir))
    print("Importando usuarios...", n := import_usuarios(sb, args.data_dir))
    print("Importando catálogos...", n := import_catalogos(sb, args.data_dir))
    print("Importando indicadores...", n := import_indicadores(sb, args.data_dir))
    print("Importando metas_historico...", n := import_metas_historico(sb, args.data_dir))
    print("Importando control_cambios...", n := import_control_cambios(sb, args.data_dir))

    print("\nVerificación: compara estos conteos contra las filas reales de cada .xlsx")
    for tabla in ("indicadores", "metas_historico", "control_cambios", "mapa_procesos", "usuarios", "catalogos"):
        count = sb.table(tabla).select("*", count="exact").limit(1).execute()
        print(f"  {tabla}: {count.count}")


if __name__ == "__main__":
    main()
