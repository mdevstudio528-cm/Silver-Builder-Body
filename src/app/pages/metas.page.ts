import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MetasService } from '../core/metas.service';
import { MovimientosService } from '../core/movimientos.service';
import { money, etiquetaMes } from '../core/finance';
import { MilesDirective } from '../core/miles.directive';
import { aNumero } from '../core/miles';
import { hoyLocal, type LocalMeta, type Prioridad } from '../core/db';
import {
  fechaBonita, proyectar, resumenMetas, ritmoAhorro, sumarMeses,
  type Proyeccion
} from '../core/proyeccion';

interface VistaMeta { meta: LocalMeta; p: Proyeccion; }

@Component({
  selector: 'afz-metas',
  standalone: true,
  imports: [CommonModule, FormsModule, MilesDirective],
  template: `
    <div class="page-head">
      <div>
        <h1>Metas</h1>
        <p>Lo que estás ahorrando y si alcanzas a llegar a tiempo.</p>
      </div>
      <button class="btn" (click)="abrirNueva()">+ Nueva meta</button>
    </div>

    <!-- ritmo real -->
    <div class="card" style="margin-bottom:16px;border-left:3px solid var(--brand)">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center">
        <div>
          <div class="rate-label">Lo que ahorras cada mes en promedio</div>
          <div class="kpi__value" [style.color]="ritmo().promedio > 0 ? 'var(--brand)' : 'var(--bad)'">
            {{ money(ritmo().promedio) }}
          </div>
          <div class="nota" style="margin-top:4px">
            Calculado con {{ ritmo().mesesConDatos }} mes(es) con datos
            @for (m of ritmo().meses; track m.ym) { · {{ etiquetaMes(m.ym) }}: {{ money(m.ahorro) }} }
          </div>
        </div>
        <div class="nota" style="max-width:340px;width:100%">
          @if (ritmo().promedio > 0) {
            Este ritmo sale de tus movimientos reales (ingresos − egresos). Todas las fechas de abajo lo usan.
          } @else {
            Aún no tienes meses con ahorro positivo registrado. Las metas se muestran sin fecha estimada
            hasta que registres ingresos y egresos.
          }
        </div>
      </div>
    </div>

    <!-- resumen -->
    <div class="grid grid--3" style="margin-bottom:16px">
      <div class="card">
        <div class="kpi__label">Ahorrado / objetivo</div>
        <div class="kpi__value">{{ money(r().ahorradoTotal) }}</div>
        <div class="nota" style="margin-top:4px">de {{ money(r().objetivoTotal) }} en {{ r().metas }} meta(s)</div>
      </div>
      <div class="card">
        <div class="kpi__label">Falta por ahorrar</div>
        <div class="kpi__value" style="color:var(--warn)">{{ money(r().faltanteTotal) }}</div>
        <div class="nota" style="margin-top:4px">Progreso global {{ r().progresoGlobal.toFixed(0) }}%</div>
      </div>
      <div class="card">
        <div class="kpi__label">Necesitas al mes</div>
        <div class="kpi__value">{{ money(r().aporteMensualTotal) }}</div>
        <div class="nota" style="margin-top:4px">
          {{ r().logradas }} lograda(s) · {{ r().enRiesgo }} en riesgo
        </div>
      </div>
    </div>

    <!-- metas -->
    @if (vistas().length === 0) {
      <div class="card" style="text-align:center;padding:30px 12px">
        <p style="font-size:16px;font-weight:700;margin:0 0 6px">Todavía no tienes metas</p>
        <p class="nota" style="margin:0 0 14px">Ejemplo: "Moto nueva" {{ money(25000) }} para diciembre, o "Fondo de emergencia" {{ money(15000) }}.</p>
        <button class="btn" (click)="abrirNueva()">+ Crear mi primera meta</button>
      </div>
    } @else {
      <div class="grid grid--2">
        @for (v of vistas(); track v.meta.id) {
          <div class="card meta-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div>
                <div style="font-size:15.5px;font-weight:700">{{ v.meta.nombre }}</div>
                <div class="nota" style="margin-top:2px">
                  Límite {{ fechaBonita(v.meta.fecha_limite) }} ({{ v.p.diasRestantes }} días)
                  @if (v.meta.dirty === 1) { <span class="pill" style="font-size:10px">sin subir</span> }
                </div>
              </div>
              <span class="pill" [style.color]="v.p.color" [style.borderColor]="v.p.color">{{ v.p.etiqueta }}</span>
            </div>

            <div style="display:flex;align-items:baseline;gap:8px;margin:14px 0 6px">
              <span style="font-size:21px;font-weight:800">{{ money(v.meta.monto_actual) }}</span>
              <span class="nota">de {{ money(v.meta.monto_objetivo) }}</span>
            </div>
            <div class="bar"><div class="bar__fill" [style.width.%]="v.p.progreso" [style.background]="v.p.color"></div></div>
            <div class="nota" style="margin-top:6px">Progreso {{ v.p.progreso.toFixed(0) }}% · faltan {{ money(v.p.faltante) }}</div>

            <div class="meta-facts">
              <div class="meta-fact">
                <div class="rate-label">Aporte para llegar</div>
                <b>{{ money(v.p.aporteRequerido) }}</b><span class="nota"> /mes</span>
              </div>
              <div class="meta-fact">
                <div class="rate-label">A tu ritmo llegarías</div>
                <b>{{ v.p.fechaEstimada ? fechaBonita(v.p.fechaEstimada) : '—' }}</b>
                @if (v.p.mesesNecesarios !== null) { <span class="nota"> · {{ v.p.mesesNecesarios }} mes(es)</span> }
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
              <button class="btn btn--sm" (click)="abrirAbono(v.meta)">Abonar</button>
              <button class="btn btn--ghost btn--sm" (click)="abrirEditar(v.meta)">Editar</button>
              <button class="btn btn--danger btn--sm" (click)="borrar(v.meta)">Borrar</button>
            </div>
          </div>
        }
      </div>
    }

    <!-- modal meta -->
    @if (modal()) {
      <div class="modal" (click)="cerrar()">
        <div class="modal__box" (click)="$event.stopPropagation()">
          <h3>{{ editandoId() ? 'Editar meta' : 'Nueva meta' }}</h3>
          @if (error()) { <div class="alert alert--bad" style="margin-bottom:12px">{{ error() }}</div> }

          <div class="form-row">
            <label class="field">Nombre de la meta
              <input name="nombre" [(ngModel)]="form.nombre" placeholder="Ej. Moto nueva">
            </label>
            <div class="form-row form-row--2">
              <label class="field">Monto objetivo
                <input type="text" name="objetivo" inputmode="decimal" afzMiles [(ngModel)]="form.monto_objetivo" placeholder="0" autocomplete="off">
              </label>
              <label class="field">Ya ahorrado
                <input type="text" name="actual" inputmode="decimal" afzMiles [(ngModel)]="form.monto_actual" placeholder="0" autocomplete="off">
              </label>
            </div>
            <div class="form-row form-row--2">
              <label class="field">Fecha límite
                <input type="date" name="limite" [(ngModel)]="form.fecha_limite">
              </label>
              <label class="field">Prioridad
                <select name="prioridad" [(ngModel)]="form.prioridad">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </label>
            </div>
            <label class="field">Aporte mensual que te propones (opcional)
              <input type="text" name="aporte" inputmode="decimal" afzMiles [(ngModel)]="form.aporte_mensual" placeholder="0" autocomplete="off">
            </label>
          </div>

          @if (sugerencia() > 0) {
            <p class="nota" style="margin-top:10px">
              Para llegar a la fecha límite necesitas <b style="color:var(--txt)">{{ money(sugerido()) }}</b> al mes.
            </p>
          }

          <div style="display:flex;gap:10px;margin-top:18px">
            <button class="btn btn--ghost" style="flex:1" (click)="cerrar()">Cancelar</button>
            <button class="btn" style="flex:2" (click)="guardar()" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- modal abono -->
    @if (abonando()) {
      <div class="modal" (click)="cerrarAbono()">
        <div class="modal__box" style="width:min(420px,100%)" (click)="$event.stopPropagation()">
          <h3>Abonar a {{ abonando()?.nombre }}</h3>
          <p class="nota" style="margin-bottom:14px">
            Tienes {{ money(abonando()?.monto_actual || 0) }} de {{ money(abonando()?.monto_objetivo || 0) }}.
          </p>
          <label class="field">¿Cuánto abonas?
            <input type="text" inputmode="decimal" afzMiles [(ngModel)]="montoAbono" placeholder="0" autocomplete="off">
          </label>
          <div style="display:flex;gap:10px;margin-top:16px">
            <button class="btn btn--ghost" style="flex:1" (click)="cerrarAbono()">Cancelar</button>
            <button class="btn" style="flex:2" (click)="confirmarAbono()">Abonar</button>
          </div>
        </div>
      </div>
    }
  `
})
export class MetasPage implements OnInit {
  private svc = inject(MetasService);
  private movs = inject(MovimientosService);

