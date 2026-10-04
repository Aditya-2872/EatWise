-- EatWise initial schema (PROJECT_SPEC.md §24)
-- PostgreSQL / Supabase. Idempotent-safe: uses IF NOT EXISTS throughout.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists pg_trgm;       -- trigram food search

-- ============================================================
-- Helper functions
-- ============================================================

-- updated_at maintenance trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Create profile + settings rows when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- Tables
-- ============================================================

-- profiles (user-owned)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  date_of_birth date,
  sex text check (sex in ('male', 'female', 'other')),
  height_cm numeric,
  current_weight_kg numeric,
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_goals
create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type text not null check (goal_type in ('lose_weight', 'gain_weight', 'build_muscle', 'recomposition', 'maintain', 'improve_nutrition')),
  target_weight_kg numeric,
  target_rate_per_week numeric,
  calorie_target integer not null,
  protein_target_g numeric not null,
  carb_target_g numeric not null,
  fat_target_g numeric not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active goal per user
create unique index if not exists user_goals_one_active_per_user
  on public.user_goals (user_id) where is_active;

-- dietary_preferences
create table if not exists public.dietary_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  diet_type text not null default 'omnivore' check (diet_type in ('omnivore', 'vegetarian', 'vegan', 'eggitarian', 'halal')),
  allergies jsonb not null default '[]'::jsonb,
  disliked_foods jsonb not null default '[]'::jsonb,
  preferred_cuisines jsonb not null default '[]'::jsonb,
  budget_level text check (budget_level in ('low', 'medium', 'high')),
  meal_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- food_items (shared master data; written by service role / seed only)
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  brand text,
  barcode text,
  source text not null default 'seed' check (source in ('seed', 'usda', 'openfoodfacts', 'user', 'ai')),
  source_id text,
  verification_status text not null default 'unverified' check (verification_status in ('verified', 'semi_verified', 'unverified', 'user_reported')),
  serving_size numeric not null default 100,
  serving_unit text not null default 'g',
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  sugar_g numeric not null default 0,
  sodium_mg numeric not null default 0,
  micronutrients jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists food_items_source_unique
  on public.food_items (source, source_id) where source_id is not null;
create unique index if not exists food_items_barcode_unique
  on public.food_items (barcode) where barcode is not null;
create index if not exists food_items_normalized_name_trgm
  on public.food_items using gin (normalized_name gin_trgm_ops);
create index if not exists food_items_name_trgm
  on public.food_items using gin (name gin_trgm_ops);

-- food_aliases
create table if not exists public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.food_items (id) on delete cascade,
  alias text not null,
  locale text not null default 'en'
);

create index if not exists food_aliases_alias_trgm
  on public.food_aliases using gin (alias gin_trgm_ops);
create index if not exists food_aliases_food_id_idx
  on public.food_aliases (food_id);

-- food_sources (provenance)
create table if not exists public.food_sources (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.food_items (id) on delete cascade,
  provider text not null,
  external_id text not null,
  source_url text,
  source_version text,
  retrieved_at timestamptz not null default now()
);

create index if not exists food_sources_food_id_idx on public.food_sources (food_id);

-- user_foods (personal food memory)
create table if not exists public.user_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.food_items (id) on delete cascade,
  custom_name text,
  usual_quantity numeric,
  usual_unit text,
  usage_count integer not null default 0,
  last_used_at timestamptz,
  custom_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, food_id)
);

-- meals
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'custom')),
  logged_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- meal_items
create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.food_items (id) on delete set null,
  quantity numeric not null,
  unit text not null,
  nutrition_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists meal_items_meal_id_idx on public.meal_items (meal_id);

