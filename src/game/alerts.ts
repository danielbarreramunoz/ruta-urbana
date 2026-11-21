/** Avisos y háptica web (con degradación elegante donde no hay soporte). */

export function soportaVibracion(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function vibrar(patron: number | number[] = [80, 40, 80]): boolean {
  try {
    if (!soportaVibracion()) return false;
    return navigator.vibrate(patron);
  } catch {
    return false;
  }
}

export type PermisoAvisos = 'default' | 'granted' | 'denied' | 'no-soportado';

export function permisoAvisos(): PermisoAvisos {
  if (typeof Notification === 'undefined') return 'no-soportado';
  return Notification.permission as PermisoAvisos;
}

export async function pedirPermisoAvisos(): Promise<PermisoAvisos> {
  if (typeof Notification === 'undefined') return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission as PermisoAvisos;
  try {
    return (await Notification.requestPermission()) as PermisoAvisos;
  } catch {
    return 'denied';
  }
}

/**
 * Muestra notificación del sistema (solo tiene sentido con la app en segundo
 * plano; con la app visible el banner interno basta). Las ubicaciones sensibles
 * usan texto neutro.
 */
export function mostrarAviso(titulo: string, cuerpo: string): boolean {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
    if (!document.hidden) return false;
    new Notification(titulo, { body: cuerpo, tag: 'ruta-urbana' });
    return true;
  } catch {
    return false;
  }
}

export function textoAviso(objetivo: { nombre: string; sensible?: boolean }, questTitulo: string): { titulo: string; cuerpo: string } {
  if (objetivo.sensible) {
    return { titulo: 'Ruta Urbana', cuerpo: 'Tienes una misión secundaria cerca.' };
  }
  return { titulo: `📍 ${objetivo.nombre}`, cuerpo: `Llegaste a tu objetivo: ${questTitulo}. Toca para abrir la misión.` };
}
