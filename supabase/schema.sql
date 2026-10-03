-- Daylight / Aria Family Tasks - Supabase schema
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  primary key (family_id,user_id),
  unique(user_id)
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  days_mask integer not null check (days_mask between 1 and 127),
  time_local time not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.task_results (
  task_id uuid not null references public.tasks(id) on delete cascade,
  child_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  state text not null check (state in ('done','help','not_done')),
  note text not null default '' check (length(note)<=500),
  updated_at timestamptz not null default now(),
  primary key(task_id,child_id,local_date)
);
create table if not exists public.invites (
  code text primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  role text not null check(role in ('parent','child')),
  expires_at timestamptz not null default (now()+interval '7 days'),
  consumed_at timestamptz
);

create or replace function private.is_member(p_family uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.family_members m where m.family_id=p_family and m.user_id=auth.uid())
$$;
create or replace function private.has_role(p_family uuid,p_role text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.family_members m where m.family_id=p_family and m.user_id=auth.uid() and m.role=p_role)
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_results enable row level security;
alter table public.invites enable row level security;

drop policy if exists "members read family" on public.families;
drop policy if exists "members read members" on public.family_members;
drop policy if exists "members read tasks" on public.tasks;
drop policy if exists "parents insert tasks" on public.tasks;
drop policy if exists "parents update tasks" on public.tasks;
drop policy if exists "parents delete tasks" on public.tasks;
drop policy if exists "family reads results" on public.task_results;
drop policy if exists "child inserts own result" on public.task_results;
drop policy if exists "child updates own result" on public.task_results;

create policy "members read family" on public.families for select to authenticated using ((select private.is_member(id)));
create policy "members read members" on public.family_members for select to authenticated using ((select private.is_member(family_id)));
create policy "members read tasks" on public.tasks for select to authenticated using ((select private.is_member(family_id)));
create policy "parents insert tasks" on public.tasks for insert to authenticated with check ((select private.has_role(family_id,'parent')));
create policy "parents update tasks" on public.tasks for update to authenticated using ((select private.has_role(family_id,'parent'))) with check ((select private.has_role(family_id,'parent')));
create policy "parents delete tasks" on public.tasks for delete to authenticated using ((select private.has_role(family_id,'parent')));
create policy "family reads results" on public.task_results for select to authenticated using (
  child_id=auth.uid() or (select private.has_role((select t.family_id from public.tasks t where t.id=task_id),'parent'))
);
create policy "child inserts own result" on public.task_results for insert to authenticated with check (
  child_id=auth.uid() and (select private.has_role((select t.family_id from public.tasks t where t.id=task_id),'child'))
);
create policy "child updates own result" on public.task_results for update to authenticated using (
  child_id=auth.uid() and (select private.has_role((select t.family_id from public.tasks t where t.id=task_id),'child'))
) with check (
  child_id=auth.uid() and (select private.has_role((select t.family_id from public.tasks t where t.id=task_id),'child'))
);

create or replace function public.create_family(p_name text,p_display_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_family uuid;
begin
 if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Verified parent account required'; end if;
 if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Already belongs to a family'; end if;
 insert into public.families(name,created_by) values(trim(p_name),auth.uid()) returning id into v_family;
 insert into public.family_members(family_id,user_id,role,display_name) values(v_family,auth.uid(),'parent',trim(p_display_name));
 return jsonb_build_object('family_id',v_family,'role','parent');
end $$;

create or replace function public.create_invite(p_family uuid,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not private.has_role(p_family,'parent') then raise exception 'Parents only'; end if;
 if p_role not in ('parent','child') then raise exception 'Invalid role'; end if;
 v_code:=upper(replace(gen_random_uuid()::text,'-',''));
 insert into public.invites(code,family_id,role) values(v_code,p_family,p_role);
 return jsonb_build_object('code',v_code,'role',p_role);
end $$;

create or replace function public.join_family(p_code text,p_display_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_inv public.invites%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Already belongs to a family'; end if;
 select * into v_inv from public.invites where code=upper(trim(p_code)) and consumed_at is null and expires_at>now() for update;
 if not found then raise exception 'Invite invalid, expired, or used'; end if;
 if v_inv.role='parent' and coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Parents must use email sign-in'; end if;
 insert into public.family_members(family_id,user_id,role,display_name) values(v_inv.family_id,auth.uid(),v_inv.role,trim(p_display_name));
 update public.invites set consumed_at=now() where code=v_inv.code;
 return jsonb_build_object('family_id',v_inv.family_id,'role',v_inv.role);
end $$;

create or replace function public.update_task(p_id uuid,p_title text,p_time time,p_days integer,p_active boolean)
returns void language plpgsql set search_path='' as $$
begin
 update public.tasks set title=trim(p_title),time_local=p_time,days_mask=p_days,active=p_active where id=p_id;
 if not found then raise exception 'Task not found or not editable'; end if;
end $$;

revoke all on function public.create_family(text,text) from public,anon;
revoke all on function public.create_invite(uuid,text) from public,anon;
revoke all on function public.join_family(text,text) from public,anon;
revoke all on function public.update_task(uuid,text,time,integer,boolean) from public,anon;
grant execute on function public.create_family(text,text) to authenticated;
grant execute on function public.create_invite(uuid,text) to authenticated;
grant execute on function public.join_family(text,text) to authenticated;
grant execute on function public.update_task(uuid,text,time,integer,boolean) to authenticated;

-- Ask PostgREST to refresh newly-created RPCs immediately.
notify pgrst, 'reload schema';