-- food_logs (immutable-ish history; nutrition snapshot frozen at log time)
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.food_items (id) on delete set null,
  meal_id uuid references public.meals (id) on delete set null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'custom')),
  logged_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'photo_ai', 'barcode', 'voice', 'text', 'saved_meal', 'recipe', 'search')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  nutrition_snapshot jsonb not null,
  ai_metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- recipes
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  servings numeric not null default 1 check (servings > 0),
  instructions text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- recipe_ingredients
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.food_items (id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  sort_order integer not null default 0
);

create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

-- weight_entries
create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  recorded_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual', 'import', 'onboarding')),
  notes text,
  created_at timestamptz not null default now()
);

-- ai_analyses
create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('food_image', 'text_parse', 'voice_parse', 'guidance', 'meal_plan', 'clarification')),
  input_storage_path text,
  model_provider text not null,
  model_name text not null,
  request_metadata jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  confidence numeric,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'timeout', 'rejected')),
  error_code text,
  tokens_input integer,
  tokens_output integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- ai_corrections (personal food model learning signal)
create table if not exists public.ai_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid references public.ai_analyses (id) on delete set null,
  field_name text not null,
  original_value jsonb,
  corrected_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_corrections_analysis_id_idx on public.ai_corrections (analysis_id);

-- notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  scheduled_for timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- user_settings
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notifications_enabled boolean not null default false,
  analytics_enabled boolean not null default false,
  ai_personalization_enabled boolean not null default true,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Required indexes (spec §24)
-- ============================================================
create index if not exists profiles_id_idx on public.profiles (id);
create index if not exists user_goals_user_id_idx on public.user_goals (user_id);
create index if not exists user_foods_user_id_idx on public.user_foods (user_id, last_used_at desc);
create index if not exists food_logs_user_id_idx on public.food_logs (user_id);
create index if not exists food_logs_logged_at_idx on public.food_logs (user_id, logged_at desc);
create index if not exists meals_user_id_idx on public.meals (user_id, logged_at desc);
create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists weight_entries_recorded_at_idx on public.weight_entries (user_id, recorded_at desc);
create index if not exists ai_analyses_user_id_idx on public.ai_analyses (user_id, created_at desc);
create index if not exists notifications_user_id_idx on public.notifications (user_id, scheduled_for desc);

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array['profiles','user_goals','dietary_preferences','food_items','user_foods','food_logs','recipes','user_settings']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ============================================================
-- Auth trigger: create profile on signup
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_goals enable row level security;
alter table public.dietary_preferences enable row level security;
alter table public.food_items enable row level security;
alter table public.food_aliases enable row level security;
alter table public.food_sources enable row level security;
alter table public.user_foods enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.food_logs enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.weight_entries enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.ai_corrections enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;

