import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DIAS, Dia } from '../core/rutinas';
import { GymService } from '../core/gym.service';
import { fraseDelDia } from '../core/frases';

const COLORES: { [k: string]: string } = {
  'Pecho': '#6fd4ff',
  'Bíceps': '#9dd0ff',
  'Hombro': '#b9c7ff',
  'Espalda': '#b39dff',
  'Tríceps': '#8ea8ff',
  'Pierna completa': '#ffb36b',
  'Glúteo': '#ff8fc0',
  'Gemelos': '#ffd08f'
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app">
      <section class="hero">
        <img src="assets/hero.png" alt="Superhéroe cósmico de plata surfeando entre nebulosas" />
        <div class="hero-txt">
          <h1 class="titulo">SILVER<br /><span>BUILDER</span> BODY</h1>
          <p class="sub">Entrena con poder cósmico</p>
        </div>
      </section>

      <div class="frase-card"><span class="frase">«{{ frase }}»</span></div>

      <div class="etiqueta">Rutina semanal</div>

      <section class="dias">
        @for (d of dias; track d.id) {
          @if (!d.descanso) {
            <a class="dia-card" [class.hoy]="d.id === hoyId" [style.--c]="color(d)" [routerLink]="['/rutina', d.id]">
              <div class="dia-top">
                <span class="dia-nombre">{{ d.nombre }}</span>
                @if (d.id === hoyId) { <span class="pill-hoy">HOY</span> }
              </div>
              <div class="chips">
                @for (g of d.grupos; track g) { <span class="chip" [style.--c]="colores[g]">{{ g }}</span> }
              </div>
              <div class="dia-info">{{ d.ejercicios.length }} ejercicios · {{ progreso(d).total }} series</div>
              @if (gym.esDeHoy(d.id) && progreso(d).hechas > 0) {
                <div class="barra">
                  <div class="barra-fill" [style.width.%]="pct(d)"></div>
                </div>
                <div class="mini-prog">{{ progreso(d).hechas }}/{{ progreso(d).total }} series hoy</div>
              }
            </a>
          } @else {
            <div class="dia-card descanso" [style.--c]="'#8b93ad'">
              <div class="dia-top"><span class="dia-nombre">{{ d.nombre }}</span></div>
              <div class="chips"><span class="chip" [style.--c]="'#8b93ad'">Descanso total</span></div>
              <div class="dia-info">Recarga tu poder cósmico.</div>
            </div>
          }
        }
      </section>

      <footer class="pie">Funciona sin internet · Instálala como app desde tu navegador</footer>
    </div>
  `
})
export class HomePage {
  readonly gym = inject(GymService);
  readonly dias = DIAS;
  readonly colores = COLORES;
  readonly frase = fraseDelDia();
  readonly hoyId = this.gym.idDiaHoy();

  progreso(d: Dia) { return this.gym.progreso(d); }

  color(d: Dia): string {
    return COLORES[d.grupos[0]] ?? '#6fd4ff';
  }

  pct(d: Dia): number {
    const p = this.progreso(d);
    return p.total ? (p.hechas / p.total) * 100 : 0;
  }
}
