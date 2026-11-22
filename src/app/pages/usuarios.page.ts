import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API, mensajeError } from '../core/api';
import { money, moneyCorto, etiquetaMes } from '../core/finance';

interface FilaUsuario {
  id: string; nombre: string; ap_paterno?: string; ap_materno?: string; apellido: string;
  telefono: string; correo: string;
  estatus: 'activo' | 'desactivado'; rol: 'admin' | 'user';
  fecha_alta: string; ultimo_acceso: string; debeCambiarPass: boolean;
}

interface MovFila {
  id: string; fecha: string; tipo: 'ingreso' | 'egreso';
  categoria: string; descripcion: string; monto: number; metodo: string;
}

interface SerieMes { ym: string; ingresos: number; egresos: number; balance: number; movimientos: number; }

interface Detalle {
  user: FilaUsuario;
  hoy: string;
  totales: {
    ingresosMes: number; egresosMes: number; balanceMes: number;
    ingresosTotal: number; egresosTotal: number; movimientos: number;
    metas: number; metasObjetivo: number; metasAhorrado: number;
    pagos: number; cobrado: number;
  };
  serie: SerieMes[];
  sinDatosEnRango?: boolean;
  mesAncla?: string;
  fechasInvalidas?: number;
  porCategoria: { categoria: string; monto: number }[];
  movimientos: MovFila[];
  metas: { id: string; nombre: string; monto_objetivo: number; monto_actual: number; fecha_limite: string; prioridad: string }[];
  pagos: { id: string; fecha_pago: string; monto: number; metodo: string; meses: number; periodo_desde: string; periodo_hasta: string }[];
}

interface Barra { x: number; y: number; h: number; alto: number; etiqueta: string; valor: number; tipo: 'ingreso' | 'egreso'; }

/** Mismo criterio que el servidor: sin acentos, minúsculas, teléfono solo dígitos sin +52. */
const plano = (s: any) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const digitos = (s: any) => String(s ?? '').replace(/\D/g, '').replace(/^52(?=\d{10}$)/, '');