  money = money;
  etiquetaMes = etiquetaMes;
  fechaBonita = fechaBonita;

  version = signal(0);
  modal = signal(false);
  editandoId = signal<string | null>(null);
  guardando = signal(false);
  error = signal('');
  abonando = signal<LocalMeta | null>(null);
  montoAbono: number | null = null;

  form: {
    nombre: string; monto_objetivo: number | string | null; monto_actual: number | string | null;
    fecha_limite: string; prioridad: Prioridad; aporte_mensual: number | string | null;
  } = { nombre: '', monto_objetivo: null, monto_actual: 0, fecha_limite: sumarMeses(hoyLocal(), 6), prioridad: 'media', aporte_mensual: 0 };

  ritmo = computed(() => { this.version(); return ritmoAhorro(this.movs.rows(), 3); });
  r = computed(() => { this.version(); return resumenMetas(this.svc.metas, this.ritmo().promedio, hoyLocal()); });

  vistas = computed<VistaMeta[]>(() => {
    this.version();
    const ritmo = this.ritmo().promedio;
    const hoy = hoyLocal();
    return this.svc.metas
      .filter(m => Number(m.deleted) !== 1)
      .map(m => ({ meta: m, p: proyectar(m, ritmo, hoy) }))
      .sort((a, b) => {
        if (a.p.estado === 'lograda' && b.p.estado !== 'lograda') return 1;
        if (b.p.estado === 'lograda') return -1;
        const pa = ['alta', 'media', 'baja'].indexOf(a.meta.prioridad);
        const pb = ['alta', 'media', 'baja'].indexOf(b.meta.prioridad);
        if (pa !== pb) return pa - pb;
        return String(a.meta.fecha_limite).localeCompare(String(b.meta.fecha_limite));
      });
  });

