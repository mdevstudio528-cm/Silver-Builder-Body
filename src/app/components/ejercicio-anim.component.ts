import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Animación de ejercicio estilo GIF: SVG animado con CSS, 100% offline.
 * Cada "patrón" es una escena con un grupo en movimiento que se repite en bucle.
 */
@Component({
  selector: 'ejercicio-anim',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host{display:block;width:100%}'],
  template: `
    @switch (patron()) {
      @case ('press') {
        <svg class="ejsvg pat-press" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="52" y="86" width="116" height="9" rx="4"/>
          <line class="sv-linea" x1="68" y1="95" x2="68" y2="126"/>
          <line class="sv-linea" x1="152" y1="95" x2="152" y2="126"/>
          <circle class="sv-cabeza" cx="48" cy="78" r="7"/>
          <line class="sv-cuerpo" x1="56" y1="78" x2="128" y2="78"/>
          <line class="sv-cuerpo" x1="128" y1="78" x2="178" y2="86"/>
          <g class="mov">
            <line class="sv-acento" x1="66" y1="52" x2="154" y2="52"/>
            <circle class="sv-placa" cx="66" cy="52" r="10"/>
            <circle class="sv-placa" cx="154" cy="52" r="10"/>
          </g>
          <path class="sv-flecha" d="M110 34 l0 26 M104 40 l6 -6 6 6 M104 54 l6 6 6 -6"/>
        </svg>
      }
      @case ('presshombro') {
        <svg class="ejsvg pat-presshombro" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-cabeza" cx="120" cy="34" r="8"/>
          <line class="sv-cuerpo" x1="120" y1="42" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="108" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="132" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="50" x2="104" y2="64"/>
          <line class="sv-cuerpo" x1="120" y1="50" x2="136" y2="64"/>
          <g class="mov">
            <line class="sv-acento" x1="92" y1="58" x2="148" y2="58"/>
            <circle class="sv-placa" cx="92" cy="58" r="8"/>
            <circle class="sv-placa" cx="148" cy="58" r="8"/>
          </g>
          <path class="sv-flecha" d="M120 6 l0 20 M114 12 l6 -6 6 6"/>
        </svg>
      }
      @case ('curl') {
        <svg class="ejsvg pat-curl" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-cabeza" cx="120" cy="34" r="8"/>
          <line class="sv-cuerpo" x1="120" y1="42" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="108" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="132" y2="124"/>
          <g class="mov" style="transform-origin:120px 52px">
            <line class="sv-cuerpo" x1="120" y1="52" x2="120" y2="92"/>
            <circle class="sv-placa" cx="120" cy="96" r="8"/>
          </g>
          <path class="sv-flecha" d="M152 92 a40 40 0 0 0 -14 -52 M138 44 l6 -2 -1 7"/>
        </svg>
      }
      @case ('lateral') {
        <svg class="ejsvg pat-lateral" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-cabeza" cx="120" cy="34" r="8"/>
          <line class="sv-cuerpo" x1="120" y1="42" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="108" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="132" y2="124"/>
          <g class="movi" style="transform-origin:114px 52px">
            <line class="sv-cuerpo" x1="114" y1="52" x2="114" y2="92"/>
            <circle class="sv-placa" cx="114" cy="96" r="7"/>
          </g>
          <g class="movd" style="transform-origin:126px 52px">
            <line class="sv-cuerpo" x1="126" y1="52" x2="126" y2="92"/>
            <circle class="sv-placa" cx="126" cy="96" r="7"/>
          </g>
          <path class="sv-flecha" d="M74 66 l14 -14 M88 52 l-2 8 M88 52 l-8 2"/>
        </svg>
      }
      @case ('fly') {
        <svg class="ejsvg pat-fly" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-placa" cx="34" cy="24" r="6"/>
          <circle class="sv-placa" cx="206" cy="24" r="6"/>
          <g class="movi" style="transform-origin:34px 24px">
            <line class="sv-acento" x1="34" y1="24" x2="98" y2="84"/>
            <circle class="sv-placa" cx="102" cy="87" r="7"/>
          </g>
          <g class="movd" style="transform-origin:206px 24px">
            <line class="sv-acento" x1="206" y1="24" x2="142" y2="84"/>
            <circle class="sv-placa" cx="138" cy="87" r="7"/>
          </g>
          <circle class="sv-cabeza" cx="120" cy="46" r="7"/>
          <line class="sv-cuerpo" x1="120" y1="53" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="110" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="130" y2="124"/>
          <path class="sv-flecha" d="M84 106 l16 -8 M96 104 l4 6 M96 104 l-6 4"/>
        </svg>
      }
      @case ('remo') {
        <svg class="ejsvg pat-remo" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="62" y="98" width="56" height="8" rx="4"/>
          <circle class="sv-cabeza" cx="84" cy="52" r="8"/>
          <line class="sv-cuerpo" x1="88" y1="60" x2="100" y2="98"/>
          <line class="sv-cuerpo" x1="100" y1="98" x2="146" y2="106"/>
          <line class="sv-cuerpo" x1="88" y1="66" x2="122" y2="72"/>
          <g class="mov">
            <rect class="sv-placa" x="176" y="54" width="18" height="50" rx="4"/>
            <line class="sv-acento" x1="176" y1="79" x2="150" y2="74"/>
          </g>
          <path class="sv-flecha" d="M158 36 l-22 0 M142 30 l-6 6 6 6"/>
        </svg>
      }
      @case ('pulldown') {
        <svg class="ejsvg pat-pulldown" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="66" y="98" width="52" height="8" rx="4"/>
          <circle class="sv-cabeza" cx="86" cy="56" r="8"/>
          <line class="sv-cuerpo" x1="88" y1="64" x2="96" y2="98"/>
          <line class="sv-cuerpo" x1="88" y1="70" x2="112" y2="52"/>
          <circle class="sv-placa" cx="120" cy="12" r="5"/>
          <g class="mov">
            <line class="sv-acento" x1="96" y1="46" x2="144" y2="46"/>
            <circle class="sv-placa" cx="96" cy="46" r="6"/>
            <circle class="sv-placa" cx="144" cy="46" r="6"/>
          </g>
          <path class="sv-flecha" d="M160 22 l0 24 M154 40 l6 6 6 -6"/>
        </svg>
      }
      @case ('sentadilla') {
        <svg class="ejsvg pat-sentadilla" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <g class="mov">
            <circle class="sv-cabeza" cx="120" cy="30" r="8"/>
            <line class="sv-cuerpo" x1="120" y1="38" x2="120" y2="86"/>
            <line class="sv-cuerpo" x1="120" y1="86" x2="106" y2="124"/>
            <line class="sv-cuerpo" x1="120" y1="86" x2="134" y2="124"/>
            <line class="sv-acento" x1="92" y1="44" x2="148" y2="44"/>
            <circle class="sv-placa" cx="92" cy="44" r="9"/>
            <circle class="sv-placa" cx="148" cy="44" r="9"/>
          </g>
          <path class="sv-flecha" d="M176 60 l0 34 M170 88 l6 6 6 -6"/>
        </svg>
      }
      @case ('rdl') {
        <svg class="ejsvg pat-rdl" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-cabeza" cx="120" cy="26" r="8"/>
          <g class="torso" style="transform-origin:120px 80px">
            <line class="sv-cuerpo" x1="120" y1="34" x2="120" y2="80"/>
          </g>
          <line class="sv-cuerpo" x1="120" y1="80" x2="110" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="80" x2="130" y2="124"/>
          <g class="mov">
            <line class="sv-acento" x1="92" y1="76" x2="148" y2="76"/>
            <circle class="sv-placa" cx="92" cy="76" r="10"/>
            <circle class="sv-placa" cx="148" cy="76" r="10"/>
          </g>
        </svg>
      }
      @case ('prensa') {
        <svg class="ejsvg pat-prensa" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="34" y="90" width="52" height="9" rx="4"/>
          <circle class="sv-cabeza" cx="56" cy="54" r="8"/>
          <line class="sv-cuerpo" x1="62" y1="62" x2="78" y2="92"/>
          <g class="mov">
            <rect class="sv-placa" x="152" y="56" width="9" height="48" rx="3"/>
            <line class="sv-cuerpo" x1="78" y1="92" x2="148" y2="64"/>
            <line class="sv-cuerpo" x1="78" y1="92" x2="148" y2="96"/>
          </g>
          <path class="sv-flecha" d="M186 44 l-22 0 M170 38 l-6 6 6 6"/>
        </svg>
      }
      @case ('hipthrust') {
        <svg class="ejsvg pat-hipthrust" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="142" y="84" width="66" height="9" rx="4"/>
          <circle class="sv-cabeza" cx="170" cy="70" r="7"/>
          <g class="mov">
            <line class="sv-cuerpo" x1="96" y1="82" x2="148" y2="78"/>
            <line class="sv-cuerpo" x1="96" y1="82" x2="72" y2="102"/>
            <line class="sv-cuerpo" x1="72" y1="102" x2="66" y2="124"/>
            <line class="sv-acento" x1="72" y1="72" x2="122" y2="72"/>
            <circle class="sv-placa" cx="72" cy="72" r="9"/>
            <circle class="sv-placa" cx="122" cy="72" r="9"/>
          </g>
          <path class="sv-flecha" d="M40 66 l0 24 M34 72 l6 -6 6 6"/>
        </svg>
      }
      @case ('gemelos') {
        <svg class="ejsvg pat-gemelos" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="88" y="118" width="64" height="8" rx="3"/>
          <g class="mov">
            <circle class="sv-cabeza" cx="120" cy="34" r="8"/>
            <line class="sv-cuerpo" x1="120" y1="42" x2="120" y2="88"/>
            <line class="sv-cuerpo" x1="120" y1="88" x2="112" y2="116"/>
            <line class="sv-cuerpo" x1="120" y1="88" x2="128" y2="116"/>
            <line class="sv-cuerpo" x1="106" y1="116" x2="134" y2="116"/>
          </g>
          <path class="sv-flecha" d="M168 78 l0 24 M162 84 l6 -6 6 6"/>
        </svg>
      }
      @case ('skull') {
        <svg class="ejsvg pat-skull" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="48" y="90" width="116" height="9" rx="4"/>
          <circle class="sv-cabeza" cx="52" cy="82" r="7"/>
          <line class="sv-cuerpo" x1="60" y1="82" x2="124" y2="82"/>
          <line class="sv-cuerpo" x1="124" y1="82" x2="168" y2="90"/>
          <line class="sv-cuerpo" x1="76" y1="82" x2="98" y2="86"/>
          <g class="mov" style="transform-origin:98px 86px">
            <line class="sv-cuerpo" x1="98" y1="86" x2="98" y2="52"/>
            <circle class="sv-placa" cx="98" cy="48" r="8"/>
          </g>
          <path class="sv-flecha" d="M132 40 a44 44 0 0 0 -14 30 M118 66 l6 6 4 -8"/>
        </svg>
      }
      @case ('pushdown') {
        <svg class="ejsvg pat-pushdown" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-placa" cx="150" cy="10" r="5"/>
          <line class="sv-acento" x1="150" y1="15" x2="150" y2="52"/>
          <circle class="sv-cabeza" cx="108" cy="38" r="8"/>
          <line class="sv-cuerpo" x1="108" y1="46" x2="108" y2="90"/>
          <line class="sv-cuerpo" x1="108" y1="90" x2="98" y2="124"/>
          <line class="sv-cuerpo" x1="108" y1="90" x2="118" y2="124"/>
          <line class="sv-cuerpo" x1="108" y1="52" x2="122" y2="58"/>
          <g class="mov">
            <line class="sv-acento" x1="126" y1="58" x2="162" y2="58"/>
            <circle class="sv-placa" cx="126" cy="58" r="5"/>
            <circle class="sv-placa" cx="162" cy="58" r="5"/>
          </g>
          <path class="sv-flecha" d="M186 30 l0 40 M180 64 l6 6 6 -6"/>
        </svg>
      }
      @case ('kickback') {
        <svg class="ejsvg pat-kickback" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-cabeza" cx="120" cy="36" r="8"/>
          <line class="sv-cuerpo" x1="120" y1="44" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="112" y2="124"/>
          <line class="sv-cuerpo" x1="120" y1="50" x2="148" y2="62"/>
          <g class="mov" style="transform-origin:120px 88px">
            <line class="sv-cuerpo" x1="120" y1="88" x2="140" y2="102"/>
            <circle class="sv-placa" cx="144" cy="104" r="6"/>
          </g>
          <circle class="sv-placa" cx="206" cy="112" r="5"/>
          <path class="sv-flecha" d="M160 70 a40 40 0 0 1 18 26 M178 90 l4 8 -10 0"/>
        </svg>
      }
      @case ('abduccion') {
        <svg class="ejsvg pat-abduccion" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="88" y="94" width="64" height="10" rx="4"/>
          <line class="sv-linea" x1="150" y1="94" x2="160" y2="64"/>
          <circle class="sv-cabeza" cx="156" cy="56" r="7"/>
          <line class="sv-cuerpo" x1="150" y1="63" x2="124" y2="94"/>
          <g class="movi" style="transform-origin:124px 94px">
            <line class="sv-cuerpo" x1="124" y1="94" x2="102" y2="112"/>
          </g>
          <g class="movd" style="transform-origin:124px 94px">
            <line class="sv-cuerpo" x1="124" y1="94" x2="100" y2="114"/>
          </g>
          <path class="sv-flecha" d="M70 88 l14 -6 M84 82 l-6 6 M84 82 l-8 -2"/>
        </svg>
      }
      @case ('zancada') {
        <svg class="ejsvg pat-zancada" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <g class="mov">
            <circle class="sv-cabeza" cx="120" cy="30" r="8"/>
            <line class="sv-cuerpo" x1="120" y1="38" x2="120" y2="80"/>
            <line class="sv-cuerpo" x1="120" y1="80" x2="140" y2="124"/>
            <line class="sv-cuerpo" x1="120" y1="80" x2="104" y2="124"/>
            <line class="sv-cuerpo" x1="104" y1="124" x2="96" y2="110"/>
            <circle class="sv-placa" cx="106" cy="86" r="6"/>
            <circle class="sv-placa" cx="134" cy="86" r="6"/>
          </g>
          <path class="sv-flecha" d="M178 58 l0 34 M172 86 l6 6 6 -6"/>
        </svg>
      }
      @case ('extrodilla') {
        <svg class="ejsvg pat-extrodilla" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <rect class="sv-banco" x="66" y="96" width="72" height="10" rx="4"/>
          <line class="sv-linea" x1="136" y1="96" x2="146" y2="64"/>
          <circle class="sv-cabeza" cx="142" cy="56" r="7"/>
          <line class="sv-cuerpo" x1="136" y1="63" x2="112" y2="96"/>
          <g class="mov" style="transform-origin:112px 96px">
            <line class="sv-cuerpo" x1="112" y1="96" x2="150" y2="90"/>
            <circle class="sv-placa" cx="156" cy="89" r="7"/>
          </g>
          <path class="sv-flecha" d="M172 62 a40 40 0 0 0 -12 32 M160 88 l4 8 -10 -2"/>
        </svg>
      }
      @case ('dip') {
        <svg class="ejsvg pat-dip" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <line class="sv-linea" x1="86" y1="76" x2="86" y2="126"/>
          <line class="sv-linea" x1="170" y1="76" x2="170" y2="126"/>
          <line class="sv-acento" x1="86" y1="76" x2="170" y2="76"/>
          <circle class="sv-cabeza" cx="120" cy="38" r="8"/>
          <line class="sv-cuerpo" x1="120" y1="46" x2="120" y2="88"/>
          <line class="sv-cuerpo" x1="120" y1="88" x2="132" y2="108"/>
          <line class="sv-cuerpo" x1="132" y1="108" x2="140" y2="122"/>
          <g class="mov">
            <line class="sv-cuerpo" x1="108" y1="80" x2="114" y2="56"/>
            <line class="sv-cuerpo" x1="132" y1="80" x2="126" y2="56"/>
          </g>
          <circle class="sv-placa" cx="108" cy="82" r="5"/>
          <circle class="sv-placa" cx="132" cy="82" r="5"/>
          <path class="sv-flecha" d="M186 40 l0 34 M180 68 l6 6 6 -6"/>
        </svg>
      }
      @case ('flexion') {
        <svg class="ejsvg pat-flexion" viewBox="0 0 240 140" aria-hidden="true">
          <line class="sv-linea" x1="20" y1="126" x2="220" y2="126"/>
          <circle class="sv-placa" cx="72" cy="124" r="4"/>
          <circle class="sv-placa" cx="128" cy="124" r="4"/>
          <g class="mov">
            <circle class="sv-cabeza" cx="56" cy="84" r="7"/>
            <line class="sv-cuerpo" x1="64" y1="88" x2="126" y2="94"/>
            <line class="sv-cuerpo" x1="126" y1="94" x2="166" y2="120"/>
            <line class="sv-cuerpo" x1="70" y1="90" x2="72" y2="122"/>
            <line class="sv-cuerpo" x1="124" y1="94" x2="128" y2="122"/>
          </g>
          <path class="sv-flecha" d="M186 60 l0 34 M180 88 l6 6 6 -6"/>
        </svg>
      }
    }
  `
})
export class EjercicioAnim {
  readonly patron = input.required<string>();
}