@Component({
  selector: 'afz-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Usuarios</h1>
        <p>Da de alta, edita, revisa o elimina a tus clientes.</p>
      </div>
      <button class="btn" (click)="abrirNuevo()">＋ Nuevo usuario</button>
    </div>

    @if (error()) { <div class="alert alert--bad" style="margin-bottom:14px">{{ error() }}</div> }
    @if (aviso()) { <div class="alert alert--ok" style="margin-bottom:14px">{{ aviso() }}</div> }

    <div class="grid grid--3" style="margin-bottom:16px">
      <div class="card"><div class="kpi__label">Total</div><div class="kpi__value">{{ filas().length }}</div></div>
      <div class="card"><div class="kpi__label">Activos</div><div class="kpi__value" style="color:var(--ok)">{{ activos() }}</div></div>
      <div class="card"><div class="kpi__label">Desactivados</div><div class="kpi__value" style="color:var(--bad)">{{ desactivados() }}</div></div>
    </div>

    <!-- BUSCADOR: nombre, apellidos, correo o teléfono -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input style="flex:1 1 220px;min-width:0;max-width:100%"
               placeholder="Buscar por nombre o teléfono…"
               [ngModel]="q()" (ngModelChange)="q.set($event)" autocomplete="off">
        @if (q()) {
          <button class="btn btn--ghost btn--sm" (click)="q.set('')">✕ Limpiar</button>
        }
        <span class="nota" style="margin-left:auto">
          {{ filtradas().length }} de {{ filas().length }}
        </span>
      </div>
      @if (q()) {
        <div class="nota" style="margin-top:8px">
          Buscando “<b style="color:var(--txt)">{{ q() }}</b>” en nombre, apellidos, correo y teléfono.
          Acepta solo dígitos del teléfono (7713535455) o con espacios (+52 771 353 5455).
        </div>
      }
    </div>

    <div class="card" style="padding:0;overflow:hidden;border-radius:16px">
      @if (cargando()) {
        <div style="padding:32px;text-align:center;color:var(--muted)">Cargando…</div>
      } @else if (filtradas().length === 0) {
        <div style="padding:36px;text-align:center;color:var(--muted)">
          <b style="display:block;color:var(--txt);margin-bottom:6px">
            {{ filas().length === 0 ? 'Aún no hay usuarios' : 'Ningún usuario coincide' }}
          </b>
          {{ filas().length === 0 ? 'Crea el primero con el botón de arriba.' : 'Prueba con otra parte del nombre o del teléfono.' }}
        </div>
      } @else {
        <div class="tbl-wrap">
        <table class="tbl tbl--cards">
          <thead>
            <tr>
              <th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Estatus</th>
              <th>Último acceso</th><th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filtradas(); track u.id) {
              <tr>
                <td class="celda-nombre">
                  <div>{{ u.nombre }} {{ u.apellido }}</div>
                  @if (u.rol === 'admin') { <span class="pill" style="margin-top:4px">admin</span> }
                  @if (u.debeCambiarPass) { <span class="pill" style="margin-top:4px">pass temporal</span> }
                </td>
                <td data-label="Correo" style="color:var(--muted)"><span style="word-break:break-all">{{ u.correo }}</span></td>
                <td data-label="Teléfono" style="color:var(--muted)" class="mono">{{ u.telefono || '—' }}</td>
                <td data-label="Estatus">
                  <span class="pill" [class.pill--ok]="u.estatus === 'activo'" [class.pill--bad]="u.estatus !== 'activo'">
                    {{ u.estatus === 'activo' ? '● Activo' : '● Desactivado' }}
                  </span>
                </td>
                <td data-label="Último acceso" style="color:var(--muted)" class="mono">{{ u.ultimo_acceso || 'nunca' }}</td>
                <td data-label="" class="acciones">
                  <button class="btn btn--sm" (click)="abrirDetalle(u)">📊 Ver</button>
                  <button class="btn btn--ghost btn--sm" (click)="abrirEditar(u)">✏️ Editar</button>
                  @if (u.estatus === 'activo') {
                    <button class="btn btn--danger btn--sm" (click)="cambiarEstatus(u, 'desactivar')">Desactivar</button>
                  } @else {
                    <button class="btn btn--sm" (click)="cambiarEstatus(u, 'activar')">Activar</button>
                  }
                  <button class="btn btn--ghost btn--sm" (click)="resetPass(u)">Reset pass</button>
                  <button class="btn btn--danger btn--sm" (click)="abrirBorrar(u)">🗑 Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>
      }
    </div>

    <!-- ==================== ALTA ==================== -->
    @if (modal()) {
      <div class="modal" (click)="cerrarModal($event)">
        <div class="modal__box">
          <h3>Nuevo usuario</h3>
          @if (errorModal()) { <div class="alert alert--bad" style="margin-bottom:12px">{{ errorModal() }}</div> }

          <form (ngSubmit)="crear()" novalidate>
            <div class="form-row form-row--2">
              <label class="field">Nombre(s)
                <input name="nombre" [(ngModel)]="nuevo.nombre" autocomplete="off"
                       [style.border-color]="tocado && !nuevo.nombre.trim() ? 'var(--bad)' : null">
                @if (tocado && !nuevo.nombre.trim()) { <small class="nota" style="color:var(--bad)">Escribe el nombre.</small> }
              </label>
              <label class="field">Apellido paterno
                <input name="ap_paterno" [(ngModel)]="nuevo.ap_paterno" autocomplete="off"
                       [style.border-color]="tocado && !nuevo.ap_paterno.trim() ? 'var(--bad)' : null">
                @if (tocado && !nuevo.ap_paterno.trim()) { <small class="nota" style="color:var(--bad)">Escribe el apellido paterno.</small> }
              </label>
            </div>
            <div class="form-row form-row--2">
              <label class="field">Apellido materno (opcional)
                <input name="ap_materno" [(ngModel)]="nuevo.ap_materno" autocomplete="off">
              </label>
              <label class="field">Teléfono (10 dígitos)
                <input name="telefono" [(ngModel)]="nuevo.telefono" inputmode="numeric"
                       (input)="limpiarTelefono($event)" placeholder="7713535455"
                       [style.border-color]="tocado && telDigitos.length < 10 ? 'var(--bad)' : null">
                @if (tocado && telDigitos.length < 10) {
                  <small class="nota" style="color:var(--bad)">Solo números, 10 dígitos. Llevas {{ telDigitos.length }}.</small>
                }
              </label>
            </div>
            <label class="field">Correo
              <input type="email" name="correo" [(ngModel)]="nuevo.correo" autocomplete="off"
                     placeholder="cliente@correo.com"
                     [style.border-color]="tocado && !correoOk ? 'var(--bad)' : null">
              @if (tocado && !correoOk) { <small class="nota" style="color:var(--bad)">Escribe un correo válido.</small> }
            </label>
            <label class="field">Rol de la cuenta
              <select name="rol" [(ngModel)]="nuevo.rol">
                <option value="user">Cliente (usuario normal)</option>
                <option value="admin">Administrador (también da de alta y cobra)</option>
              </select>
            </label>
            <label class="field">Contraseña (opcional: si la dejas vacía se genera una temporal)
              <span class="ojo">
                <input [type]="verPass() ? 'text' : 'password'" name="password" [(ngModel)]="nuevo.password"
                       placeholder="••••••••" autocomplete="new-password">
                <button type="button" class="ojo__btn" (click)="verPass.set(!verPass())"
                        [attr.aria-label]="verPass() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                        [title]="verPass() ? 'Ocultar' : 'Mostrar'">{{ verPass() ? '🙈' : '👁' }}</button>
              </span>
              @if (nuevo.password) {
                <small class="nota">Mínimo 8 caracteres, con letra y número, y que no contenga el correo.</small>
              }
            </label>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button type="button" class="btn btn--ghost" (click)="modal.set(false)">Cancelar</button>
              <button type="submit" class="btn" [disabled]="creando() || !formOk">
                {{ creando() ? 'Creando…' : 'Crear usuario' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ==================== EDITAR ==================== -->
    @if (editando()) {
      <div class="modal" (click)="cerrarEditar($event)">
        <div class="modal__box">
          <h3>Editar a {{ editando()!.nombre }}</h3>
          @if (errorModal()) { <div class="alert alert--bad" style="margin-bottom:12px">{{ errorModal() }}</div> }

          <form (ngSubmit)="guardarEdicion()" novalidate>
            <div class="form-row form-row--2">
              <label class="field">Nombre(s)
                <input name="e_nombre" [(ngModel)]="edit.nombre" autocomplete="off">
              </label>
              <label class="field">Apellido paterno
                <input name="e_ap" [(ngModel)]="edit.ap_paterno" autocomplete="off">
              </label>
            </div>
            <div class="form-row form-row--2">
              <label class="field">Apellido materno
                <input name="e_am" [(ngModel)]="edit.ap_materno" autocomplete="off">
              </label>
              <label class="field">Teléfono (10 dígitos)
                <input name="e_tel" [(ngModel)]="edit.telefono" inputmode="numeric" (input)="limpiarTelefonoEdit($event)">
                <small class="nota">Solo dígitos. Llevas {{ editTelDigitos.length }}.</small>
              </label>
            </div>
            <label class="field">Correo (es con lo que inicia sesión)
              <input type="email" name="e_correo" [(ngModel)]="edit.correo" autocomplete="off">
              <small class="nota">Si lo cambias, se cierran sus sesiones abiertas.</small>
            </label>
            <label class="field">Rol de la cuenta
              <select name="e_rol" [(ngModel)]="edit.rol">
                <option value="user">Cliente (usuario normal)</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
              <button type="button" class="btn btn--ghost" (click)="editando.set(null)">Cancelar</button>
              <button type="submit" class="btn" [disabled]="guardando()">
                {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- ==================== ELIMINAR ==================== -->
    @if (borrando()) {
      <div class="modal" (click)="cerrarBorrar($event)">
        <div class="modal__box">
          <h3 style="color:var(--bad)">Eliminar a {{ borrando()!.nombre }} {{ borrando()!.apellido }}</h3>
          <div class="alert alert--bad">
            Esto <b>borra de la hoja</b> su cuenta y todo lo suyo: ingresos, egresos, metas y pagos.
            No se puede deshacer.
          </div>

          @if (cargandoBorrar()) {
            <p class="nota" style="margin-top:12px">Contando lo que se va a borrar…</p>
          } @else if (conteoBorrar()) {
            <div class="card" style="margin-top:12px">
              <div class="nota">Se eliminarán</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
                <div><b class="mono">{{ conteoBorrar()!.movimientos }}</b> <span class="nota">movimientos</span></div>
                <div><b class="mono">{{ conteoBorrar()!.metas }}</b> <span class="nota">metas</span></div>
                <div><b class="mono">{{ conteoBorrar()!.pagos }}</b> <span class="nota">pagos</span></div>
                <div><b class="mono">{{ money(conteoBorrar()!.cobrado) }}</b> <span class="nota">cobrado</span></div>
              </div>
            </div>
          }

          <label class="field" style="margin-top:12px">
            Escribe <b style="color:var(--bad)">BORRAR</b> para confirmar
            <input name="conf" [(ngModel)]="confirmacion" autocomplete="off" placeholder="BORRAR">
          </label>

          <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button class="btn btn--ghost" (click)="borrando.set(null)">Cancelar</button>
            <button class="btn btn--danger" [disabled]="confirmacion.trim().toUpperCase() !== 'BORRAR' || eliminando()"
                    (click)="confirmarBorrado()">
              {{ eliminando() ? 'Eliminando…' : 'Eliminar definitivamente' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ==================== DETALLE + GRÁFICAS ==================== -->
    @if (detalle()) {
      <div class="modal" (click)="cerrarDetalle($event)">
        <div class="modal__box" style="max-width:940px">
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
            <div>
              <h3 style="margin:0">{{ detalle()!.user.nombre }} {{ detalle()!.user.apellido }}</h3>
              <div class="nota">{{ detalle()!.user.correo }} · {{ detalle()!.user.telefono }}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="pill" [class.pill--ok]="detalle()!.user.estatus === 'activo'"
                    [class.pill--bad]="detalle()!.user.estatus !== 'activo'">
                {{ detalle()!.user.estatus === 'activo' ? '● Activo' : '● Desactivado' }}
              </span>
              <button class="btn btn--ghost btn--sm" (click)="detalle.set(null)">Cerrar</button>
            </div>
          </div>

          @if (cargandoDetalle()) {
            <p class="nota" style="margin-top:16px">Leyendo sus movimientos…</p>
          } @else {
            <!-- KPIs del mes -->
            <div class="grid grid--3" style="margin-top:16px">
              <div class="card">
                <div class="kpi__label">Ingresos de {{ mesHoy() }}</div>
                <div class="kpi__value" style="color:var(--ok)">{{ money(detalle()!.totales.ingresosMes) }}</div>
              </div>
              <div class="card">
                <div class="kpi__label">Egresos de {{ mesHoy() }}</div>
                <div class="kpi__value" style="color:var(--bad)">{{ money(detalle()!.totales.egresosMes) }}</div>
              </div>
              <div class="card">
                <div class="kpi__label">Balance de {{ mesHoy() }}</div>
                <div class="kpi__value" [style.color]="detalle()!.totales.balanceMes >= 0 ? 'var(--brand)' : 'var(--bad)'">
                  {{ money(detalle()!.totales.balanceMes) }}
                </div>
              </div>
            </div>

            <!-- GRAFICA 1: columnas ingresos vs egresos, ultimos 6 meses -->
            <div class="card" style="margin-top:14px">
              <div class="kpi__label">Ingresos vs egresos · últimos 6 meses</div>
              @if (sinDatosSerie()) {
                <p class="nota" style="margin-top:8px;color:#fbbf24">
                  No hay movimientos entre {{ rangoSerie() }}. Si este usuario sí tiene datos,
                  sus fechas no se pudieron leer o están fuera de ese rango: en la hoja deben
                  estar como AAAA-MM-DD.
                </p>
              }
              @if (detalle()!.fechasInvalidas) {
                <p class="nota" style="margin-top:6px;color:#fbbf24">
                  {{ detalle()!.fechasInvalidas }} movimiento(s) con fecha ilegible: no entran en estas cuentas.
                </p>
              }
              <div style="display:flex;gap:14px;margin:8px 0 4px">
                <span class="nota"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--ok);margin-right:5px"></i>Ingresos</span>
                <span class="nota"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--bad);margin-right:5px"></i>Egresos</span>
                @if (haySerie()) {
                  <span class="nota" style="margin-left:auto">Máximo: {{ moneyCorto(maxSerie()) }}</span>
                }
              </div>
              <svg viewBox="0 0 640 200" style="width:100%;height:auto;display:block" role="img"
                   [attr.aria-label]="'Ingresos y egresos de los últimos 6 meses de ' + detalle()!.user.nombre">
                @for (g of guias(); track g) {
                  <line [attr.x1]="44" [attr.x2]="636" [attr.y1]="g" [attr.y2]="g"
                        stroke="currentColor" stroke-opacity="0.12" stroke-width="1"/>
                }
                @for (b of barras(); track b.x + '-' + b.tipo) {
                  <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="14" [attr.height]="b.h" rx="3"
                        [attr.fill]="b.tipo === 'ingreso' ? 'var(--ok)' : 'var(--bad)'">
                    <title>{{ b.etiqueta }}: {{ money(b.valor) }}</title>
                  </rect>
                }
                @for (l of etiquetas(); track l.x) {
                  <text [attr.x]="l.x" [attr.y]="192" text-anchor="middle"
                        font-size="11" fill="currentColor" fill-opacity="0.6">{{ l.texto }}</text>
                }
              </svg>
            </div>

            <!-- GRAFICA 2: egresos por categoria -->
            <div class="card" style="margin-top:14px">
              <div class="kpi__label">En qué se le va el dinero (egresos por categoría)</div>
              @if (detalle()!.porCategoria.length === 0) {
                <p class="nota" style="margin-top:10px">Este usuario no tiene egresos registrados.</p>
              } @else {
                <div style="margin-top:10px;display:flex;flex-direction:column;gap:9px">
                  @for (c of detalle()!.porCategoria; track c.categoria) {
                    <div>
                      <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px">
                        <span style="color:var(--txt)">{{ c.categoria }}</span>
                        <span class="mono nota">{{ money(c.monto) }}</span>
                      </div>
                      <div class="bar" style="margin-top:4px">
                        <div class="bar__fill" [style.width.%]="(c.monto / maxCategoria()) * 100"
                             style="background:var(--bad)"></div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Totales historicos y metas -->
            <div class="grid grid--2" style="margin-top:14px">
              <div class="card">
                <div class="kpi__label">Histórico</div>
                <div class="nota" style="margin-top:8px;line-height:1.9">
                  Ingresos totales: <b style="color:var(--ok)">{{ money(detalle()!.totales.ingresosTotal) }}</b><br>
                  Egresos totales: <b style="color:var(--bad)">{{ money(detalle()!.totales.egresosTotal) }}</b><br>
                  Movimientos: <b style="color:var(--txt)">{{ detalle()!.totales.movimientos }}</b><br>
                  Cobrado (mensualidades): <b style="color:var(--txt)">{{ money(detalle()!.totales.cobrado) }}</b>
                  en {{ detalle()!.totales.pagos }} pago(s)
                </div>
              </div>
              <div class="card">
                <div class="kpi__label">Metas · {{ detalle()!.totales.metas }}</div>
                <div class="nota" style="margin-top:8px">
                  Ahorrado {{ money(detalle()!.totales.metasAhorrado) }} de
                  {{ money(detalle()!.totales.metasObjetivo) }}
                </div>
                @if (detalle()!.metas.length === 0) {
                  <p class="nota" style="margin-top:8px">Sin metas todavía.</p>
                } @else {
                  <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">
                    @for (m of detalle()!.metas; track m.id) {
                      <div>
                        <div style="display:flex;justify-content:space-between;gap:8px;font-size:13px">
                          <span>{{ m.nombre }}</span>
                          <span class="mono nota">{{ money(m.monto_actual) }} / {{ money(m.monto_objetivo) }}</span>
                        </div>
                        <div class="bar" style="margin-top:4px">
                          <div class="bar__fill" [style.width.%]="pctMeta(m)"></div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Movimientos -->
            <div class="card" style="margin-top:14px;padding:0;overflow:hidden">
              <div style="padding:14px 14px 0"><div class="kpi__label">Movimientos recientes</div></div>
              @if (detalle()!.movimientos.length === 0) {
                <p class="nota" style="padding:14px">No ha registrado ingresos ni egresos.</p>
              } @else {
                <div class="tbl-wrap">
                  <table class="tbl tbl--cards">
                    <thead>
                      <tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th style="text-align:right">Monto</th></tr>
                    </thead>
                    <tbody>
                      @for (m of detalle()!.movimientos; track m.id) {
                        <tr>
                          <td data-label="Fecha" class="mono">{{ m.fecha }}</td>
                          <td data-label="Tipo">
                            <span class="pill" [class.pill--ok]="m.tipo === 'ingreso'" [class.pill--bad]="m.tipo === 'egreso'">
                              {{ m.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Egreso' }}
                            </span>
                          </td>
                          <td data-label="Categoría" style="color:var(--muted)">{{ m.categoria }}</td>
                          <td data-label="Descripción">{{ m.descripcion || '—' }}</td>
                          <td data-label="Monto" class="mono" style="text-align:right"
                              [style.color]="m.tipo === 'ingreso' ? 'var(--ok)' : 'var(--bad)'">
                            {{ money(m.monto) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ==================== CREDENCIALES (una sola vez) ==================== -->
    @if (credenciales()) {
      <div class="modal">
        <div class="modal__box">
          <h3>Contraseña temporal</h3>
          <div class="alert alert--warn">
            Cópiala ahora: <b>no se puede volver a mostrar</b>. El usuario deberá cambiarla en su primer acceso.
          </div>
          <div class="card" style="margin-top:12px;text-align:center">
            <div class="nota">Correo</div>
            <div style="font-weight:700;margin:4px 0 12px">{{ credenciales()!.correo }}</div>
            <div class="nota">Contraseña</div>
            <div class="mono" style="font-size:20px;font-weight:800;letter-spacing:.06em;margin-top:4px">
              {{ credenciales()!.password }}
            </div>
          </div>
          <button class="btn btn--block" style="margin-top:14px" (click)="credenciales.set(null)">Listo, ya la guardé</button>
        </div>
      </div>
    }
  `
})
export class UsuariosPage {
  private http = inject(HttpClient);

  money = money;
  moneyCorto = moneyCorto;
  etiquetaMes = etiquetaMes;

  filas = signal<FilaUsuario[]>([]);
  cargando = signal(true);
  creando = signal(false);
  guardando = signal(false);
  eliminando = signal(false);
  error = signal('');
  errorModal = signal('');
  aviso = signal('');
  modal = signal(false);
  tocado = false;
  verPass = signal(false);
  credenciales = signal<{ correo: string; password: string } | null>(null);

  /** buscador */
  q = signal('');

  /** edición */
  editando = signal<FilaUsuario | null>(null);
  edit = { nombre: '', ap_paterno: '', ap_materno: '', telefono: '', correo: '', rol: 'user' as 'user' | 'admin' };

  /** borrado */
  borrando = signal<FilaUsuario | null>(null);
  conteoBorrar = signal<{ movimientos: number; metas: number; pagos: number; cobrado: number } | null>(null);
  cargandoBorrar = signal(false);
  confirmacion = '';

  /** detalle */
  detalle = signal<Detalle | null>(null);
  cargandoDetalle = signal(false);

  activos = computed(() => this.filas().filter(u => u.estatus === 'activo').length);
  desactivados = computed(() => this.filas().filter(u => u.estatus !== 'activo').length);

  /** Filtro local: instantáneo, mismas reglas que el servidor. */
  filtradas = computed(() => {
    const texto = plano(this.q());
    if (!texto) return this.filas();
    const nums = digitos(this.q());
    return this.filas().filter(u => {
      const nombre = plano(`${u.nombre} ${u.ap_paterno ?? ''} ${u.ap_materno ?? ''} ${u.apellido ?? ''}`);
      const correo = plano(u.correo);
      const tel = digitos(u.telefono);
      if (nombre.includes(texto) || correo.includes(texto)) return true;
      if (nums.length >= 2 && tel && (tel.includes(nums) || tel.endsWith(nums.slice(-10)))) return true;
      const partes = texto.split(/\s+/).filter(Boolean);
      if (partes.length > 1) {
        return partes.every(p => nombre.includes(p) || correo.includes(p) || (tel && tel.includes(digitos(p))));
      }
      return false;
    });
  });

  nuevo: { nombre: string; ap_paterno: string; ap_materno: string; telefono: string; correo: string; password: string; rol: 'user' | 'admin' } =
    { nombre: '', ap_paterno: '', ap_materno: '', telefono: '', correo: '', password: '', rol: 'user' };

  get telDigitos(): string { return String(this.nuevo.telefono || '').replace(/\D/g, ''); }
  get correoOk(): boolean { return /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(String(this.nuevo.correo || '').trim()); }
  get formOk(): boolean {
    return !!this.nuevo.nombre.trim() && !!this.nuevo.ap_paterno.trim() && this.telDigitos.length >= 10 && this.correoOk;
  }
  get editTelDigitos(): string { return String(this.edit.telefono || '').replace(/\D/g, ''); }

  /* ---------- geometría de la gráfica de columnas ---------- */
  maxSerie = computed(() => {
    const d = this.detalle();
    if (!d) return 0;
    return Math.max(1, ...d.serie.flatMap(s => [s.ingresos, s.egresos]));
  });

  /** Mes en curso con su nombre, para que un $0.00 no parezca un error. */
  mesHoy = computed(() => this.etiquetaMes(((this.detalle()?.hoy || '').slice(0, 7)) || '') || 'este mes');

  /** ¿Hay algo que dibujar? Con todo en cero, la leyenda "Máximo" sobraba. */
  haySerie = computed(() => this.maxSerie() > 1);

  /** Los 6 meses en pantalla están todos en cero. */
  sinDatosSerie = computed(() => {
    const d = this.detalle();
    return !!d && d.serie.length > 0 && d.serie.every(s => !s.movimientos);
  });

  rangoSerie = computed(() => {
    const d = this.detalle();
    if (!d || !d.serie.length) return '';
    const a = this.etiquetaMes(d.serie[0].ym);
    const b = this.etiquetaMes(d.serie[d.serie.length - 1].ym);
    return `${a} – ${b}`;
  });

  barras = computed<Barra[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    const max = this.maxSerie();
    const alto = 156;                 // de y=20 a y=176
    const base = 176;
    const ancho = 640 - 56;
    const paso = ancho / d.serie.length;
    const out: Barra[] = [];
    d.serie.forEach((s, i) => {
      const centro = 48 + paso * i + paso / 2;
      const hi = Math.max(s.ingresos > 0 ? 3 : 0, (s.ingresos / max) * alto);
      const he = Math.max(s.egresos > 0 ? 3 : 0, (s.egresos / max) * alto);
      out.push({ x: centro - 16, y: base - hi, h: hi, alto, etiqueta: `${this.etiquetaMes(s.ym)} ingresos`, valor: s.ingresos, tipo: 'ingreso' });
      out.push({ x: centro + 2, y: base - he, h: he, alto, etiqueta: `${this.etiquetaMes(s.ym)} egresos`, valor: s.egresos, tipo: 'egreso' });
    });
    return out;
  });

  etiquetas = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    const ancho = 640 - 56;
    const paso = ancho / d.serie.length;
    return d.serie.map((s, i) => ({ x: 48 + paso * i + paso / 2, texto: this.etiquetaMes(s.ym) }));
  });

  guias = computed(() => [20, 59, 98, 137, 176]);

  maxCategoria = computed(() => Math.max(1, ...(this.detalle()?.porCategoria.map(c => c.monto) ?? [1])));

  pctMeta(m: { monto_objetivo: number; monto_actual: number }): number {
    if (!m.monto_objetivo) return 0;
    return Math.min(100, (m.monto_actual / m.monto_objetivo) * 100);
  }

  constructor() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.get<{ users: FilaUsuario[] }>(`${API}/admin/users`));
      this.filas.set(r.users);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /* ============================ ALTA ============================ */
  abrirNuevo() {
    this.nuevo = { nombre: '', ap_paterno: '', ap_materno: '', telefono: '', correo: '', password: '', rol: 'user' };
    this.errorModal.set('');
    this.tocado = false;
    this.modal.set(true);
  }

  limpiarTelefono(e: Event) {
    const el = e.target as HTMLInputElement;
    const limpio = el.value.replace(/\D/g, '').slice(0, 10);
    if (limpio !== el.value) { el.value = limpio; this.nuevo.telefono = limpio; }
  }

  limpiarTelefonoEdit(e: Event) {
    const el = e.target as HTMLInputElement;
    const limpio = el.value.replace(/\D/g, '').slice(0, 10);
    if (limpio !== el.value) { el.value = limpio; }
    this.edit.telefono = limpio;
  }

  async crear() {
    this.tocado = true;
    this.errorModal.set('');
    if (this.creando()) return;
    if (!this.formOk) { this.errorModal.set('Revisa los campos marcados en rojo.'); return; }

    this.creando.set(true);
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/users`, {
        nombre: this.nuevo.nombre.trim(),
        ap_paterno: this.nuevo.ap_paterno.trim(),
        ap_materno: this.nuevo.ap_materno.trim(),
        telefono: this.telDigitos,
        correo: this.nuevo.correo.trim().toLowerCase(),
        password: this.nuevo.password,
        rol: this.nuevo.rol
      }));
      this.modal.set(false);
      if (r.passwordTemporal) this.credenciales.set({ correo: r.user.correo, password: r.passwordTemporal });
      else this.aviso.set(`Usuario ${r.user.correo} creado con la contraseña que elegiste.`);
      await this.cargar();
    } catch (e) {
      this.errorModal.set(mensajeError(e));
    } finally {
      this.creando.set(false);
    }
  }

  /* ============================ EDITAR ============================ */
  abrirEditar(u: FilaUsuario) {
    this.editando.set(u);
    this.errorModal.set('');
    this.edit = {
      nombre: u.nombre || '',
      ap_paterno: u.ap_paterno || '',
      ap_materno: u.ap_materno || '',
      telefono: String(u.telefono || '').replace(/\D/g, ''),
      correo: u.correo || '',
      rol: u.rol
    };
  }

  cerrarEditar(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.editando.set(null);
  }

  async guardarEdicion() {
    const u = this.editando();
    if (!u || this.guardando()) return;
    this.errorModal.set('');
    this.aviso.set('');

    if (this.editTelDigitos.length < 10) {
      this.errorModal.set('El teléfono debe tener 10 dígitos.');
      return;
    }

    this.guardando.set(true);
    try {
      await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, {
        id: u.id,
        accion: 'editar',
        nombre: this.edit.nombre.trim(),
        ap_paterno: this.edit.ap_paterno.trim(),
        ap_materno: this.edit.ap_materno.trim(),
        telefono: this.editTelDigitos,
        correo: this.edit.correo.trim().toLowerCase(),
        rol: this.edit.rol
      }));
      this.editando.set(null);
      this.aviso.set(`Datos de ${this.edit.correo.trim().toLowerCase()} actualizados.`);
      await this.cargar();
    } catch (e) {
      this.errorModal.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  /* ============================ DETALLE ============================ */
  async abrirDetalle(u: FilaUsuario) {
    this.detalle.set(null);
    this.cargandoDetalle.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.get<Detalle>(`${API}/admin/users?detalle=${encodeURIComponent(u.id)}`));
      this.detalle.set(r);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  cerrarDetalle(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.detalle.set(null);
  }

  /* ============================ BORRAR ============================ */
  async abrirBorrar(u: FilaUsuario) {
    this.borrando.set(u);
    this.confirmacion = '';
    this.conteoBorrar.set(null);
    this.cargandoBorrar.set(true);
    try {
      const r = await firstValueFrom(this.http.get<Detalle>(`${API}/admin/users?detalle=${encodeURIComponent(u.id)}`));
      this.conteoBorrar.set({
        movimientos: r.totales.movimientos,
        metas: r.totales.metas,
        pagos: r.totales.pagos,
        cobrado: r.totales.cobrado
      });
    } catch {
      this.conteoBorrar.set(null);
    } finally {
      this.cargandoBorrar.set(false);
    }
  }

  cerrarBorrar(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.borrando.set(null);
  }

  async confirmarBorrado() {
    const u = this.borrando();
    if (!u || this.eliminando()) return;
    if (this.confirmacion.trim().toUpperCase() !== 'BORRAR') return;

    this.eliminando.set(true);
    this.error.set('');
    this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, {
        id: u.id, accion: 'eliminar', confirmar: u.id
      }));
      this.borrando.set(null);
      this.aviso.set(
        `Eliminado ${r.eliminado.correo}: ${r.movimientos} movimiento(s), ` +
        `${r.metas} meta(s) y ${r.pagos} pago(s) borrados de la hoja.`
      );
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.eliminando.set(false);
    }
  }

  /* ============================ RESTO ============================ */
  async cambiarEstatus(u: FilaUsuario, accion: 'activar' | 'desactivar') {
    if (accion === 'desactivar' && !confirm(`¿Desactivar a ${u.correo}? Su sesión se cortará de inmediato.`)) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, { id: u.id, accion }));
      this.aviso.set(r.detalle || 'Listo');
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async resetPass(u: FilaUsuario) {
    if (!confirm(`¿Restablecer la contraseña de ${u.correo}? Se cerrarán todas sus sesiones.`)) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, { id: u.id, accion: 'reset-pass' }));
      if (r.passwordTemporal) this.credenciales.set({ correo: u.correo, password: r.passwordTemporal });
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  cerrarModal(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.modal.set(false);
  }
}
