CREATE TABLE IF NOT EXISTS shopeefood_categories (
  listing_id text PRIMARY KEY,
  name_th text NOT NULL,
  section_th text NOT NULL,
  display_order integer NOT NULL CHECK (display_order > 0),
  source_url text NOT NULL
);

CREATE TABLE IF NOT EXISTS shopeefood_menu_categories (
  menu_id text PRIMARY KEY REFERENCES menus(id) ON DELETE CASCADE,
  listing_id text NOT NULL REFERENCES shopeefood_categories(listing_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS shopeefood_menu_categories_listing
  ON shopeefood_menu_categories(listing_id);

DO $$ BEGIN
  ALTER TABLE shopeefood_categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE shopeefood_menu_categories ENABLE ROW LEVEL SECURITY;
END $$;
