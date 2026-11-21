import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DialogueNode, Jugador, Quest } from './types';

let cliente: SupabaseClient | null = null;

/** Cliente perezoso: null si no hay backend configurado (modo solitario). */
export function backend(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) return null;
  if (!cliente) cliente = createClient(url, key);
  return cliente;
}

export const hayBackend = (): boolean => backend() !== null;

/** Identidad anónima estable por navegador (para presence + perfil). */
export function identidadLocal(): string {
  const K = 'ruta-urbana/device-id';
  let id = localStorage.getItem(K);
  if (!id) {
    id = 'dev-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(K, id);
  }
  return id;
}

function perfilARow(j: Jugador, uid: string) {
  return {
    id: uid,
    nombre: j.nombre,
    nivel: j.nivel,
    xp: j.xp,
    xp_nivel: j.xpParaSiguienteNivel,
    carisma: j.atributos.carisma,
    valentia: j.atributos.valentia,
    burocracia: j.atributos.burocracia,
    supervivencia: j.atributos.supervivencia,
    misiones_completadas: j.misionesCompletadas,
    misiones_fallidas: j.misionesFallidas,
    updated_at: new Date().toISOString(),
  };
}

/** Sube el perfil local (last-write-wins por updated_at en servidor). */
export async function subirPerfil(jugador: Jugador, uid: string): Promise<boolean> {
  const sb = backend();
  if (!sb) return false;
  try {
    const { error } = await sb.from('profiles').upsert(perfilARow(jugador, uid), { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export interface PerfilRemoto {
  nombre: string;
  nivel: number;
  xp: number;
  xpParaSiguienteNivel: number;
  atributos: Jugador['atributos'];
  misionesCompletadas: string[];
  misionesFallidas: string[];
  updatedAt: string;
}

/** Baja el perfil si el remoto es más nuevo que el local. */
export async function bajarPerfil(uid: string, localUpdatedAt: string): Promise<PerfilRemoto | null> {
  const sb = backend();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error || !data) return null;
    if (data.updated_at <= localUpdatedAt) return null;
    return {
      nombre: data.nombre,
      nivel: data.nivel,
      xp: data.xp,
      xpParaSiguienteNivel: data.xp_nivel,
      atributos: { carisma: data.carisma, valentia: data.valentia, burocracia: data.burocracia, supervivencia: data.supervivencia },
      misionesCompletadas: data.misiones_completadas ?? [],
      misionesFallidas: data.misiones_fallidas ?? [],
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

/** Catálogo comunitario (valida forma mínima antes de aceptar). */
export async function listarMisionesComunitarias(): Promise<{ quest: Quest; dialogos: DialogueNode[] }[]> {
  const sb = backend();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('misiones_comunitarias').select('quest, dialogos').order('created_at', { ascending: false }).limit(50);
    if (error || !data) return [];
    return data
      .filter((r) => r.quest && typeof r.quest.id === 'string' && Array.isArray(r.quest.pasos))
      .map((r) => ({ quest: r.quest as Quest, dialogos: (Array.isArray(r.dialogos) ? r.dialogos : []) as DialogueNode[] }));
  } catch {
    return [];
  }
}

/** Publica una misión local al catálogo comunitario. */
export async function publicarMision(quest: Quest, dialogos: DialogueNode[], autorUid: string): Promise<boolean> {
  const sb = backend();
  if (!sb) return false;
  try {
    const { error } = await sb.from('misiones_comunitarias').upsert(
      { id: quest.id, autor: null, quest, dialogos },
      { onConflict: 'id' },
    );
    void autorUid;
    return !error;
  } catch {
    return false;
  }
}
