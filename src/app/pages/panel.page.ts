import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { MovimientosService } from '../core/movimientos.service';
import { etiquetaMes, money, recientes, salud, shiftMes } from '../core/finance';
import { API, mensajeError } from '../core/api';

interface CarteraMini {
  total: number; alCorriente: number; porVencer: number; vencidos: number;
  sinPago: number; cobradoMes: number; ingresoMensualRecurrente: number;
}

@Component({
  selector: 'afz-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Hola, {{ primerNombre() }} 👋</h1>
        <p>{{ etiquetaMes(mes()) }} · así va tu dinero este mes.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn--ghost btn--sm" (click)="mover(-1)">←</button>
        <button class="btn btn--ghost btn--sm" (click)="mover(1)">→</button>
        <a routerLink="/movimientos" class="btn btn--sm">＋ Registrar</a>
      </div>
    </div>

    <div class="grid grid--3" style="margin-bottom:16px">
      <div class="card">
        <div class="kpi__label">Ingresos del mes</div>
        <div class="kpi__value" style="color:var(--ok)">{{ money(res().ingresos) }}</div>
      </div>
      <div class="card">
        <div class="kpi__label">Egresos del mes</div>
        <div class="kpi__value" style="color:var(--bad)">{{ money(res().egresos) }}</div>
      </div>
      <div class="card">
        <div class="kpi__label">Te queda</div>
        <div class="kpi__value" [style.color]="res().balance >= 0 ? 'var(--brand)' : 'var(--bad)'">
          {{ money(res().balance) }}
        </div>
        <div class="nota" style="margin-top:6px">Ahorro del {{ res().tasaAhorro.toFixed(0) }}% del ingreso</div>
      </div>
    </div>

    <div class="grid grid--2" style="margin-bottom:16px">
      <div class="card">
        <div class="kpi__label">Salud financiera</div>
        <div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 10px">
          <span class="kpi__value" [style.color]="s().color">{{ s().score }}</span>
          <span style="font-size:13px;color:var(--muted)">/ 100 · {{ s().label }}</span>
        </div>
        <div class="bar"><div class="bar__fill" [style.width.%]="s().score" [style.background]="s().color"></div></div>
        <div class="nota" style="margin-top:10px">
          Gasto promedio por día registrado: <b style="color:var(--txt)">{{ money(res().promedioEgresoDiario) }}</b>
          · {{ res().diasConRegistro }} día(s) con registro.
        </div>
        @if (res().mayorGasto) {
          <div class="nota" style="margin-top:6px">
            Gasto más alto: <b style="color:var(--txt)">{{ res().mayorGasto?.descripcion || res().mayorGasto?.categoria }}</b>
            ({{ money(res().mayorGasto!.monto) }})
          </div>
        }
      </div>

      <div class="card">
        <div class="kpi__label">En qué se va el dinero</div>
        @if (res().porCategoria.length === 0) {
          <p class="nota" style="margin-top:12px">Todavía no hay egresos este mes.</p>
        } @else {
          <div style="margin-top:12px">
            @for (c of res().porCategoria.slice(0, 4); track c.categoria) {
              <div style="margin-bottom:9px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                  <span>{{ c.categoria }}</span>
                  <span class="mono" style="color:var(--muted)">{{ money(c.monto) }}</span>
                </div>
                <div class="bar"><div class="bar__fill" [style.width.%]="c.porcentaje"></div></div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="font-size:15px">Últimos movimientos</h3>
        <a routerLink="/movimientos" class="nota" style="color:var(--brand)">Ver todos →</a>
      </div>
      @if (ultimos().length === 0) {
        <p class="nota">Aún no registras movimientos. <a routerLink="/movimientos" style="color:var(--brand)">Empieza aquí</a>.</p>
      } @else {
        <div class="tbl-wrap">
        <table class="tbl">
          <tbody>
            @for (r of ultimos(); track r.id) {
              <tr>
                <td style="white-space:nowrap;color:var(--muted)">{{ r.fecha }}</td>
                <td>{{ r.descripcion || r.categoria }}</td>
                <td class="nota">{{ r.categoria }}</td>
                <td class="mono" style="text-align:right;white-space:nowrap"
                    [style.color]="r.tipo === 'ingreso' ? 'var(--ok)' : 'var(--bad)'">
                  {{ r.tipo === 'ingreso' ? '+' : '−' }}{{ money(r.monto) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>
      }
    </div>

    @if (auth.esAdmin()) {
      <div class="card" style="margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <div class="kpi__label">Tu negocio</div>
          <p class="nota" style="margin:4px 0 0">
            @if (errorCobro()) {
              No se pudo leer la cobranza: {{ errorCobro() }}
            } @else if (cartera()) {
              {{ cartera()!.vencidos + cartera()!.sinPago }} cliente(s) deben ·
              {{ cartera()!.porVencer }} por vencer · {{ cartera()!.alCorriente }} al corriente ·
              {{ money(cartera()!.cobradoMes) }} cobrado este mes
            } @else {
              Revisa quién ya pagó su mensualidad y desactiva cuentas cuando dejen de pagar.
            }
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a routerLink="/admin/cobranza" class="btn">💳 Cobranza</a>
          <a routerLink="/admin/usuarios" class="btn btn--ghost">👥 Usuarios</a>
        </div>
      </div>
    }
  `
})
export class PanelPage implements OnInit {
  auth = inject(AuthService);
  movs = inject(MovimientosService);
  private http = inject(HttpClient);

  money = money;
  etiquetaMes = etiquetaMes;

  mes = this.movs.mes;
  res = this.movs.resumenMes;
  s = computed(() => salud(this.movs.resumenMes()));
  ultimos = computed(() => recientes(this.movs.rows(), 6));

  cartera = signal<CarteraMini | null>(null);
  errorCobro = signal('');

  primerNombre = computed(() => (this.auth.user()?.nombre || '').split(' ')[0] || 'bienvenido');

  async ngOnInit(): Promise<void> {
    await this.movs.iniciar();
    if (this.auth.esAdmin()) await this.cargarCobranza();
  }

  private async cargarCobro(): Promise<void> {
    try {
      const r = await firstValueFrom(this.http.get<any>(`${API}/admin/cobranza`));
      this.cartera.set(r.cartera);
    } catch (e) {
      this.errorCobro.set(mensajeError(e));
    }
  }

  /** Alias para que el template pueda llamarlo sin async en ngOnInit. */
  private async cargarCobranza(): Promise<void> { await this.cargarCobro(); }

  mover(d: number) { this.movs.cambiarMes(shiftMes(this.movs.mes(), d)); }
}
