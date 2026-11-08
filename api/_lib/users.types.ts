export type Estatus = 'activo' | 'desactivado';
export type Rol = 'admin' | 'user';

/** Una fila de la pestaña "usuarios". Estos son los nombres exactos de las columnas A..O. */
export interface UserRow {
  id: string;
  nombre: string;
  ap_paterno: string;
  ap_materno: string;
  telefono: string;
  correo: string;
  hash: string;
  estatus: Estatus;
  rol: Rol;
  fecha_alta: string;
  ultimo_acceso: string;
  debe_cambiar_pass: number;
  session_version: number;
  intentos_fallidos: number;
  bloqueado_hasta: string;
}
