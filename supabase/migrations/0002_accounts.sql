-- Finanzas JJ — cuentas y tarjetas (vista personal de Javier)
-- Ejecutar en el SQL Editor de Supabase.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'cuenta' check (tipo in ('cuenta', 'tarjeta')),
  -- cuenta: saldo actual · tarjeta: monto utilizado
  monto bigint not null default 0,
  -- solo tarjetas: cupo total (para calcular disponible). null si no aplica.
  cupo bigint,
  orden integer not null default 0,
  fecha_actualizacion timestamptz not null default now()
);

alter table public.accounts enable row level security;
drop policy if exists allowed_all on public.accounts;
create policy allowed_all on public.accounts
  for all to authenticated
  using (public.is_allowed_user())
  with check (public.is_allowed_user());
