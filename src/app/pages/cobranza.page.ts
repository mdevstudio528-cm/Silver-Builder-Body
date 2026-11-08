import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API, mensajeError } from '../core/api';
import { MilesDirective } from '../core/miles.directive';
import { aNumero } from '../core/miles';

type Estado = 'al_corriente' | 'por_vencer' | 'vencido' | 'sin_pago';

interface Historial {
  id: string; fecha_pago: string; monto: number; metodo: string;
  meses: number; periodo_desde: string; periodo_hasta: string; notas: string;
}

interface Cliente {
  user_id: string; nombre: string; correo: string; telefono: string;
  cuenta: 'activo' | 'desactivado';
  estado: Estado; cubierto_hasta: string; dias: number | null;
  mensualidad: number; meses_pagados: number; ultimo_pago: string;
  total_pagado: number; pagos: number; historial: Historial[];
}

interface Cartera {
  total: number; alCorriente: number; porVencer: number; vencidos: number;
  sinPago: number; cobradoMes: number; ingresoMensualRecurrente: number;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(n) || 0);

const ETIQUETA: Record<Estado, string> = {
  al_corriente: '● Al corriente',
  por_vencer: '● Por vencer',
  vencido: '● Vencido',
  sin_pago: '● Sin pago'
};

@Component({
  selector: 'afz-cobranza',
  standalone: true,
  imports: [CommonModule, FormsModule, MilesDirective],
  template: `
    <div class="page-head">
      <div>
        <h1>Cobranza</h1>
        <p>Quién ya pagó su mensualidad, quién está por vencer y a quién hay que cortarle el acceso.</p>
      </div>
      <div class="cab-acciones">
        <span class="pill mono">{{ hoy() }}</span>
        <button class="btn btn--ghost btn--sm" (click)="cargar()" [disabled]="cargando()">↻ Actualizar</button>
      </div>
    </div>

    @if (error()) { <div class="alert alert--bad" style="margin-bottom:14px">{{ error() }}</div> }
    @if (aviso()) { <div class="alert alert--ok" style="margin-bottom:14px">{{ aviso() }}</div> }

    <div class="grid grid--3" style="margin-bottom:14px">
      <div class="card">
        <div class="kpi__label">Cobrado este mes</div>
        <div class="kpi__value kpi__value--monto" style="color:var(--ok)">{{ money(cartera().cobradoMes) }}</div>
        <div class="nota" style="margin-top:6px">Ingreso recurrente: {{ money(cartera().ingresoMensualRecurrente) }} / mes</div>
      </div>
      <div class="card">
        <div class="kpi__label">Vencidos</div>
        <div class="kpi__value" style="color:var(--bad)">{{ cartera().vencidos }}</div>
        <div class="nota" style="margin-top:6px">{{ cartera().sinPago }} sin ningún pago · {{ cartera().porVencer }} por vencer</div>
      </div>
      <div class="card">
        <div class="kpi__label">Al corriente</div>
        <div class="kpi__value" style="color:var(--brand)">{{ cartera().alCorriente }}</div>
        <div class="nota" style="margin-top:6px">de {{ cartera().total }} cliente(s) registrados</div>
      </div>
    </div>

    <div class="mes-nav">
      <div class="segmented">
        <button [class.is-on]="filtro() === 'todos'" (click)="filtro.set('todos')">Todos ({{ clientes().length }})</button>
        <button [class.is-on]="filtro() === 'vencido'" (click)="filtro.set('vencido')">Vencidos</button>
        <button [class.is-on]="filtro() === 'por_vencer'" (click)="filtro.set('por_vencer')">Por vencer</button>
        <button [class.is-on]="filtro() === 'al_corriente'" (click)="filtro.set('al_corriente')">Al corriente</button>
        <button [class.is-on]="filtro() === 'sin_pago'" (click)="filtro.set('sin_pago')">Sin pago</button>
      </div>
      <span class="nota" style="margin-left:auto">Se avisa en ámbar {{ 7 }} días antes del corte.</span>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      @if (cargando()) {
        <div style="padding:32px;text-align:center;color:var(--muted)">Leyendo pagos…</div>
      } @else if (visibles().length === 0) {
        <div style="padding:36px;text-align:center;color:var(--muted)">
          <b style="display:block;color:var(--txt);margin-bottom:6px">No hay clientes en este filtro</b>
          Da de alta clientes en <a href="/admin/usuarios" style="color:var(--brand)">Usuarios</a> y vuelve aquí a registrar su primer cobro.
        </div>
      } @else {
        <div class="tbl-wrap">
        <table class="tbl tbl--cards">
          <thead>
            <tr>
              <th>Cliente</th><th>Estado</th><th>Cubierto hasta</th>
              <th style="text-align:right">Mensualidad</th><th>Cobrado</th>
              <th style="text-align:right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (c of visibles(); track c.user_id) {
              <tr>
                <td class="celda-nombre">
                  <div>{{ c.nombre }}</div>
                  <div class="nota">{{ c.correo }}</div>
                  @if (c.telefono) { <div class="nota mono">{{ c.telefono }}</div> }
                </td>
                <td data-label="Estado">
                  <span class="pill" [class.pill--ok]="c.estado === 'al_corriente'"
                        [class.pill--bad]="c.estado === 'vencido' || c.estado === 'sin_pago'"
                        [class.pill--warn]="c.estado === 'por_vencer'">
                    {{ etiqueta[c.estado] }}
                  </span>
                  @if (c.dias !== null) {
                    <div class="nota" style="margin-top:4px">
                      {{ c.dias >= 0 ? 'quedan ' + c.dias + ' día(s)' : c.dias * -1 + ' día(s) de atraso' }}
                    </div>
                  }
                </td>
                <td data-label="Cubierto hasta" class="mono" style="color:var(--muted)">{{ c.cubierto_hasta || '—' }}</td>
                <td data-label="Mensualidad" class="mono">{{ c.mensualidad ? money(c.mensualidad) : '—' }}</td>
                <td data-label="Cobrado" class="mono nota">{{ c.pagos }} pago(s) · {{ money(c.total_pagado) }}</td>
                <td data-label="" class="acciones">
                  <button class="btn btn--sm" (click)="abrirCobro(c)">💵 Cobrar</button>
                  @if (c.historial.length) {
                    <button class="btn btn--ghost btn--sm" (click)="verHistorial(c)">Historial</button>
                  }
                  @if (c.cuenta === 'activo') {
                    <button class="btn btn--danger btn--sm" (click)="cambiarCuenta(c, 'desactivar')">Desactivar</button>
                  } @else {
                    <button class="btn btn--ghost btn--sm" (click)="cambiarCuenta(c, 'activar')">Activar</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>
      }
    </div>

    <!-- ------------------------- COBRAR ------------------------- -->
    @if (cobrando()) {
      <div class="modal" (click)="cerrarFuera($event)">
        <div class="modal__box">
          <h3>Cobrar a {{ cobrando()!.nombre }}</h3>
          <div class="nota" style="margin-bottom:14px">
            Cubierto hasta: <b style="color:var(--txt)">{{ cobrando()!.cubierto_hasta || 'nunca ha pagado' }}</b>.
            El periodo se calcula solo: si sigue cubierto se suma al final; si ya venció, arranca hoy.
          </div>

          <div class="mes" style="margin-bottom:14px">
            <span class="rate-label" style="margin-right:6px">Meses</span>
            @for (m of [1, 3, 6, 12]; track m) {
              <button class="btn btn--sm" [class.btn--ghost]="form.meses !== m" (click)="setMeses(m)">{{ m }}</button>
            }
          </div>

          <div class="form-row form-row--2">
            <label class="field">Monto total (MXN)
              <input type="text" name="monto" afzMiles [(ngModel)]="form.monto" inputmode="decimal" placeholder="0" autocomplete="off">
            </label>
            <label class="field">Forma de pago
              <select name="metodo" [(ngModel)]="form.metodo">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="otro">Otro</option>
              </select>
            </label>
          </div>
          <div class="form-row form-row--2">
            <label class="field">Fecha del pago
              <input type="date" name="fecha_pago" [(ngModel)]="form.fecha_pago">
            </label>
            <label class="field">Notas (opcional)
              <input type="text" name="notas" [(ngModel)]="form.notas" placeholder="Ej. pagó con transferencia BBVA">
            </label>
          </div>

          @if (cobrando()!.cuenta === 'desactivado') {
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0 10px">
              <input type="checkbox" name="reactivar" [(ngModel)]="form.reactivar">
              Reactivar la cuenta en este mismo paso
            </label>
          }

          <div class="alert" style="margin-bottom:12px">
            Quedará cubierto del <b>{{ previoVista().desde }}</b> al <b>{{ previoVista().hasta }}</b>
            según el historial; el servidor recalcula y manda la fecha real.
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn--ghost" (click)="cobrando.set(null)">Cancelar</button>
            <button class="btn" (click)="guardarCobro()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Registrar cobro' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ------------------------- HISTORIAL ------------------------- -->
    @if (historialDe()) {
      <div class="modal" (click)="cerrarFueraHistorial($event)">
        <div class="modal__box">
          <h3>Pagos de {{ historialDe()!.nombre }}</h3>
          <div class="tbl-wrap">
          <table class="tbl tbl--cards">
            <thead><tr><th>Fecha</th><th>Periodo</th><th style="text-align:right">Monto</th><th></th></tr></thead>
            <tbody>
              @for (p of historialDe()!.historial; track p.id) {
                <tr>
                  <td data-label="Fecha de pago" class="mono">{{ p.fecha_pago }}</td>
                  <td data-label="Periodo cubierto" class="mono nota">{{ p.periodo_desde }} → {{ p.periodo_hasta }}<br>{{ p.meses }} mes(es) · {{ p.metodo }}</td>
                  <td data-label="Monto" class="mono">{{ money(p.monto) }}</td>
                  <td data-label="" class="acciones">
                    <button class="btn btn--danger btn--sm" (click)="anular(p.id)">Anular</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          </div>
          <button class="btn btn--ghost btn--block" style="margin-top:14px" (click)="historialDe.set(null)">Cerrar</button>
        </div>
      </div>
    }
  `
})
export class CobranzaPage {
  private http = inject(HttpClient);

