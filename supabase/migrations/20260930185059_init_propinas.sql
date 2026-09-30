-- Configuración global (una sola fila)
create table public.app_config (
  id int primary key default 1 check (id = 1),
  demo_mode boolean not null default true,
  fee_bps int not null default 500 check (fee_bps between 0 and 2000)
);
insert into public.app_config default values;
alter table public.app_config enable row level security;
create policy "config legible" on public.app_config for select using (true);

-- Trabajadores (1:1 con auth.users)
create table public.workers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role_title text not null default '',
  place text not null default '',
  amount_cents int not null default 2000 check (amount_cents between 1000 and 500000),
  balance_cents int not null default 0 check (balance_cents >= 0),
  stripe_account_id text,
  created_at timestamptz not null default now()
);
alter table public.workers enable row level security;
create policy "trabajador lee su perfil" on public.workers for select to authenticated
  using (id = (select auth.uid()));
create policy "trabajador edita su perfil" on public.workers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.workers from anon, authenticated;
grant update (full_name, role_title, place, amount_cents) on public.workers to authenticated;

-- Tarjetas NFC / QR
create table public.tags (
  code text primary key,
  worker_id uuid not null references public.workers(id) on delete cascade,
  label text not null default 'Mi tarjeta',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index tags_worker_idx on public.tags(worker_id);
alter table public.tags enable row level security;
create policy "trabajador lee sus tarjetas" on public.tags for select to authenticated
  using (worker_id = (select auth.uid()));
create policy "trabajador edita sus tarjetas" on public.tags for update to authenticated
  using (worker_id = (select auth.uid())) with check (worker_id = (select auth.uid()));
revoke insert, update, delete on public.tags from anon, authenticated;
grant update (label, active) on public.tags to authenticated;

-- Propinas
create table public.tips (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  tag_code text references public.tags(code) on delete set null,
  amount_cents int not null check (amount_cents between 1000 and 500000),
  fee_cents int not null,
  fee_covered boolean not null,
  total_cents int not null,
  net_cents int not null,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  method text not null default 'demo',
  stripe_payment_intent_id text unique,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index tips_worker_idx on public.tips(worker_id, created_at desc);
create index tips_tag_idx on public.tips(tag_code);
alter table public.tips enable row level security;
create policy "trabajador lee sus propinas" on public.tips for select to authenticated
  using (worker_id = (select auth.uid()));
revoke insert, update, delete on public.tips from anon, authenticated;

-- Retiros
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  method text not null check (method in ('spei','instant','mercadopago','oxxo')),
  amount_cents int not null check (amount_cents > 0),
  fee_cents int not null default 0,
  status text not null default 'requested' check (status in ('requested','paid','failed')),
  created_at timestamptz not null default now()
);
create index withdrawals_worker_idx on public.withdrawals(worker_id, created_at desc);
alter table public.withdrawals enable row level security;
create policy "trabajador lee sus retiros" on public.withdrawals for select to authenticated
  using (worker_id = (select auth.uid()));
revoke insert, update, delete on public.withdrawals from anon, authenticated;

-- Código corto para tarjetas (sin caracteres ambiguos)
create function public.gen_tag_code() returns text
language plpgsql set search_path = '' as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.tags where code = c);
  end loop;
  return c;
end $$;

