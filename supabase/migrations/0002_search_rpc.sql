-- Food search RPC (spec §16): ranked search over food_items + aliases,
-- boosted by the user's personal food memory (user_foods).
-- Security invoker: RLS still applies (user_foods only returns own rows).

create or replace function public.search_foods(
  p_query text,
  p_user_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  normalized_name text,
  brand text,
  barcode text,
  source text,
  source_id text,
  verification_status text,
  serving_size numeric,
  serving_unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  micronutrients jsonb,
  metadata jsonb,
  score numeric
)
language sql
stable
set search_path = public
as $$
  with q as (
    select lower(btrim(p_query)) as s
  )
  select
    fi.id, fi.name, fi.normalized_name, fi.brand, fi.barcode,
    fi.source, fi.source_id, fi.verification_status,
    fi.serving_size, fi.serving_unit,
    fi.calories, fi.protein_g, fi.carbs_g, fi.fat_g,
    fi.fiber_g, fi.sugar_g, fi.sodium_mg, fi.micronutrients, fi.metadata,
    (
      -- text relevance
      case
        when fi.normalized_name = (select s from q) then 100
        when exists (
          select 1 from food_aliases a
          where a.food_id = fi.id and lower(a.alias) = (select s from q)
        ) then 85
        when fi.name ilike (select s from q) || '%' then 60
        when exists (
          select 1 from food_aliases a
          where a.food_id = fi.id and lower(a.alias) like (select s from q) || '%'
        ) then 55
        else coalesce(similarity(fi.name, (select s from q)), 0) * 40
           + coalesce(
               (select max(similarity(a.alias, (select s from q)))
                from food_aliases a where a.food_id = fi.id), 0) * 35
      end
      -- personal food memory boost (spec §16 ranking: recent/frequent first)
      + case when uf.last_used_at is not null then 12 else 0 end
      + least(coalesce(uf.usage_count, 0), 20) * 0.6
      -- verification boost
      + case fi.verification_status
          when 'verified' then 8
          when 'semi_verified' then 4
          when 'user_reported' then 1
          else 0
        end
    )::numeric as score
  from food_items fi
  left join user_foods uf
    on uf.food_id = fi.id and uf.user_id = p_user_id
  where (select s from q) <> ''
    -- private foods (user-entered / AI-created) are visible only to their owner
    and (
      fi.source not in ('user', 'ai')
      or coalesce(fi.metadata ->> 'owner_user_id', '') = coalesce(p_user_id::text, '')
    )
    and (
      fi.name ilike '%' || (select s from q) || '%'
      or fi.normalized_name % (select s from q)
      or fi.brand ilike '%' || (select s from q) || '%'
      or fi.barcode = (select s from q)
      or exists (
        select 1 from food_aliases a
        where a.food_id = fi.id
          and (a.alias ilike '%' || (select s from q) || '%'
               or a.alias % (select s from q))
      )
    )
  order by score desc, fi.name asc
  limit greatest(1, least(p_limit, 50));
$$;

-- Recent & frequent foods for the Log screen quick list.
create or replace function public.recent_foods(
  p_user_id uuid,
  p_limit integer default 10
)
returns table (
  id uuid,
  name text,
  normalized_name text,
  brand text,
  barcode text,
  source text,
  source_id text,
  verification_status text,
  serving_size numeric,
  serving_unit text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  micronutrients jsonb,
  metadata jsonb,
  usage_count integer,
  last_used_at timestamptz,
  custom_name text,
  usual_quantity numeric,
  usual_unit text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fi.id, fi.name, fi.normalized_name, fi.brand, fi.barcode,
    fi.source, fi.source_id, fi.verification_status,
    fi.serving_size, fi.serving_unit,
    fi.calories, fi.protein_g, fi.carbs_g, fi.fat_g,
    fi.fiber_g, fi.sugar_g, fi.sodium_mg, fi.micronutrients, fi.metadata,
    uf.usage_count, uf.last_used_at, uf.custom_name, uf.usual_quantity, uf.usual_unit
  from user_foods uf
  join food_items fi on fi.id = uf.food_id
  where uf.user_id = p_user_id
  order by uf.usage_count desc, uf.last_used_at desc nulls last
  limit greatest(1, least(p_limit, 50));
$$;