  money = money;
  etiqueta = ETIQUETA;

  clientes = signal<Cliente[]>([]);
  cartera = signal<Cartera>({
    total: 0, alCorriente: 0, porVencer: 0, vencidos: 0,
    sinPago: 0, cobradoMes: 0, ingresoMensualRecurrente: 0
  });
  hoy = signal('');
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  aviso = signal('');
  filtro = signal<'todos' | Estado>('todos');
  cobrando = signal<Cliente | null>(null);
  historialDe = signal<Cliente | null>(null);

  form: { meses: number; monto: number | string; metodo: string; fecha_pago: string; notas: string; reactivar: boolean } =
    { meses: 1, monto: 0, metodo: 'efectivo', fecha_pago: '', notas: '', reactivar: false };

  visibles = computed(() => {
    const f = this.filtro();
    const todos = this.clientes();
    return f === 'todos' ? todos : todos.filter(c => c.estado === f);
  });

  /** Vista previa del periodo; el servidor manda la definitiva en la respuesta. */
  previoVista = computed(() => {
    const c = this.cobrando();
    const meses = Number(this.form.meses) || 1;
    const hoy = this.hoy() || new Date().toISOString().slice(0, 10);
    const base = c && c.cubierto_hasta && c.cubierto_hasta > hoy ? c.cubierto_hasta : hoy;
    return { desde: base, hasta: sumarMeses(base, meses) };
  });

