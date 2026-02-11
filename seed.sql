-- Create the table schema
CREATE TABLE IF NOT EXISTS slots (
  slot_number INTEGER PRIMARY KEY,
  price REAL,
  status TEXT DEFAULT 'available',
  owner_name TEXT, 
  owner_message TEXT, 
  owner_color TEXT, 
  owner_text TEXT,
  image_url TEXT,
  link_url TEXT,
  link_description TEXT,
  payment_id TEXT, 
  updated_at DATETIME
);

-- Note: We'll insert data programmatically due to size
