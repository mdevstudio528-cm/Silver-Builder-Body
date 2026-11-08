/** Una fila de la pestaña "metas". Columnas A..K de la hoja. */
export type Prioridad = 'alta' | 'media' | 'baja';

export interface MetaRow {
  id: string;
  user_id: string;        // lo pone el servidor desde la sesión, nunca el cliente
  nombre: string;
  monto_objetivo: number;
  monto_actual: number;
  fecha_limite: string;   // YYYY-MM-DD
  prioridad: Prioridad;
  aporte_mensual: number; // 0 = el usuario no fijó uno; se sugiere calculado
  created_at: string;
  updated_at: string;
  deleted: number;        // 0 | 1
}
