import { Directive, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { aNumero, formatearMiles, limpiarMientrasEscribe } from './miles';

/**
 * Pone la coma de millar en los campos de dinero, sin guardar texto.
 *
 *   <input type="text" afzMiles [(ngModel)]="form.monto">
 *
 * - mientras escribes deja solo dígitos y un punto
 * - al salir del campo pinta 50,000 y guarda el número 50000 en el modelo
 * - al volver a entrar quita las comas para editar cómodo
 *
 * El modelo NUNCA recibe el texto con comas: recibe un number, así el
 * servidor y IndexedDB siguen trabajando con números.
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
    const limpio = limpiarMientrasEscribe(input.value);
    if (limpio !== input.value) {
      const pos = input.selectionStart ?? limpio.length;
      input.value = limpio;
      const nuevo = Math.max(0, pos - (input.value.length - limpio.length));
      try { input.setSelectionRange(nuevo, nuevo); } catch { /* algunos móviles no lo permiten */ }
    }
  }

  @HostListener('focus')
  alEntrar(): void {
    const n = aNumero(this.el.nativeElement.value);
    if (n !== null) this.el.nativeElement.value = String(n);
  }

  @HostListener('blur')
  alSalir(): void {
    const n = aNumero(this.el.nativeElement.value);
    // emitModelToViewChange: false para que ngModel no borre las comas recién pintadas
    this.ctrl?.control?.setValue(n, { emitModelToViewChange: false });
    this.pintar(n);
  }

  private pintar(n: number | null): void {
    this.el.nativeElement.value = n === null ? '' : formatearMiles(n);
  }
}
