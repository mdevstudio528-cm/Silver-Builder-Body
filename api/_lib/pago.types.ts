/**
 * Una fila de la pestaña "pagos". Nombres exactos de las columnas A..K.
 *
 * Un cobro cubre un periodo: `meses` meses desde `periodo_desde` hasta
 * `periodo_hasta` (ambos inclusive como fecha de corte).
 */
export interface PagoRow {
  id: string;
  user_id: string;
  fecha_pago: string;
  monto: number;
  metodo: string;
  meses: number;
  periodo_desde: string;
  periodo_hasta: string;
  notas: string;
  created_at: string;
  updated_at: string;
  deleted: number;
}

export const METODOS = ['efectivo', 'transferencia', 'deposito', 'otro'] as const;
export type MetodoPago = (typeof METODOS)[number];