-- Al registrarse: crea perfil + primera tarjeta
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workers (id, full_name, role_title, place)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role_title', ''),
    coalesce(new.raw_user_meta_data->>'place', '')
  );
  insert into public.tags (code, worker_id) values (public.gen_tag_code(), new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Datos públicos de una tarjeta (lo que ve el cliente)
create function public.get_tag_public(p_code text)
returns table (code text, full_name text, role_title text, place text, amount_cents int, fee_bps int, demo_mode boolean)
language sql stable security definer set search_path = '' as $$
  select t.code, w.full_name, w.role_title, w.place, w.amount_cents, c.fee_bps, c.demo_mode
  from public.tags t
  join public.workers w on w.id = t.worker_id
  cross join public.app_config c
  where t.code = upper(p_code) and t.active
$$;

-- Pago simulado (solo funciona con demo_mode = true)
create function public.demo_pay_tip(p_code text, p_amount_cents int, p_cover boolean)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tag public.tags;
  v_cfg public.app_config;
  v_fee int; v_total int; v_net int; v_id uuid;
begin
  select * into v_cfg from public.app_config where id = 1;
  if not v_cfg.demo_mode then raise exception 'El modo demo está desactivado'; end if;
  select * into v_tag from public.tags where code = upper(p_code) and active;
  if v_tag is null then raise exception 'Tarjeta no encontrada'; end if;
  if p_amount_cents < 1000 or p_amount_cents > 500000 then raise exception 'Monto fuera de rango'; end if;

  v_fee := round(p_amount_cents * v_cfg.fee_bps / 10000.0);
  v_total := p_amount_cents + case when p_cover then v_fee else 0 end;
  v_net := case when p_cover then p_amount_cents else p_amount_cents - v_fee end;

  insert into public.tips (worker_id, tag_code, amount_cents, fee_cents, fee_covered, total_cents, net_cents, status, method, paid_at)
  values (v_tag.worker_id, v_tag.code, p_amount_cents, v_fee, p_cover, v_total, v_net, 'paid', 'demo', now())
  returning id into v_id;

  update public.workers set balance_cents = balance_cents + v_net where id = v_tag.worker_id;
  return v_id;
end $$;

-- Calificación del cliente (una vez, dentro de 2 horas)
create function public.rate_tip(p_tip_id uuid, p_rating int) returns void
language sql security definer set search_path = '' as $$
  update public.tips set rating = p_rating
  where id = p_tip_id and rating is null and status = 'paid'
    and created_at > now() - interval '2 hours'
    and p_rating between 1 and 5
$$;

-- Nueva tarjeta para el trabajador en sesión (máx. 10)
create function public.create_my_tag(p_label text default 'Mi tarjeta') returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if (select count(*) from public.tags where worker_id = auth.uid()) >= 10 then
    raise exception 'Máximo 10 tarjetas';
  end if;
  v_code := public.gen_tag_code();
  insert into public.tags (code, worker_id, label) values (v_code, auth.uid(), coalesce(nullif(trim(p_label), ''), 'Mi tarjeta'));
  return v_code;
end $$;

-- Solicitar retiro de todo el saldo
create function public.request_withdrawal(p_method text) returns public.withdrawals
language plpgsql security definer set search_path = '' as $$
declare
  v_bal int; v_fee int; v_row public.withdrawals;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  v_fee := case p_method when 'instant' then 900 when 'oxxo' then 1200 when 'spei' then 0 when 'mercadopago' then 0 end;
  if v_fee is null then raise exception 'Método no válido'; end if;
  select balance_cents into v_bal from public.workers where id = auth.uid() for update;
  if v_bal is null or v_bal <= v_fee then raise exception 'Saldo insuficiente'; end if;
  insert into public.withdrawals (worker_id, method, amount_cents, fee_cents)
  values (auth.uid(), p_method, v_bal - v_fee, v_fee) returning * into v_row;
  update public.workers set balance_cents = 0 where id = auth.uid();
  return v_row;
end $$;

-- Para Stripe (solo el servidor con service_role)
create function public.create_pending_tip(p_code text, p_amount_cents int, p_cover boolean, p_pi text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tag public.tags; v_cfg public.app_config; v_fee int; v_id uuid;
begin
  select * into v_cfg from public.app_config where id = 1;
  select * into v_tag from public.tags where code = upper(p_code) and active;
  if v_tag is null then raise exception 'Tarjeta no encontrada'; end if;
  v_fee := round(p_amount_cents * v_cfg.fee_bps / 10000.0);
  insert into public.tips (worker_id, tag_code, amount_cents, fee_cents, fee_covered, total_cents, net_cents, status, method, stripe_payment_intent_id)
  values (v_tag.worker_id, v_tag.code, p_amount_cents, v_fee, p_cover,
          p_amount_cents + case when p_cover then v_fee else 0 end,
          case when p_cover then p_amount_cents else p_amount_cents - v_fee end,
          'pending', 'stripe', p_pi)
  returning id into v_id;
  return v_id;
end $$;

create function public.mark_tip_paid(p_pi text, p_method text default 'stripe') returns void
language plpgsql security definer set search_path = '' as $$
declare v_tip public.tips;
begin
  update public.tips set status = 'paid', paid_at = now(), method = p_method
  where stripe_payment_intent_id = p_pi and status = 'pending'
  returning * into v_tip;
  if v_tip is not null then
    update public.workers set balance_cents = balance_cents + v_tip.net_cents where id = v_tip.worker_id;
  end if;
end $$;

-- Permisos de ejecución
revoke execute on function public.gen_tag_code() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_pending_tip(text, int, boolean, text) from public, anon, authenticated;
revoke execute on function public.mark_tip_paid(text, text) from public, anon, authenticated;
grant execute on function public.create_pending_tip(text, int, boolean, text) to service_role;
grant execute on function public.mark_tip_paid(text, text) to service_role;

revoke execute on function public.get_tag_public(text) from public;
revoke execute on function public.demo_pay_tip(text, int, boolean) from public;
revoke execute on function public.rate_tip(uuid, int) from public;
grant execute on function public.get_tag_public(text) to anon, authenticated;
grant execute on function public.demo_pay_tip(text, int, boolean) to anon, authenticated;
grant execute on function public.rate_tip(uuid, int) to anon, authenticated;

revoke execute on function public.create_my_tag(text) from public, anon;
revoke execute on function public.request_withdrawal(text) from public, anon;
grant execute on function public.create_my_tag(text) to authenticated;
grant execute on function public.request_withdrawal(text) to authenticated;

-- Tiempo real para avisos al trabajador
alter publication supabase_realtime add table public.tips, public.workers;