-- Helper: is this row's owner the current user?
do $$ begin
  -- ---------- profiles ----------
  drop policy if exists "profiles_select_own" on public.profiles;
  create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = id);
  drop policy if exists "profiles_insert_own" on public.profiles;
  create policy "profiles_insert_own" on public.profiles for insert with check ((select auth.uid()) = id);
  drop policy if exists "profiles_update_own" on public.profiles;
  create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

  -- ---------- user_goals ----------
  drop policy if exists "user_goals_select_own" on public.user_goals;
  create policy "user_goals_select_own" on public.user_goals for select using ((select auth.uid()) = user_id);
  drop policy if exists "user_goals_insert_own" on public.user_goals;
  create policy "user_goals_insert_own" on public.user_goals for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "user_goals_update_own" on public.user_goals;
  create policy "user_goals_update_own" on public.user_goals for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "user_goals_delete_own" on public.user_goals;
  create policy "user_goals_delete_own" on public.user_goals for delete using ((select auth.uid()) = user_id);

  -- ---------- dietary_preferences ----------
  drop policy if exists "dietary_preferences_select_own" on public.dietary_preferences;
  create policy "dietary_preferences_select_own" on public.dietary_preferences for select using ((select auth.uid()) = user_id);
  drop policy if exists "dietary_preferences_insert_own" on public.dietary_preferences;
  create policy "dietary_preferences_insert_own" on public.dietary_preferences for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "dietary_preferences_update_own" on public.dietary_preferences;
  create policy "dietary_preferences_update_own" on public.dietary_preferences for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "dietary_preferences_delete_own" on public.dietary_preferences;
  create policy "dietary_preferences_delete_own" on public.dietary_preferences for delete using ((select auth.uid()) = user_id);

  -- ---------- food_items / aliases / sources: read for signed-in users; writes only via service role (bypasses RLS) ----------
  drop policy if exists "food_items_select_authenticated" on public.food_items;
  create policy "food_items_select_authenticated" on public.food_items for select to authenticated using (true);
  drop policy if exists "food_aliases_select_authenticated" on public.food_aliases;
  create policy "food_aliases_select_authenticated" on public.food_aliases for select to authenticated using (true);
  drop policy if exists "food_sources_select_authenticated" on public.food_sources;
  create policy "food_sources_select_authenticated" on public.food_sources for select to authenticated using (true);

  -- ---------- user_foods ----------
  drop policy if exists "user_foods_select_own" on public.user_foods;
  create policy "user_foods_select_own" on public.user_foods for select using ((select auth.uid()) = user_id);
  drop policy if exists "user_foods_insert_own" on public.user_foods;
  create policy "user_foods_insert_own" on public.user_foods for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "user_foods_update_own" on public.user_foods;
  create policy "user_foods_update_own" on public.user_foods for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "user_foods_delete_own" on public.user_foods;
  create policy "user_foods_delete_own" on public.user_foods for delete using ((select auth.uid()) = user_id);

  -- ---------- meals ----------
  drop policy if exists "meals_select_own" on public.meals;
  create policy "meals_select_own" on public.meals for select using ((select auth.uid()) = user_id);
  drop policy if exists "meals_insert_own" on public.meals;
  create policy "meals_insert_own" on public.meals for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "meals_update_own" on public.meals;
  create policy "meals_update_own" on public.meals for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "meals_delete_own" on public.meals;
  create policy "meals_delete_own" on public.meals for delete using ((select auth.uid()) = user_id);

  -- ---------- meal_items (ownership via parent meal) ----------
  drop policy if exists "meal_items_select_own" on public.meal_items;
  create policy "meal_items_select_own" on public.meal_items for select using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())));
  drop policy if exists "meal_items_insert_own" on public.meal_items;
  create policy "meal_items_insert_own" on public.meal_items for insert with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())));
  drop policy if exists "meal_items_update_own" on public.meal_items;
  create policy "meal_items_update_own" on public.meal_items for update using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())));
  drop policy if exists "meal_items_delete_own" on public.meal_items;
  create policy "meal_items_delete_own" on public.meal_items for delete using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = (select auth.uid())));

  -- ---------- food_logs ----------
  drop policy if exists "food_logs_select_own" on public.food_logs;
  create policy "food_logs_select_own" on public.food_logs for select using ((select auth.uid()) = user_id);
  drop policy if exists "food_logs_insert_own" on public.food_logs;
  create policy "food_logs_insert_own" on public.food_logs for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "food_logs_update_own" on public.food_logs;
  create policy "food_logs_update_own" on public.food_logs for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "food_logs_delete_own" on public.food_logs;
  create policy "food_logs_delete_own" on public.food_logs for delete using ((select auth.uid()) = user_id);

  -- ---------- recipes ----------
  drop policy if exists "recipes_select_own" on public.recipes;
  create policy "recipes_select_own" on public.recipes for select using ((select auth.uid()) = user_id);
  drop policy if exists "recipes_insert_own" on public.recipes;
  create policy "recipes_insert_own" on public.recipes for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "recipes_update_own" on public.recipes;
  create policy "recipes_update_own" on public.recipes for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "recipes_delete_own" on public.recipes;
  create policy "recipes_delete_own" on public.recipes for delete using ((select auth.uid()) = user_id);

  -- ---------- recipe_ingredients (ownership via parent recipe) ----------
  drop policy if exists "recipe_ingredients_select_own" on public.recipe_ingredients;
  create policy "recipe_ingredients_select_own" on public.recipe_ingredients for select using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
  drop policy if exists "recipe_ingredients_insert_own" on public.recipe_ingredients;
  create policy "recipe_ingredients_insert_own" on public.recipe_ingredients for insert with check (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
  drop policy if exists "recipe_ingredients_update_own" on public.recipe_ingredients;
  create policy "recipe_ingredients_update_own" on public.recipe_ingredients for update using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));
  drop policy if exists "recipe_ingredients_delete_own" on public.recipe_ingredients;
  create policy "recipe_ingredients_delete_own" on public.recipe_ingredients for delete using (exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid())));

  -- ---------- weight_entries ----------
  drop policy if exists "weight_entries_select_own" on public.weight_entries;
  create policy "weight_entries_select_own" on public.weight_entries for select using ((select auth.uid()) = user_id);
  drop policy if exists "weight_entries_insert_own" on public.weight_entries;
  create policy "weight_entries_insert_own" on public.weight_entries for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "weight_entries_update_own" on public.weight_entries;
  create policy "weight_entries_update_own" on public.weight_entries for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "weight_entries_delete_own" on public.weight_entries;
  create policy "weight_entries_delete_own" on public.weight_entries for delete using ((select auth.uid()) = user_id);

  -- ---------- ai_analyses ----------
  drop policy if exists "ai_analyses_select_own" on public.ai_analyses;
  create policy "ai_analyses_select_own" on public.ai_analyses for select using ((select auth.uid()) = user_id);
  drop policy if exists "ai_analyses_insert_own" on public.ai_analyses;
  create policy "ai_analyses_insert_own" on public.ai_analyses for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "ai_analyses_update_own" on public.ai_analyses;
  create policy "ai_analyses_update_own" on public.ai_analyses for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  -- ---------- ai_corrections ----------
  drop policy if exists "ai_corrections_select_own" on public.ai_corrections;
  create policy "ai_corrections_select_own" on public.ai_corrections for select using ((select auth.uid()) = user_id);
  drop policy if exists "ai_corrections_insert_own" on public.ai_corrections;
  create policy "ai_corrections_insert_own" on public.ai_corrections for insert with check ((select auth.uid()) = user_id);

  -- ---------- notifications ----------
  drop policy if exists "notifications_select_own" on public.notifications;
  create policy "notifications_select_own" on public.notifications for select using ((select auth.uid()) = user_id);
  drop policy if exists "notifications_insert_own" on public.notifications;
  create policy "notifications_insert_own" on public.notifications for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "notifications_update_own" on public.notifications;
  create policy "notifications_update_own" on public.notifications for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  drop policy if exists "notifications_delete_own" on public.notifications;
  create policy "notifications_delete_own" on public.notifications for delete using ((select auth.uid()) = user_id);

  -- ---------- user_settings ----------
  drop policy if exists "user_settings_select_own" on public.user_settings;
  create policy "user_settings_select_own" on public.user_settings for select using ((select auth.uid()) = user_id);
  drop policy if exists "user_settings_insert_own" on public.user_settings;
  create policy "user_settings_insert_own" on public.user_settings for insert with check ((select auth.uid()) = user_id);
  drop policy if exists "user_settings_update_own" on public.user_settings;
  create policy "user_settings_update_own" on public.user_settings for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
end $$;

-- ============================================================
-- Storage: private bucket for food photos
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-images', 'food-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Objects must live under <user-id>/... and are only accessible to that user.
drop policy if exists "food_images_insert_own" on storage.objects;
create policy "food_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "food_images_select_own" on storage.objects;
create policy "food_images_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "food_images_update_own" on storage.objects;
create policy "food_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "food_images_delete_own" on storage.objects;
create policy "food_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'food-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
