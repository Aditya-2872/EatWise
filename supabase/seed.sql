-- EatWise seed data: curated Indian + generic foods
-- Values are approximate per 100 g (edible portion) from public composition tables
-- (IFCT/USDA-style averages). Status: semi_verified. Household servings included
-- where unambiguous, used by the portion editor later.
--
-- Idempotent: deterministic ids (md5 of source_id), on-conflict skips.

-- ------------------------------------------------------------------
-- food_items
-- ------------------------------------------------------------------
with foods(source_id, name, category, hq, hu, hlabel, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg) as (
  values
    -- Staples (cooked)
    ('seed-rice-cooked',        'Rice (cooked, white)',        'staple',      150, 'g',  '1 katori',        130, 2.4, 28.2, 0.3, 0.4, 0.1, 1),
    ('seed-roti',               'Roti / Chapati',              'staple',      40,  'g',  '1 medium roti',   297, 7.9, 46.1, 7.5, 4.9, 1.0, 150),
    ('seed-paratha-plain',      'Paratha (plain)',             'staple',      70,  'g',  '1 paratha',       326, 6.4, 44.0, 13.5, 4.0, 1.2, 300),
    ('seed-aloo-paratha',       'Aloo Paratha',                'staple',      150, 'g',  '1 paratha',       240, 5.5, 33.0, 9.5, 3.8, 1.5, 380),
    ('seed-naan',               'Naan',                        'staple',      90,  'g',  '1 naan',          262, 8.6, 45.0, 5.1, 2.0, 3.0, 450),
    ('seed-idli',               'Idli',                        'staple',      40,  'g',  '1 idli',          149, 3.0, 30.0, 0.5, 1.2, 0.3, 220),
    ('seed-dosa-plain',         'Dosa (plain)',                'staple',      70,  'g',  '1 dosa',          171, 3.9, 29.0, 4.0, 1.1, 0.5, 250),
    ('seed-poha',               'Poha',                        'staple',      180, 'g',  '1 plate',         158, 2.6, 34.0, 1.4, 1.3, 1.0, 280),
    ('seed-upma',               'Upma',                        'staple',      150, 'g',  '1 bowl',          150, 3.5, 28.0, 2.8, 1.6, 1.0, 300),
    ('seed-bread-whole-wheat',  'Bread (whole wheat)',         'staple',      30,  'g',  '1 slice',         247, 13.0, 41.0, 3.4, 7.0, 6.0, 450),
    ('seed-bread-white',        'Bread (white)',               'staple',      30,  'g',  '1 slice',         265, 9.0, 49.0, 3.2, 2.7, 5.0, 490),
    ('seed-pasta-cooked',       'Pasta (cooked, plain)',       'staple',      200, 'g',  '1 bowl',          131, 5.0, 25.0, 1.1, 1.8, 0.6, 1),

    -- Dals & legumes (cooked)
    ('seed-dal-tadka',          'Dal Tadka',                   'dal',         150, 'g',  '1 katori',        110, 6.5, 17.0, 2.2, 4.5, 1.0, 280),
    ('seed-dal-fry',            'Dal Fry',                     'dal',         150, 'g',  '1 katori',        118, 6.8, 18.0, 2.8, 4.6, 1.0, 300),
    ('seed-dal-moong-cooked',   'Moong Dal (cooked)',          'dal',         150, 'g',  '1 katori',        105, 7.0, 18.0, 0.4, 4.2, 0.8, 250),
    ('seed-dal-masoor-cooked',  'Masoor Dal (cooked)',         'dal',         150, 'g',  '1 katori',        115, 8.0, 19.0, 0.4, 4.5, 0.9, 250),
    ('seed-chana-masala',       'Chana Masala / Chole',        'dal',         150, 'g',  '1 katori',        145, 6.5, 22.0, 3.5, 6.5, 2.5, 350),
    ('seed-rajma',              'Rajma (kidney bean curry)',   'dal',         150, 'g',  '1 katori',        121, 6.4, 20.0, 1.9, 5.5, 1.5, 320),
    ('seed-sambar',             'Sambar',                      'dal',         150, 'g',  '1 bowl',          62,  3.0, 9.0,  1.5, 2.0, 1.5, 300),

    -- Paneer dishes
    ('seed-paneer-plain',       'Paneer (plain)',              'protein',     50,  'g',  '1 cube portion',  296, 18.9, 3.5, 22.0, 0.0, 2.5, 70),
    ('seed-paneer-butter-masala','Paneer Butter Masala',       'main',        250, 'g',  '1 restaurant serving', 205, 9.0, 8.0, 15.0, 1.5, 4.0, 420),
    ('seed-palak-paneer',       'Palak Paneer',                'main',        250, 'g',  '1 serving',       140, 7.5, 6.0,  9.5, 1.8, 2.5, 380),
    ('seed-paneer-tikka',       'Paneer Tikka (dry)',          'protein',     120, 'g',  '1 skewer portion',190, 14.0, 6.0, 12.0, 1.2, 3.0, 450),

    -- Vegetable dishes
    ('seed-aloo-gobi',          'Aloo Gobi',                   'sabzi',       150, 'g',  '1 katori',        109, 2.6, 13.0, 5.0, 2.8, 2.5, 300),
    ('seed-bhindi-masala',      'Bhindi Masala',               'sabzi',       150, 'g',  '1 katori',        85,  2.0, 9.0,  4.5, 3.2, 2.0, 290),
    ('seed-mix-veg',            'Mixed Vegetable Sabzi',       'sabzi',       150, 'g',  '1 katori',        95,  2.5, 11.0, 4.8, 2.9, 3.0, 300),
    ('seed-baingan-bharta',     'Baingan Bharta',              'sabzi',       150, 'g',  '1 katori',        90,  1.8, 9.0,  5.5, 2.6, 4.0, 310),

    -- Non-veg mains
    ('seed-chicken-curry',      'Chicken Curry (homestyle)',   'main',        200, 'g',  '1 bowl',          160, 14.0, 4.0, 9.5, 0.8, 1.5, 420),
    ('seed-butter-chicken',     'Butter Chicken',              'main',        250, 'g',  '1 restaurant serving', 200, 12.0, 6.0, 14.0, 0.8, 3.5, 480),
    ('seed-chicken-tikka',      'Chicken Tikka',               'protein',     120, 'g',  '1 skewer portion',150, 21.0, 2.0, 6.5, 0.3, 1.0, 460),
    ('seed-tandoori-chicken',   'Tandoori Chicken',            'protein',     150, 'g',  '1 leg quarter',   190, 21.0, 1.5, 11.0, 0.2, 0.8, 520),
    ('seed-chicken-breast',     'Chicken Breast (cooked)',     'protein',     120, 'g',  '1 breast',        165, 31.0, 0.0, 3.6, 0.0, 0.0, 74),
    ('seed-chicken-biryani',    'Chicken Biryani',             'main',        300, 'g',  '1 plate',         185, 8.0, 25.0, 6.0, 1.0, 1.2, 430),
    ('seed-veg-biryani',        'Vegetable Biryani',           'main',        300, 'g',  '1 plate',         150, 4.0, 26.0, 4.0, 1.5, 1.8, 400),
    ('seed-fish-curry',         'Fish Curry',                  'main',        200, 'g',  '1 bowl',          115, 11.0, 3.0, 6.5, 0.5, 1.0, 390),
    ('seed-egg-curry',          'Egg Curry',                   'main',        200, 'g',  '1 bowl',          130, 7.0, 4.0, 9.5, 0.9, 1.8, 400),
    ('seed-egg-boiled',         'Boiled Egg',                  'protein',     50,  'g',  '1 egg',           156, 12.6, 1.1, 10.6, 0.0, 1.1, 124),
    ('seed-omelette',           'Omelette (2 eggs, cooked in oil)', 'protein', 110, 'g',  '1 omelette',      185, 12.0, 1.5, 14.0, 0.1, 1.0, 320),
    ('seed-egg-bhurji',         'Egg Bhurji',                  'protein',     130, 'g',  '1 serving',       165, 11.0, 2.0, 12.5, 0.5, 1.2, 350),

    -- Dairy & drinks
    ('seed-curd',               'Curd / Dahi (whole milk)',    'dairy',       100, 'g',  '1 small bowl',    97,  3.5, 4.7, 5.0, 0.0, 4.7, 45),
    ('seed-milk-whole',         'Milk (whole)',                'dairy',       200, 'ml', '1 glass',         61,  3.2, 4.8, 3.3, 0.0, 5.1, 43),
    ('seed-chaas',              'Chaas (spiced buttermilk)',   'dairy',       200, 'ml', '1 glass',         40,  2.0, 4.0, 1.0, 0.1, 4.0, 90),
    ('seed-lassi-sweet',        'Sweet Lassi',                 'dairy',       250, 'ml', '1 glass',         80,  3.0, 12.0, 2.2, 0.0, 12.0, 60),
    ('seed-cheese-processed',   'Cheese (processed slice)',    'dairy',       20,  'g',  '1 slice',         330, 17.0, 4.0, 26.0, 0.0, 3.5, 900),
    ('seed-ghee',               'Ghee',                        'fat',         5,   'g',  '1 tsp',           900, 0.0, 0.0, 99.9, 0.0, 0.0, 2),
    ('seed-butter',             'Butter',                      'fat',         5,   'g',  '1 tsp',           717, 0.9, 0.1, 81.0, 0.0, 0.1, 11),
    ('seed-chai',               'Chai (milk tea with sugar)',  'beverage',    150, 'ml', '1 cup',           47,  1.2, 7.5, 1.4, 0.0, 7.0, 25),
    ('seed-coffee-black',       'Black Coffee',                'beverage',    200, 'ml', '1 cup',           2,   0.1, 0.0, 0.0, 0.0, 0.0, 2),
    ('seed-cola',               'Cola (soft drink)',           'beverage',    300, 'ml', '1 can',           42,  0.0, 10.6, 0.0, 0.0, 10.6, 12),

    -- Snacks
    ('seed-samosa',             'Samosa (vegetable)',          'snack',       50,  'g',  '1 samosa',        262, 5.0, 28.0, 14.0, 3.0, 1.5, 350),
    ('seed-pakora',             'Vegetable Pakora (fried)',    'snack',       80,  'g',  '3 pakoras',       290, 6.0, 25.0, 18.0, 3.5, 2.0, 420),
    ('seed-vada-pav',           'Vada Pav',                    'snack',       150, 'g',  '1 vada pav',      193, 4.0, 30.0, 7.0, 2.2, 3.0, 480),
    ('seed-pav-bhaji',          'Pav Bhaji',                   'snack',       300, 'g',  '1 serving',       133, 3.0, 20.0, 5.0, 2.4, 4.5, 430),
    ('seed-peanuts-roasted',    'Peanuts (roasted)',           'snack',       30,  'g',  '1 handful',       585, 26.0, 16.0, 50.0, 9.0, 4.0, 6),
    ('seed-chips',              'Potato Chips (plain salted)', 'snack',       30,  'g',  '1 small pack',    536, 6.0, 50.0, 35.0, 4.5, 0.3, 500),
    ('seed-pizza-veg',          'Pizza (vegetable cheese)',    'snack',       110, 'g',  '1 slice',         266, 11.0, 33.0, 10.0, 2.3, 3.6, 580),
    ('seed-burger-veg',         'Veg Burger',                  'snack',       180, 'g',  '1 burger',        200, 5.0, 30.0, 6.0, 2.5, 5.0, 450),
    ('seed-french-fries',       'French Fries',                'snack',       110, 'g',  '1 medium serving',312, 3.4, 41.0, 15.0, 3.8, 0.3, 210),
    ('seed-dark-chocolate',     'Dark Chocolate (70%)',        'snack',       20,  'g',  '2 squares',       598, 7.8, 46.0, 43.0, 11.0, 24.0, 20),

    -- Fruits
    ('seed-apple',              'Apple',                       'fruit',       150, 'g',  '1 medium apple',  52,  0.3, 14.0, 0.2, 2.4, 10.4, 1),
    ('seed-banana',             'Banana',                      'fruit',       120, 'g',  '1 medium banana', 89,  1.1, 23.0, 0.3, 2.6, 12.0, 1),
    ('seed-orange',             'Orange',                      'fruit',       130, 'g',  '1 orange',        47,  0.9, 12.0, 0.1, 2.4, 9.0, 0),
    ('seed-mango',              'Mango',                       'fruit',       150, 'g',  '1 medium mango',  60,  0.8, 15.0, 0.4, 1.6, 14.0, 1),
    ('seed-papaya',             'Papaya',                      'fruit',       150, 'g',  '1 bowl cubed',    43,  0.5, 11.0, 0.3, 1.7, 8.0, 8),
    ('seed-guava',              'Guava',                       'fruit',       100, 'g',  '1 guava',         68,  2.6, 14.0, 1.0, 5.4, 9.0, 2),

    -- Vegetables
    ('seed-potato-boiled',      'Potato (boiled)',             'vegetable',   120, 'g',  '1 medium potato', 87,  1.9, 20.0, 0.1, 1.8, 0.9, 6),
    ('seed-tomato',             'Tomato',                      'vegetable',   100, 'g',  '1 tomato',        18,  0.9, 3.9,  0.2, 1.2, 2.6, 5),
    ('seed-onion',              'Onion',                       'vegetable',   80,  'g',  '1 medium onion',  40,  1.1, 9.3,  0.1, 1.7, 4.2, 4),
    ('seed-spinach-cooked',     'Spinach (cooked)',            'vegetable',   100, 'g',  '1 serving',       23,  3.0, 3.8,  0.3, 2.4, 0.4, 70),
    ('seed-cucumber',           'Cucumber',                    'vegetable',   80,  'g',  '1/2 cucumber',    15,  0.7, 3.6,  0.1, 0.5, 1.7, 2),
    ('seed-carrot',             'Carrot (raw)',                'vegetable',   60,  'g',  '1 carrot',        41,  0.9, 10.0, 0.2, 2.8, 4.7, 69),
    ('seed-green-peas',         'Green Peas (raw)',            'vegetable',   80,  'g',  '1 katori',        81,  5.4, 14.5, 0.4, 5.1, 5.7, 5),

    -- Breakfast & pantry (dry/raw)
    ('seed-oats-dry',           'Oats (dry, rolled)',          'breakfast',   40,  'g',  '1 portion',       389, 16.9, 66.0, 6.9, 10.6, 0.0, 2),
    ('seed-oats-porridge',      'Oats Porridge (cooked, water)','breakfast',  250, 'g',  '1 bowl',          71,  2.5, 12.0, 1.5, 1.7, 0.3, 3),
    ('seed-cornflakes',         'Cornflakes',                  'breakfast',   30,  'g',  '1 bowl',          357, 7.0, 84.0, 0.4, 3.0, 8.0, 700),
    ('seed-peanut-butter',      'Peanut Butter',               'fat',         16,  'g',  '1 tbsp',          588, 25.0, 20.0, 50.0, 6.0, 9.0, 17),
    ('seed-almonds',            'Almonds',                     'nuts',        28,  'g',  '8-10 almonds',    579, 21.0, 22.0, 50.0, 12.5, 4.4, 1),
    ('seed-walnuts',            'Walnuts',                     'nuts',        28,  'g',  '6 halves',        654, 15.0, 14.0, 65.0, 7.0, 2.6, 2),
    ('seed-atta',               'Atta (whole wheat flour)',    'pantry',      30,  'g',  '1 roti worth',    340, 12.0, 72.0, 1.7, 11.0, 0.4, 2),
    ('seed-rice-raw',           'Rice (raw)',                  'pantry',      60,  'g',  '1 portion raw',   360, 7.0, 80.0, 0.6, 1.3, 0.1, 1),
    ('seed-toor-dal-raw',       'Toor Dal (raw)',              'pantry',      60,  'g',  '1 portion raw',   343, 22.0, 60.0, 1.5, 11.0, 3.0, 3),
    ('seed-besan',              'Besan (gram flour)',          'pantry',      40,  'g',  '1 portion',       387, 22.0, 58.0, 6.7, 10.0, 10.0, 20),
    ('seed-sugar',              'Sugar',                       'pantry',      6,   'g',  '1 tsp',           387, 0.0, 100.0, 0.0, 0.0, 100.0, 0),
    ('seed-vegetable-oil',      'Vegetable Oil',               'fat',         5,   'g',  '1 tsp',           884, 0.0, 0.0, 100.0, 0.0, 0.0, 0)
)
insert into public.food_items
  (id, name, normalized_name, source, source_id, verification_status,
   serving_size, serving_unit, calories, protein_g, carbs_g, fat_g,
   fiber_g, sugar_g, sodium_mg, metadata)
