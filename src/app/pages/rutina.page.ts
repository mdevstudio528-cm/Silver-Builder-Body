import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DIAS, buscarDia } from '../core/rutinas';
import { GymService } from '../core/gym.service';
import { EjercicioAnim } from '../components/ejercicio-anim.component';

@Component({
  selector: 'app-rutina',
  standalone: true,
  imports: [RouterLink, EjercicioAnim],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app">
      <header class="cab-pagina">
        <a class="btn-icono" routerLink="/" aria-label="Inicio">‹</a>
        <div>
          <div class="tit-pagina">{{ dia.nombre }}</div>
          <div class="sub-pagina">{{ dia.grupos.join(' · ') }}</div>
        </div>
      </header>

      @if (gym.esDeHoy(dia.id) && progreso().total > 0 && progreso().hechas > 0) {
        <div class="prog-caja">
          <div class="barra">
            <div class="barra-fill" [style.width.%]="pct()"></div>
          </div>
          <div class="prog-txt">{{ progreso().hechas }} / {{ progreso().total }} series hoy</div>
        </div>
      }

      <section class="lista-ej">
        @for (e of dia.ejercicios; track e.id) {
          <article class="ej-card">
            <div class="ej-anim">
              <ejercicio-anim [patron]="e.patron"/>
            </div>
            <div>
              <div class="nombre">{{ e.nombre }}</div>
              <div class="series-reps">{{ e.series }} series × {{ e.reps }}</div>
              <div class="dots">
                @for (i of arreglo(e.series); track $index) {
                  <span class="dot" [class.llena]="$index < gym.seriesHechas(dia.id, e.id)"></span>
                }
              </div>
              @if (e.consejo) { <p class="consejo">{{ e.consejo }}</p> }
            </div>
          </article>
        }
      </section>

      <div class="acciones-inferior">
        <button class="btn primario" routerLink="/play/{{ dia.id }}">
          {{ continuar ? 'CONTINUAR RUTINA' : 'COMENZAR RUTINA' }}
        </button>
        @if (continuar) {
          <button class="btn fantasma" (click)="reiniciar()">Reiniciar sesión de hoy</button>
        }
      </div>
    </div>
  `
})
export class RutinaPage {
  readonly gym = inject(GymService);
  private readonly route = inject(ActivatedRoute);
  readonly dia = buscarDia(this.route.snapshot.paramMap.get('dia') ?? '') ?? DIAS[0];

  get continuar(): boolean {
    return this.gym.esDeHoy(this.dia.id) && this.progreso().hechas > 0;
  }

  progreso() { return this.gym.progreso(this.dia); }
  pct(): number { const p = this.progreso(); return p.total ? (p.hechas / p.total) * 100 : 0; }
  arreglo(n: number): number[] { return new Array(n).fill(0); }

  reiniciar(): void { this.gym.reiniciar(this.dia.id); }
}
