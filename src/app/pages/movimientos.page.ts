import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MovimientosService } from '../core/movimientos.service';
import { CATEGORIAS, METODOS, etiquetaMes, money, shiftMes, mesActual, diaCorto, salud } from '../core/finance';
import { MilesDirective } from '../core/miles.directive';
import { aNumero } from '../core/miles';
import { hoyLocal, type LocalMov, type Tipo } from '../core/db';

@Component({
  selector: 'afz-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, MilesDirective],
  template: `
    <div class="page-head">
      <div>
        <h1>Movimientos</h1>
        <p>Ingresos y egresos del día. Se guardan en este dispositivo y suben solos cuando hay internet.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="pill" [ngClass]="syncClase()">{{ syncTexto() }}</span>
        <button class="btn btn--ghost btn--sm" (click)="traer()" [disabled]="trayendo()">
          {{ trayendo() ? 'Trayendo…' : '↻ Traer del servidor' }}
        </button>
      </div>
    </div>

    <!-- navegador de mes -->
    <div class="mes-nav">
      <button class="btn btn--ghost btn--sm" (click)="mover(-1)">←</button>
      <strong style="min-width:150px;text-align:center">{{ etiquetaMes(mes()) }}</strong>
      <button class="btn btn--ghost btn--sm" (click)="mover(1)">→</button>
      @if (mes() !== hoyMes) {
        <button class="btn btn--ghost btn--sm" (click)="irHoy()">Mes actual</button>
      }
    </div>

    <div class="grid grid--3" style="margin-bottom:16px">
      <div class="card">
        <div class="kpi__label">Ingresos</div>
        <div class="kpi__value" style="color:var(--ok)">{{ money(res().ingresos) }}</div>
      </div>
      <div class="card">
        <div class="kpi__label">Egresos</div>
        <div class="kpi__value" style="color:var(--bad)">{{ money(res().egresos) }}</div>
      </div>
      <div class="card">
        <div class="kpi__label">Balance del mes</div>
        <div class="kpi__value" [style.color]="res().balance >= 0 ? 'var(--brand)' : 'var(--bad)'">
          {{ money(res().balance) }}
        </div>
        <div class="nota" style="margin-top:6px">
          Ahorro {{ res().tasaAhorro.toFixed(0) }}% · {{ res().movimientos }} movimiento(s) en {{ res().diasConRegistro }} día(s)
        </div>
      </div>
    </div>

    <!-- filtros -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <div class="segmented">
          <button [class.is-on]="filtro() === 'todos'" (click)="filtro.set('todos')">Todos</button>
          <button [class.is-on]="filtro() === 'ingreso'" (click)="filtro.set('ingreso')">Ingresos</button>
          <button [class.is-on]="filtro() === 'egreso'" (click)="filtro.set('egreso')">Egresos</button>
        </div>
        <input style="flex:1 1 160px;min-width:0;max-width:100%" placeholder="Buscar descripción o categoría…"
               [ngModel]="q()" (ngModelChange)="q.set($event)">
        <button class="btn" (click)="abrirNuevo()">＋ Nuevo movimiento</button>
      </div>
    </div>

    <!-- lista -->
    <div class="card">
      @if (!movs.listo()) {
        <p class="nota">Cargando tus movimientos…</p>
      } @else if (lista().length === 0) {
        <div style="text-align:center;padding:26px 10px">
          <p style="font-size:15px;font-weight:600;margin:0 0 6px">Sin movimientos en {{ etiquetaMes(mes()) }}</p>
          <p class="nota" style="margin:0 0 14px">Registra el primero; puedes hacerlo sin internet.</p>
          <button class="btn" (click)="abrirNuevo()">＋ Registrar movimiento</button>
        </div>
      } @else {
        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Método</th>
                <th style="text-align:right">Monto</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (r of lista(); track r.id) {
                <tr>
                  <td style="white-space:nowrap">{{ diaCorto(r.fecha) }}</td>
                  <td>
                    <span class="mov__ico" [class.mov__ico--in]="r.tipo === 'ingreso'">{{ r.tipo === 'ingreso' ? '↓' : '↑' }}</span>
                    {{ r.descripcion || r.categoria }}
                    @if (r.dirty === 1) { <span class="pill" style="margin-left:6px;font-size:10px">sin subir</span> }
                  </td>
                  <td>{{ r.categoria }}</td>
                  <td class="nota">{{ r.metodo || '—' }}</td>
                  <td class="mono" style="text-align:right;white-space:nowrap"
                      [style.color]="r.tipo === 'ingreso' ? 'var(--ok)' : 'var(--bad)'">
                    {{ r.tipo === 'ingreso' ? '+' : '−' }}{{ money(r.monto) }}
                  </td>
                  <td style="white-space:nowrap;text-align:right">
                    <button class="btn btn--ghost btn--sm" (click)="abrirEditar(r)">Editar</button>
                    <button class="btn btn--danger btn--sm" (click)="borrar(r)">Borrar</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- desglose por categoría -->
    @if (res().porCategoria.length) {
      <div class="card" style="margin-top:14px">
        <h3 style="font-size:15px;margin-bottom:12px">En qué se fue el dinero</h3>
        @for (c of res().porCategoria; track c.categoria) {
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span>{{ c.categoria }}</span>
              <span class="mono" style="color:var(--muted)">{{ money(c.monto) }} · {{ c.porcentaje.toFixed(0) }}%</span>
            </div>
            <div class="bar"><div class="bar__fill" [style.width.%]="c.porcentaje"></div></div>
          </div>
        }
      </div>
    }

    <!-- modal -->
    @if (modal()) {
      <div class="modal" (click)="cerrar()">
        <div class="modal__box" (click)="$event.stopPropagation()">
          <h3>{{ editandoId() ? 'Editar movimiento' : 'Nuevo movimiento' }}</h3>

          @if (error()) { <div class="alert alert--bad" style="margin-bottom:12px">{{ error() }}</div> }

          <div class="segmented" style="margin-bottom:14px;width:100%;overflow-x:auto">
            <button style="flex:1" [class.is-on]="form.tipo === 'egreso'" (click)="setTipo('egreso')">↑ Egreso</button>
            <button style="flex:1" [class.is-on]="form.tipo === 'ingreso'" (click)="setTipo('ingreso')">↓ Ingreso</button>
          </div>

          <div class="form-row">
            <label class="field">Monto
              <input type="text" name="monto" inputmode="decimal" afzMiles
                     [(ngModel)]="form.monto" placeholder="0" autocomplete="off">
            </label>
            <div class="form-row form-row--2">
              <label class="field">Fecha
                <input type="date" name="fecha" [(ngModel)]="form.fecha">
              </label>
              <label class="field">Categoría
                <select name="categoria" [(ngModel)]="form.categoria">
                  @for (c of cats(); track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </label>
            </div>
            <label class="field">Descripción (opcional)
              <input name="descripcion" [(ngModel)]="form.descripcion" placeholder="Ej. Comida del día">
            </label>
            <label class="field">Método
              <select name="metodo" [(ngModel)]="form.metodo">
                @for (m of metodos; track m) { <option [value]="m">{{ m }}</option> }
              </select>
            </label>
          </div>

          <div style="display:flex;gap:10px;margin-top:18px">
            <button class="btn btn--ghost" style="flex:1" (click)="cerrar()">Cancelar</button>
            <button class="btn" style="flex:2" (click)="guardar()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
          <p class="nota" style="margin-top:10px">
            Se guarda al instante en tu dispositivo, aunque no tengas internet. La subida al servidor ocurre sola.
          </p>
        </div>
      </div>
    }
  `
})
export class MovimientosPage implements OnInit {
  movs = inject(MovimientosService);