select
  md5('eatwise:' || f.source_id)::uuid,
  f.name,
  lower(f.name),
  'seed',
  f.source_id,
  'semi_verified',
  100,
  'g',
  f.calories, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g, f.sugar_g, f.sodium_mg,
  jsonb_strip_nulls(jsonb_build_object(
    'category', f.category,
    'household_serving', case
      when f.hlabel is not null
      then jsonb_build_object('quantity', f.hq, 'unit', f.hu, 'label', f.hlabel)
      else null
    end
  ))
from foods f
on conflict (source, source_id) do nothing;

-- ------------------------------------------------------------------
-- food_aliases (regional names, spellings, Hindi/Hinglish variants)
-- ------------------------------------------------------------------
delete from public.food_aliases
where food_id in (select id from public.food_items where source = 'seed');

insert into public.food_aliases (food_id, alias, locale)
values
  (md5('eatwise:seed-roti')::uuid, 'chapati', 'en'),
  (md5('eatwise:seed-roti')::uuid, 'chappati', 'en'),
  (md5('eatwise:seed-roti')::uuid, 'phulka', 'en'),
  (md5('eatwise:seed-roti')::uuid, 'roti', 'en'),
  (md5('eatwise:seed-rice-cooked')::uuid, 'steamed rice', 'en'),
  (md5('eatwise:seed-rice-cooked')::uuid, 'white rice', 'en'),
  (md5('eatwise:seed-rice-cooked')::uuid, 'plain rice', 'en'),
  (md5('eatwise:seed-dal-tadka')::uuid, 'dal', 'en'),
  (md5('eatwise:seed-dal-tadka')::uuid, 'yellow dal', 'en'),
  (md5('eatwise:seed-dal-tadka')::uuid, 'arhar dal', 'en'),
  (md5('eatwise:seed-dal-tadka')::uuid, 'toor dal tadka', 'en'),
  (md5('eatwise:seed-dal-fry')::uuid, 'dal fry', 'en'),
  (md5('eatwise:seed-chana-masala')::uuid, 'chole', 'en'),
  (md5('eatwise:seed-chana-masala')::uuid, 'chickpea curry', 'en'),
  (md5('eatwise:seed-curd')::uuid, 'dahi', 'en'),
  (md5('eatwise:seed-curd')::uuid, 'yogurt', 'en'),
  (md5('eatwise:seed-curd')::uuid, 'yoghurt', 'en'),
  (md5('eatwise:seed-chaas')::uuid, 'buttermilk', 'en'),
  (md5('eatwise:seed-chaas')::uuid, 'mattha', 'en'),
  (md5('eatwise:seed-chai')::uuid, 'tea', 'en'),
  (md5('eatwise:seed-chai')::uuid, 'milk tea', 'en'),
  (md5('eatwise:seed-chai')::uuid, 'masala chai', 'en'),
  (md5('eatwise:seed-egg-boiled')::uuid, 'boiled anda', 'en'),
  (md5('eatwise:seed-egg-boiled')::uuid, 'egg', 'en'),
  (md5('eatwise:seed-paneer-plain')::uuid, 'cottage cheese', 'en'),
  (md5('eatwise:seed-paneer-plain')::uuid, 'indian cottage cheese', 'en'),
  (md5('eatwise:seed-paneer-butter-masala')::uuid, 'paneer makhani', 'en'),
  (md5('eatwise:seed-butter-chicken')::uuid, 'murgh makhani', 'en'),
  (md5('eatwise:seed-idli')::uuid, 'iddli', 'en'),
  (md5('eatwise:seed-dosa-plain')::uuid, 'dosai', 'en'),
  (md5('eatwise:seed-poha')::uuid, 'flattened rice', 'en'),
  (md5('eatwise:seed-aloo-paratha')::uuid, 'potato paratha', 'en'),
  (md5('eatwise:seed-bhindi-masala')::uuid, 'okra masala', 'en'),
  (md5('eatwise:seed-bhindi-masala')::uuid, 'bhindi', 'en'),
  (md5('eatwise:seed-baingan-bharta')::uuid, 'mashed brinjal', 'en'),
  (md5('eatwise:seed-baingan-bharta')::uuid, 'eggplant bharta', 'en'),
  (md5('eatwise:seed-aloo-gobi')::uuid, 'potato cauliflower sabzi', 'en'),
  (md5('eatwise:seed-vada-pav')::uuid, 'vadapav', 'en'),
  (md5('eatwise:seed-peanuts-roasted')::uuid, 'mungfali', 'en'),
  (md5('eatwise:seed-oats-dry')::uuid, 'oatmeal dry', 'en'),
  (md5('eatwise:seed-atta')::uuid, 'whole wheat flour', 'en'),
  (md5('eatwise:seed-besan')::uuid, 'gram flour', 'en'),
  (md5('eatwise:seed-besan')::uuid, 'chickpea flour', 'en'),
  (md5('eatwise:seed-toor-dal-raw')::uuid, 'arhar dal raw', 'en'),
  (md5('eatwise:seed-toor-dal-raw')::uuid, 'pigeon pea', 'en');
