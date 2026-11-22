/** Pantalla de carga para los `React.lazy` (mapa y pestañas diferidas). */
export default function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6" role="status" aria-live="polite">
      <span className="ru-carga" aria-hidden />
      <p className="font-pixel text-[11px] tracking-[0.2em] text-ruta-gold">{texto}</p>
    </div>
  );
}
