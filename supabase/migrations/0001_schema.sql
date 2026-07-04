-- Finanzas JJ — esquema inicial
-- Ejecutar en el SQL Editor de Supabase (o via supabase db push)

-- ============================================================
-- Tablas
-- ============================================================

-- Emails con acceso a la app (solo Javier y Josefina)
create table if not exists public.allowed_users (
  email text primary key
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  nombre text not null check (nombre in ('Javier', 'Josefina'))
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  presupuesto_mensual integer not null default 0, -- CLP
  ambito text not null default 'depto' check (ambito in ('depto', 'personal')),
  activa boolean not null default true,
  unique (nombre, ambito)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  descripcion text not null,
  monto integer not null, -- CLP, sin decimales
  categoria_id uuid references public.categories(id),
  pagador_id uuid references public.users(id),
  tipo_reparto text not null default 'compartido'
    check (tipo_reparto in ('compartido', 'de_javier', 'de_josefina', 'abono')),
  -- mes YYYY-MM derivado de fecha (columna generada).
  -- Se usa lpad+extract en vez de to_char porque to_char no es IMMUTABLE
  -- y Postgres no lo permite en columnas generadas.
  mes text generated always as (
    lpad(extract(year from fecha)::text, 4, '0')
    || '-'
    || lpad(extract(month from fecha)::text, 2, '0')
  ) stored,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists transactions_mes_idx on public.transactions (mes);
create index if not exists transactions_fecha_idx on public.transactions (fecha desc);

-- Cuotas (créditos en cuotas, ámbito personal de Javier)
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  detalle text not null,
  monto_cuota integer not null,
  total_cuotas integer not null,
  cuotas_pagadas integer not null default 0,
  fecha_inicio date not null,
  ambito text not null default 'personal',
  activa boolean not null default true
);

-- Aprendizaje de categorización: texto normalizado -> categoría
create table if not exists public.aliases (
  id uuid primary key default gen_random_uuid(),
  texto_normalizado text unique not null,
  categoria_id uuid not null references public.categories(id),
  updated_at timestamptz not null default now()
);

-- Settings singleton
create table if not exists public.settings (
  id integer primary key default 1 check (id = 1),
  factor_reparto_josefina numeric not null default 0.275,
  sueldo_liquido integer not null default 0,
  ahorro_mensual integer not null default 0,
  apv_mensual integer not null default 0,
  ppto_variable_mensual integer not null default 0
);

-- Registro de saldos de cuentas de pareja
create table if not exists public.monthly_settlements (
  id uuid primary key default gen_random_uuid(),
  mes text not null, -- YYYY-MM
  monto_saldado integer not null default 0,
  fecha_saldado timestamptz not null default now(),
  saldado_por uuid references public.users(id)
);

create index if not exists settlements_mes_idx on public.monthly_settlements (mes);

-- Inversiones (edición manual)
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  monto_actual bigint not null default 0,
  fecha_actualizacion timestamptz not null default now()
);

-- ============================================================
-- Trigger: desactivar cuota cuando cuotas_pagadas = total_cuotas
-- ============================================================

create or replace function public.deactivate_finished_installments()
returns trigger language plpgsql as $$
begin
  if new.cuotas_pagadas >= new.total_cuotas then
    new.activa := false;
  end if;
  return new;
end;
$$;

drop trigger if exists installments_autodeactivate on public.installments;
create trigger installments_autodeactivate
  before insert or update on public.installments
  for each row execute function public.deactivate_finished_installments();

-- ============================================================
-- Row Level Security: solo usuarios autenticados en allowed_users
-- ============================================================

create or replace function public.is_allowed_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_users au
    where au.email = coalesce(auth.jwt() ->> 'email', '')
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'allowed_users', 'users', 'categories', 'transactions', 'installments',
    'aliases', 'settings', 'monthly_settlements', 'investments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allowed_all on public.%I', t);
    execute format(
      'create policy allowed_all on public.%I for all to authenticated using (public.is_allowed_user()) with check (public.is_allowed_user())',
      t
    );
  end loop;
end;
$$;