  money = money;
  diaCorto = diaCorto;
  etiquetaMes = etiquetaMes;
  metodos = METODOS;
  hoyMes = mesActual();

  q = signal('');
  filtro = signal<'todos' | 'ingreso' | 'egreso'>('todos');
  modal = signal(false);
  editandoId = signal<string | null>(null);
  guardando = signal(false);
  trayendo = signal(false);
  error = signal('');

  form: { tipo: Tipo; fecha: string; monto: number | string | null; categoria: string; descripcion: string; metodo: string } =
    { tipo: 'egreso', fecha: hoyLocal(), monto: null, categoria: 'Comida', descripcion: '', metodo: 'Efectivo' };

  mes = this.movs.mes;
  res = this.movs.resumenMes;

  saludMes = computed(() => salud(this.movs.resumenMes()));

  syncTexto = computed(() => {
    const e = this.movs.estado();
    const p = this.movs.pendientes();
    if (e === 'subiendo') return 'Sincronizando…';
    if (e === 'offline') return this.movs.enLinea() ? 'Servidor no disponible' : `Sin conexión · ${p} pendiente(s)`;
    if (e === 'error') return `Error al sincronizar · ${p} pendiente(s)`;
    if (e === 'ok') return p ? `${p} pendiente(s)` : 'Todo sincronizado';
    return 'Solo en este dispositivo';
  });

