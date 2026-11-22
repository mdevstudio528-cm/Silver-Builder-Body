import { Directive, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { aNumero, formatearMiles, formatearMilesParcial } from './miles';

/**
 * Coma de millar EN VIVO en los campos de dinero, sin romper decimales.
 *
 *   <input type="text" inputmode="decimal" afzMiles [(ngModel)]="form.monto">
 *
 * - Mientras escribes ves 20,000 / 1,234.50 (se formatea en cada tecla).
 * - Acepta punto y coma como decimal (teclado en español: 1234,5 → 1,234.50).
 * - El cursor no salta: se recoloca contando dígitos, no caracteres.
 * - El modelo recibe un number limpio (20000), nunca el texto con comas.
 */
@Directive({
  selector: 'input[afzMiles]',
  standalone: true
})
export class MilesDirective implements OnInit {
  private el = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private ctrl = inject(NgControl, { self: true, optional: true });

  ngOnInit(): void {
    this.pintar(aNumero(this.ctrl?.value));
  }

  @HostListener('input', ['$event'])
  alEscribir(e: Event): void {
    const input = e.target as HTMLInputElement;
    const crudo = input.value;
    const caret = input.selectionStart ?? crudo.length;
    const pintado = formatearMilesParcial(crudo);

    if (crudo !== pintado) {
      input.value = pintado;

      let pos = pintado.length;                    // caso normal: escribes al final
      if (caret < crudo.length) {                  // editando en medio
        const digitosIzq = (crudo.slice(0, caret).match(/\d/g) || []).length;
        let vistos = 0;
        pos = 0;
        for (let i = 0; i < pintado.length; i++) {
          if (vistos >= digitosIzq) break;
          if (/\d/.test(pintado[i])) vistos++;
          pos = i + 1;
        }
      }
      try { input.setSelectionRange(pos, pos); } catch { /* algunos móviles lo ignoran */ }
    }

    // El modelo se actualiza en cada tecla, después de que ngModel haya leído
    // el campo, para que nunca quede texto con comas guardado en el formulario.
    const n = aNumero(pintado);
    setTimeout(() => this.ctrl?.control?.setValue(n, { emitModelToViewChange: false }));
  }

  @HostListener('blur')
  alSalir(): void {
    const n = aNumero(this.el.nativeElement.value);
    // emitModelToViewChange:false para no borrar las comas recién pintadas
    this.ctrl?.control?.setValue(n, { emitModelToViewChange: false });
    this.pintar(n);
  }

  private pintar(n: number | null): void {
    this.el.nativeElement.value = n === null ? '' : formatearMiles(n);
  }
}
