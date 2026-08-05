create table public.waste_fee_catalog (
  rule_key text primary key,
  item_name text not null,
  aliases text[] not null default '{}',
  category text not null,
  fee integer check (fee is null or fee >= 0),
  size_label text,
  min_longest_side_cm integer check (min_longest_side_cm is null or min_longest_side_cm >= 1),
  max_longest_side_cm integer check (max_longest_side_cm is null or max_longest_side_cm >= 1),
  check (min_longest_side_cm is null or max_longest_side_cm is null or min_longest_side_cm <= max_longest_side_cm)
);

alter table public.waste_fee_catalog enable row level security;

insert into public.waste_fee_catalog (
  rule_key, item_name, aliases, category, fee, size_label, min_longest_side_cm, max_longest_side_cm
) values
  ('office-chair', '사무용 의자', array['사무용 의자', 'office chair', 'desk chair', 'swivel chair', 'computer chair', 'gaming chair'], 'furniture', 3000, '회전형', null, null),
  ('chair', '일반 의자', array['의자', 'chair', 'dining chair', 'wooden chair', 'plastic chair', 'stool'], 'furniture', 2000, '일반형', null, null),
  ('single-sofa', '1인용 소파', array['1인용 소파', 'armchair', 'single sofa', 'one seater sofa', '1 seater sofa'], 'furniture', 3000, '1인용', null, 120),
  ('sofa', '2~3인용 소파', array['소파', 'sofa', 'couch', 'loveseat', '2 seater sofa', '3 seater sofa'], 'furniture', 8000, '2~3인용', null, 220),
  ('large-sofa', '4인용 이상 소파', array['4인용 소파', '4 seater sofa', 'large sofa', 'sectional sofa'], 'furniture', 12000, '4인용 이상', 221, null),
  ('sofa-bed', '소파베드', array['소파베드', 'sofa bed', 'futon'], 'furniture', 8000, '일반형', null, null),
  ('storage-default', '수납장', array['수납장', 'cabinet', 'drawer', 'dresser', 'storage cabinet'], 'furniture', 7000, '중형', null, null),
  ('storage-small', '수납장', array['수납장', 'cabinet', 'drawer', 'dresser', 'storage cabinet'], 'furniture', 5000, '소형', null, 80),
  ('storage-medium', '수납장', array['수납장', 'cabinet', 'drawer', 'dresser', 'storage cabinet'], 'furniture', 7000, '중형', 81, 150),
  ('storage-large', '수납장', array['수납장', 'cabinet', 'drawer', 'dresser', 'storage cabinet'], 'furniture', 10000, '대형', 151, null),
  ('desk-default', '책상', array['책상', 'desk', 'study desk', 'writing desk'], 'furniture', 4000, '소형', null, null),
  ('desk-small', '책상', array['책상', 'desk', 'study desk', 'writing desk'], 'furniture', 4000, '소형', null, 120),
  ('desk-large', '책상', array['책상', 'desk', 'study desk', 'writing desk'], 'furniture', 7000, '대형', 121, null),
  ('mattress-default', '매트리스', array['매트리스', 'mattress'], 'bedding', 5000, '싱글', null, null),
  ('mattress-single', '매트리스', array['매트리스', 'mattress', 'single mattress', 'super single mattress'], 'bedding', 5000, '싱글', null, 120),
  ('mattress-large', '매트리스', array['매트리스', 'mattress', 'double mattress', 'queen mattress', 'king mattress'], 'bedding', 8000, '더블 이상', 121, null),
  ('table', '테이블', array['테이블', 'table', 'dining table', 'coffee table', 'side table'], 'furniture', null, null, null, null),
  ('bookshelf', '책장', array['책장', 'bookshelf', 'bookcase'], 'furniture', null, null, null, null),
  ('wardrobe', '옷장', array['옷장', 'wardrobe', 'closet', 'armoire'], 'furniture', null, null, null, null),
  ('bed', '침대', array['침대', 'bed', 'bed frame'], 'furniture', null, null, null, null)
on conflict (rule_key) do update set
  item_name = excluded.item_name,
  aliases = excluded.aliases,
  category = excluded.category,
  fee = excluded.fee,
  size_label = excluded.size_label,
  min_longest_side_cm = excluded.min_longest_side_cm,
  max_longest_side_cm = excluded.max_longest_side_cm;
