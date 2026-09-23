-- KINVINS.CD — sécurité des comptes administrateurs
-- À exécuter dans Supabase SQL Editor APRÈS création du projet.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'customer'
    check (role in ('customer','professional','admin','super_admin')),
  status text not null default 'active'
    check (status in ('active','pending','inactive','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Un utilisateur authentifié peut lire uniquement son propre profil.
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Aucune modification de rôle depuis le navigateur client.
-- Les rôles admin/super_admin doivent être attribués depuis un environnement
-- serveur sécurisé ou directement depuis le dashboard Supabase.

-- Exemple APRES avoir créé l'utilisateur admin via Supabase Auth :
-- update public.profiles
-- set role = 'super_admin', status = 'active'
-- where email = 'VOTRE_EMAIL_ADMIN';

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, status)
  values (new.id, new.email, 'customer', 'active')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
