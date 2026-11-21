-- Fase 5: base local (Supabase CLI + PostGIS).
-- Tablas mínimas para sincronizar progreso y misiones comunitarias.
-- RLS permisivo SOLO para desarrollo local. Endurecer antes de exponerlo.

create extension if not exists postgis;

-- Perfil sincronizable (last-write-wins por updated_at).
create table if not exists profiles (
  id uuid primary key,
  nombre text not null default 'Viajero',
  nivel int not null default 1,
  xp int not null default 0,
  xp_nivel int not null default 100,
  carisma int not null default 1,
  valentia int not null default 1,
  burocracia int not null default 1,
  supervivencia int not null default 1,
  misiones_completadas text[] not null default '{}',
  misiones_fallidas text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Catálogo comunitario (misiones creadas por jugadores, validadas contra tipos RPG).
create table if not exists misiones_comunitarias (
  id text primary key,
  autor uuid references profiles(id) on delete set null,
  quest jsonb not null,
  dialogos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table misiones_comunitarias enable row level security;

-- Desarrollo local: lectura/escritura abierta. NO usar así en producción.
drop policy if exists "local total profiles" on profiles;
create policy "local total profiles" on profiles for all using (true) with check (true);
drop policy if exists "local total misiones" on misiones_comunitarias;
create policy "local total misiones" on misiones_comunitarias for all using (true) with check (true);