  syncClase = computed(() => {
    if (this.movs.estado() === 'ok' && this.movs.pendientes() === 0) return 'pill--ok';
    if (this.movs.estado() === 'error') return 'pill--bad';
    return '';
  });

  lista = computed<LocalMov[]>(() => {
    const ym = this.movs.mes();
    const f = this.filtro();
    const texto = this.q().trim().toLowerCase();
    return this.movs.rows()
      .filter(r => Number(r.deleted) !== 1)
      .filter(r => String(r.fecha).slice(0, 7) === ym)
      .filter(r => f === 'todos' || r.tipo === f)
      .filter(r => !texto || `${r.descripcion} ${r.categoria} ${r.metodo}`.toLowerCase().includes(texto))
      .sort((a, b) => (a.fecha === b.fecha
        ? String(b.created_at).localeCompare(String(a.created_at))
        : b.fecha.localeCompare(a.fecha)));
  });

  async ngOnInit(): Promise<void> {
    await this.movs.iniciar();
  }

  cats(): string[] { return CATEGORIAS[this.form.tipo]; }

  mover(d: number) { this.movs.cambiarMes(shiftMes(this.movs.mes(), d)); }
  irHoy() { this.movs.cambiarMes(mesActual()); }

  setTipo(t: Tipo) {
    this.form.tipo = t;
    if (!CATEGORIAS[t].includes(this.form.categoria)) this.form.categoria = CATEGORIAS[t][0];
  }

  abrirNuevo() {
    this.editandoId.set(null);
    this.error.set('');
    this.form = {
      tipo: 'egreso',
      fecha: this.movs.mes() === mesActual() ? hoyLocal() : `${this.movs.mes()}-01`,
      monto: null, categoria: 'Comida', descripcion: '', metodo: 'Efectivo'
    };
    this.modal.set(true);
  }

  abrirEditar(r: LocalMov) {
    this.editandoId.set(r.id);
    this.error.set('');
    this.form = {
      tipo: r.tipo, fecha: r.fecha, monto: r.monto,
      categoria: r.categoria || 'Otro', descripcion: r.descripcion || '', metodo: r.metodo || 'Efectivo'
    };
    this.modal.set(true);
  }

  cerrar() { this.modal.set(false); this.guardando.set(false); }

  async guardar() {
    const monto = aNumero(this.form.monto) ?? 0;
    if (!isFinite(monto) || monto <= 0) { this.error.set('Escribe un monto mayor a 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.form.fecha)) { this.error.set('Elige una fecha válida.'); return; }

    this.guardando.set(true);
    this.error.set('');
    const dto = {
      fecha: this.form.fecha, tipo: this.form.tipo, categoria: this.form.categoria,
      descripcion: this.form.descripcion, monto, metodo: this.form.metodo
    };
    try {
      const id = this.editandoId();
      if (id) await this.movs.editar(id, dto);
      else await this.movs.crear(dto);
      this.modal.set(false);
    } catch {
      this.error.set('No se pudo guardar. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  async borrar(r: LocalMov) {
    if (!confirm(`¿Borrar "${r.descripcion || r.categoria}" por ${money(r.monto)}?`)) return;
    await this.movs.borrar(r.id);
  }

  async traer() {
    this.trayendo.set(true);
    try { await this.movs.descargarTodo(); } catch { /* se reintenta sola */ }
    finally { this.trayendo.set(false); }
  }
}