  sugerido = computed(() => {
    const objetivo = aNumero(this.form.monto_objetivo) ?? 0;
    const actual = aNumero(this.form.monto_actual) ?? 0;
    const faltante = Math.max(0, objetivo - actual);
    const hoy = hoyLocal();
    const meses = Math.max(1, Math.ceil((new Date(this.form.fecha_limite + 'T12:00:00').getTime() - new Date(hoy + 'T12:00:00').getTime()) / (30.44 * 86_400_000)));
    return faltante / meses;
  });

  async ngOnInit(): Promise<void> {
    await this.movs.iniciar();
    this.svc.suscribir(() => this.version.update(v => v + 1));
    await this.svc.iniciar();
    this.version.update(v => v + 1);
  }

  abrirNueva() {
    this.editandoId.set(null);
    this.error.set('');
    this.form = {
      nombre: '', monto_objetivo: null, monto_actual: 0,
      fecha_limite: sumarMeses(hoyLocal(), 6), prioridad: 'media', aporte_mensual: 0
    };
    this.modal.set(true);
  }

  abrirEditar(m: LocalMeta) {
    this.editandoId.set(m.id);
    this.error.set('');
    this.form = {
      nombre: m.nombre, monto_objetivo: m.monto_objetivo, monto_actual: m.monto_actual,
      fecha_limite: m.fecha_limite, prioridad: m.prioridad, aporte_mensual: m.aporte_mensual
    };
    this.modal.set(true);
  }

  cerrar() { this.modal.set(false); this.guardando.set(false); }

  async guardar() {
    if (!this.form.nombre.trim()) { this.error.set('Ponle nombre a la meta.'); return; }
    if (!((aNumero(this.form.monto_objetivo) ?? 0) > 0)) { this.error.set('El monto objetivo debe ser mayor a 0.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.form.fecha_limite)) { this.error.set('Elige una fecha límite.'); return; }

    this.guardando.set(true);
    this.error.set('');
    const dto = {
      nombre: this.form.nombre,
      monto_objetivo: aNumero(this.form.monto_objetivo) ?? 0,
      monto_actual: aNumero(this.form.monto_actual) ?? 0,
      fecha_limite: this.form.fecha_limite,
      prioridad: this.form.prioridad,
      aporte_mensual: aNumero(this.form.aporte_mensual) ?? 0
    };
    try {
      const id = this.editandoId();
      if (id) await this.svc.editar(id, dto); else await this.svc.crear(dto);
      this.version.update(v => v + 1);
      this.modal.set(false);
    } catch {
      this.error.set('No se pudo guardar. Intenta de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }

  abrirAbono(m: LocalMeta) { this.abonando.set(m); this.montoAbono = null; }
  cerrarAbono() { this.abonando.set(null); this.montoAbono = null; }

  async confirmarAbono() {
    const m = this.abonando();
    const monto = Number(this.montoAbono);
    if (!m || !(monto > 0)) return;
    await this.svc.abonar(m.id, monto);
    this.version.update(v => v + 1);
    this.cerrarAbono();
  }

  async borrar(m: LocalMeta) {
    if (!confirm(`¿Borrar la meta "${m.nombre}"?`)) return;
    await this.svc.borrar(m.id);
    this.version.update(v => v + 1);
  }
}
