import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DIAS, buscarDia } from '../core/rutinas';
import { GymService } from '../core/gym.service';
import { fraseAleatoria } from '../core/frases';
import { EjercicioAnim } from '../components/ejercicio-anim.component';

const RING = 339.3; // circunferencia del anillo de descanso (r = 54)

@Component({
  selector: 'app-play',
  standalone: true,
  imports: [RouterLink, EjercicioAnim],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app play">
      <header class="cab-play">
        <a class="btn-icono" routerLink="/rutina/{{ dia.id }}" aria-label="Volver">‹</a>
        <div class="cab-tit">
          <span class="dia-nombre">{{ dia.nombre }}</span>
          <span class="sub-pagina">{{ dia.grupos.join(' · ') }}</span>
        </div>
        <div class="crono" [title]="'Tiempo de sesión'">{{ gym.fmt(tiempoTotal()) }}</div>
      </header>

      <div class="prog-caja">
        <div class="barra"><div class="barra-fill" [style.width.%]="pctTotal()"></div></div>
        <div class="prog-txt">{{ progreso().hechas }} / {{ progreso().total }} series completadas</div>
      </div>

      <section class="tarjeta-ej">
        <div class="anim-grande">
          <ejercicio-anim [patron]="ej().patron"/>
        </div>
        <div class="ej-indice">Ejercicio {{ idx() + 1 }} de {{ dia.ejercicios.length }}</div>
        <h2 class="ej-nombre">{{ ej().nombre }}</h2>
        <div class="ej-reps">
          <span class="reps-num">{{ ej().reps }}</span><span class="reps-lbl">reps</span>
          <span class="sep"></span>
          <span class="reps-num">{{ ej().series }}</span><span class="reps-lbl">series</span>
        </div>
        <div class="dots">
          @for (i of arreglo(ej().series); track $index) {
            <span class="dot" [class.llena]="$index < hechas()"></span>
          }
        </div>
        <div class="serie-actual">Serie {{ serieActual() }} de {{ ej().series }}</div>
        @if (ej().consejo) { <p class="consejo">{{ ej().consejo }}</p> }
        <div class="acciones">
          <button class="btn secundario" (click)="deshacer()" [disabled]="hechas() === 0" aria-label="Deshacer serie">−</button>
          <button class="btn primario" (click)="serieCompleta()" [disabled]="hechas() >= ej().series">
            {{ hechas() >= ej().series ? 'EJERCICIO LISTO' : 'SERIE COMPLETADA' }}
          </button>
        </div>
        <div class="nav-ej">
          <button class="btn fantasma" (click)="anterior()" [disabled]="idx() === 0">‹ Anterior</button>
          <button class="btn fantasma" (click)="siguiente()" [disabled]="idx() === dia.ejercicios.length - 1">Siguiente ›</button>
        </div>
      </section>

      <section class="descanso-cfg">
        <span class="lbl">Descanso entre series</span>
        <div class="chips-min">
          @for (m of [1, 2, 3, 4, 5]; track m) {
            <button class="chip-min" [class.sel]="gym.descansoMin() === m" (click)="elegirDescanso(m)">{{ m }} min</button>
          }
        </div>
      </section>

      @if (restActivo()) {
        <div class="overlay rest">
          <svg class="ring" viewBox="0 0 130 130" aria-hidden="true">
            <circle cx="65" cy="65" r="54" class="ring-fondo"/>
            <circle cx="65" cy="65" r="54" class="ring-prog" [style.stroke-dashoffset]="ringOffset()"/>
          </svg>
          <p class="rest-tit">DESCANSO</p>
          <div class="rest-tiempo">{{ gym.fmt(restRestante()) }}</div>
          <div class="rest-acciones">
            <button class="btn secundario" (click)="mas30()">+30 s</button>
            <button class="btn fantasma claro" (click)="saltarRest()">Saltar</button>
          </div>
          <p class="rest-sub">Alarma al terminar · Prepara la siguiente serie</p>
        </div>
      }

      @if (destello()) {
        <div class="overlay destello"><h1>¡DALE!</h1></div>
      }

      @if (completo()) {
        <div class="overlay completo">
          <h2>¡RUTINA COMPLETADA!</h2>
          <p class="frase">«{{ frase }}»</p>
          <div class="tiempo-final">Tiempo total: {{ gym.fmt(tiempoTotal()) }}</div>
          <div class="rest-acciones">
            <button class="btn primario" routerLink="/">Inicio</button>
            <button class="btn fantasma claro" (click)="reiniciar()">Reiniciar</button>
          </div>
        </div>
      }
    </div>
  `
})
export class PlayPage implements OnDestroy {
  readonly gym = inject(GymService);
  private readonly route = inject(ActivatedRoute);

  readonly dia = buscarDia(this.route.snapshot.paramMap.get('dia') ?? '') ?? DIAS[0];
  readonly idx = signal(0);
  readonly ej = computed(() => this.dia.ejercicios[this.idx()]);

  readonly hechas = computed(() => {
    this.gym.version();
    return this.gym.seriesHechas(this.dia.id, this.ej().id);
  });
  readonly progreso = computed(() => {
    this.gym.version();
    return this.gym.progreso(this.dia);
  });
  readonly completo = computed(() => {
    const p = this.progreso();
    return p.total > 0 && p.hechas >= p.total;
  });
  readonly serieActual = computed(() => Math.min(this.hechas() + 1, this.ej().series));

  // Cronómetro de sesión total
  private inicio = this.gym.sesion(this.dia.id)?.inicio ?? Date.now();
  readonly tiempoTotal = signal(0);
  private readonly timerId = setInterval(() => {
    this.tiempoTotal.set(Math.floor((Date.now() - this.inicio) / 1000));
  }, 1000);

  // Descanso con alarma
  readonly restActivo = signal(false);
  readonly restRestante = signal(0);
  private restTotal = this.gym.descansoMin() * 60;
  private restId: ReturnType<typeof setInterval> | null = null;
  readonly destello = signal(false);
  private destelloId: ReturnType<typeof setTimeout> | null = null;
  frase = fraseAleatoria();

  constructor() {
    this.gym.mantenerPantalla();
    this.tiempoTotal.set(Math.floor((Date.now() - this.inicio) / 1000));
  }

  ngOnDestroy(): void {
    clearInterval(this.timerId);
    this.cancelarRest();
    if (this.destelloId) clearTimeout(this.destelloId);
    this.gym.soltarPantalla();
  }

  pctTotal(): number {
    const p = this.progreso();
    return p.total ? (p.hechas / p.total) * 100 : 0;
  }

  arreglo(n: number): number[] { return new Array(n).fill(0); }

  // ---------- Series ----------
  serieCompleta(): void {
    this.gym.desbloquearAudio();
    this.gym.completarSerie(this.dia.id, this.ej().id, this.ej().series);
    this.gym.vibrar();
    if (!this.completo()) {
      this.iniciarRest(this.gym.descansoMin() * 60);
    }
  }

  deshacer(): void {
    this.gym.deshacerSerie(this.dia.id, this.ej().id);
  }

  anterior(): void { if (this.idx() > 0) this.idx.update(i => i - 1); }
  siguiente(): void { if (this.idx() < this.dia.ejercicios.length - 1) this.idx.update(i => i + 1); }

  // ---------- Descanso ----------
  elegirDescanso(min: number): void {
    this.gym.setDescanso(min);
    if (this.restActivo()) {
      this.iniciarRest(min * 60);
    } else {
      this.restTotal = min * 60;
    }
  }

  ringOffset(): number {
    const total = this.restTotal || 1;
    return RING * (1 - this.restRestante() / total);
  }

  private iniciarRest(seg: number): void {
    this.cancelarRest();
    this.restTotal = seg;
    this.restRestante.set(seg);
    this.restActivo.set(true);
    this.restId = setInterval(() => {
      const r = this.restRestante() - 1;
      if (r <= 0) {
        this.terminarRestConAlarma();
      } else {
        this.restRestante.set(r);
      }
    }, 1000);
  }

  mas30(): void {
    const nuevo = Math.min(this.restRestante() + 30, 5 * 60 + 30);
    this.iniciarRest(nuevo);
  }

  saltarRest(): void {
    this.cancelarRest();
  }

  private terminarRestConAlarma(): void {
    this.cancelarRest();
    this.gym.alarma();
    this.destello.set(true);
    this.destelloId = setTimeout(() => this.destello.set(false), 2600);
  }

  private cancelarRest(): void {
    if (this.restId !== null) { clearInterval(this.restId); this.restId = null; }
    this.restActivo.set(false);
    this.restRestante.set(0);
  }

  // ---------- Sesión ----------
  reiniciar(): void {
    this.gym.reiniciar(this.dia.id);
    this.idx.set(0);
    this.inicio = Date.now();
    this.tiempoTotal.set(0);
    this.frase = fraseAleatoria(this.frase);
  }
}
