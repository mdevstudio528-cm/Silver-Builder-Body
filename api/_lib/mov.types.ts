/** Una fila de la pestaña "movimientos". Columnas A..K de la hoja. */
export type Tipo = 'ingreso' | 'egreso';

export interface MovRow {
  id: string;
  user_id: string;      // SIEMPRE lo pone el servidor desde la sesión
  fecha: string;        // YYYY-MM-DD
  tipo: Tipo;
  categoria: string;
  descripcion: string;
  monto: number;
  metodo: string;
  created_at: string;
  updated_at: string;   // ISO — se usa para last-write-wins
  deleted: number;      // 0 | 1  (borrado lógico, nunca se destruye la fila)
}
