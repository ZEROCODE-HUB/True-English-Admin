ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_date date,
  ADD COLUMN IF NOT EXISTS streak_best integer NOT NULL DEFAULT 0;