  constructor() { this.cargar(); }

  async cargar() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.get<any>(`${API}/admin/cobranza`));
      this.clientes.set(r.clientes || []);
      this.cartera.set(r.cartera);
      this.hoy.set(r.hoy);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  abrirCobro(c: Cliente) {
    const meses = 1;
    this.error.set(''); this.aviso.set('');
    this.form = {
      meses,
      monto: c.mensualidad ? Math.round(c.mensualidad * meses * 100) / 100 : 0,
      metodo: 'efectivo',
      fecha_pago: this.hoy() || new Date().toISOString().slice(0, 10),
      notas: '',
      reactivar: c.cuenta === 'desactivado'
    };
    this.cobrando.set(c);
  }

  setMeses(m: number) {
    this.form.meses = m;
    const c = this.cobrando();
    if (c?.mensualidad) this.form.monto = Math.round(c.mensualidad * m * 100) / 100;
  }

  async guardarCobro() {
    const c = this.cobrando();
    if (!c || this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/pagos`, {
        accion: 'cobrar',
        user_id: c.user_id,
        meses: Number(this.form.meses),
        monto: aNumero(this.form.monto) ?? 0,
        metodo: this.form.metodo,
        fecha_pago: this.form.fecha_pago,
        notas: this.form.notas,
        reactivar: !!this.form.reactivar
      }));
      this.cobrando.set(null);
      this.aviso.set(r.detalle + (r.reactivado ? ' Cuenta reactivada.' : ''));
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  verHistorial(c: Cliente) { this.historialDe.set(c); }

  async anular(id: string) {
    if (!confirm('¿Anular este cobro? Se quitará del historial y su cobertura se recalcula.')) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/pagos`, { accion: 'anular', id }));
      this.historialDe.set(null);
      this.aviso.set(r.detalle || 'Cobro anulado.');
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async cambiarCuenta(c: Cliente, accion: 'activar' | 'desactivar') {
    if (accion === 'desactivar' && !confirm(`¿Desactivar a ${c.correo}? No podrá entrar hasta que le registres un pago.`)) return;
    this.error.set(''); this.aviso.set('');
    try {
      const r = await firstValueFrom(this.http.post<any>(`${API}/admin/user-update`, { id: c.user_id, accion }));
      this.aviso.set(`${c.nombre}: ${r.detalle || 'listo'}`);
      await this.cargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  cerrarFuera(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.cobrando.set(null);
  }
  cerrarFueraHistorial(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('modal')) this.historialDe.set(null);
  }
}

/** Suma meses recortando al último día del mes destino (igual que el servidor). */
function sumarMeses(fecha: string, meses: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const total = m - 1 + Math.trunc(meses);
  const y2 = y + Math.floor(total / 12);
  const m2 = ((total % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}
