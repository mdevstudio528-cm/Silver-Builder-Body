/**
 * Estado de la app instalada: sin conexión y versión nueva disponible.
 * Con esto la PWA avisa en pantalla en lugar de fallar en silencio.
 */
import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class PwaService {
  private sw = inject(SwUpdate, { optional: true });

  readonly offline = signal(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  readonly actualizacion = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.offline.set(false));
    window.addEventListener('offline', () => this.offline.set(true));

    if (this.sw?.isEnabled) {
      this.sw.versionUpdates.subscribe((e) => {
        if (e.type === 'VERSION_READY') this.actualizacion.set(true);
      });
      // revisa si hay versión nueva al abrir y cada 30 minutos
      void this.sw.checkForUpdate().catch(() => undefined);
      setInterval(() => void this.sw?.checkForUpdate().catch(() => undefined), 30 * 60_000);
    }
  }

  /** Activa la versión nueva y recarga una sola vez. */
  async aplicar(): Promise<void> {
    if (!this.sw?.isEnabled) { location.reload(); return; }
    try {
      await this.sw.activateUpdate();
    } finally {
      location.reload();
    }
  }
}
