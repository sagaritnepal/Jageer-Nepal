-- Seeds the admin-managed catalog (0015_product_catalog.sql) with ~100
-- electronics catalog templates so wholesalers/resellers have something to
-- stock immediately. Real product names/models (standard for any e-commerce
-- catalog), original descriptions, no price (price is always seller-specific,
-- set when a wholesaler/reseller stocks an item) and no photos (admin can add
-- image_url later per item via the Catalog tab).
-- Additive only. Safe to run once against the existing schema.

insert into catalog_products (name, description, category) values
  -- Mobile Phones
  ('Samsung Galaxy A54 5G', '8GB RAM, 128GB storage, 5000mAh battery, 50MP triple camera', 'Mobile Phones'),
  ('iPhone 13', '128GB, A15 Bionic chip, dual 12MP camera system', 'Mobile Phones'),
  ('Xiaomi Redmi Note 13', '6GB RAM, 128GB storage, 108MP camera, 5000mAh battery', 'Mobile Phones'),
  ('Samsung Galaxy S23', '8GB RAM, 256GB storage, Snapdragon 8 Gen 2, 50MP camera', 'Mobile Phones'),
  ('Realme C55', '6GB RAM, 128GB storage, 5000mAh battery, 64MP camera', 'Mobile Phones'),
  ('Vivo Y36', '8GB RAM, 128GB storage, 44MP selfie camera, 5000mAh battery', 'Mobile Phones'),
  ('Oppo A78', '8GB RAM, 128GB storage, 5000mAh battery, 67W fast charging', 'Mobile Phones'),
  ('iPhone 15', '128GB, A16 Bionic chip, USB-C, 48MP main camera', 'Mobile Phones'),
  ('OnePlus Nord CE 3', '8GB RAM, 128GB storage, 100W fast charging', 'Mobile Phones'),
  ('Redmi 13C', '4GB RAM, 128GB storage, 90Hz display, budget-friendly', 'Mobile Phones'),

  -- Laptops & Computers
  ('Dell Inspiron 15 3000', 'Intel Core i5, 8GB RAM, 512GB SSD, 15.6-inch display', 'Laptops & Computers'),
  ('HP Pavilion 14', 'Intel Core i5, 8GB RAM, 256GB SSD, touchscreen', 'Laptops & Computers'),
  ('Lenovo IdeaPad Slim 3', 'AMD Ryzen 5, 8GB RAM, 512GB SSD', 'Laptops & Computers'),
  ('ASUS VivoBook 15', 'Intel Core i3, 8GB RAM, 512GB SSD', 'Laptops & Computers'),
  ('MacBook Air M2', '8GB unified memory, 256GB SSD, 13.6-inch Liquid Retina', 'Laptops & Computers'),
  ('Acer Aspire 5', 'Intel Core i5, 16GB RAM, 512GB SSD', 'Laptops & Computers'),
  ('HP Desktop Tower PC', 'Intel Core i5, 8GB RAM, 1TB HDD', 'Laptops & Computers'),
  ('Dell OptiPlex Desktop', 'Intel Core i5, 8GB RAM, 256GB SSD', 'Laptops & Computers'),
  ('Lenovo ThinkPad E14', 'Intel Core i7, 16GB RAM, 512GB SSD, business laptop', 'Laptops & Computers'),
  ('ASUS ROG Strix Gaming Laptop', 'Intel Core i7, RTX 4060, 16GB RAM, 512GB SSD', 'Laptops & Computers'),

  -- Televisions
  ('Samsung 43" Crystal UHD 4K Smart TV', '4K resolution, HDR, built-in smart apps', 'Televisions'),
  ('LG 55" OLED 4K Smart TV', 'Self-lit OLED pixels, webOS smart platform', 'Televisions'),
  ('Sony Bravia 50" 4K Google TV', '4K HDR, Google TV, built-in Chromecast', 'Televisions'),
  ('Xiaomi 43" Smart TV', '4K resolution, Android TV, Dolby Audio', 'Televisions'),
  ('TCL 32" HD Smart TV', 'HD resolution, built-in WiFi, HDMI/USB ports', 'Televisions'),
  ('Samsung 65" QLED 4K TV', 'Quantum Dot technology, HDR10+, smart hub', 'Televisions'),
  ('Walton 32" LED TV', 'HD LED panel, multiple HDMI/USB ports', 'Televisions'),
  ('LG 43" Full HD Smart TV', 'Full HD resolution, webOS, screen mirroring', 'Televisions'),
  ('Haier 40" Full HD LED TV', 'Full HD LED panel, built-in speakers', 'Televisions'),
  ('Vision Plus 55" 4K Android TV', '4K UHD, Android TV, voice remote', 'Televisions'),

  -- Audio
  ('JBL Flip 6 Bluetooth Speaker', 'Portable waterproof speaker, 12-hour battery', 'Audio'),
  ('Sony WH-1000XM5 Headphones', 'Wireless noise-cancelling over-ear headphones', 'Audio'),
  ('boAt Rockerz 450 Headphones', 'Wireless on-ear headphones, 15-hour playback', 'Audio'),
  ('JBL Tune 230NC Earbuds', 'True wireless earbuds with active noise cancellation', 'Audio'),
  ('Marshall Emberton II Speaker', 'Portable Bluetooth speaker, iconic design', 'Audio'),
  ('Sony SRS-XB13 Speaker', 'Compact extra-bass portable speaker', 'Audio'),
  ('Apple AirPods Pro (2nd Gen)', 'Active noise cancellation, spatial audio', 'Audio'),
  ('Samsung Galaxy Buds2 Pro', 'True wireless earbuds, intelligent ANC', 'Audio'),
  ('Home Theater 5.1 System', 'Surround sound system with subwoofer', 'Audio'),
  ('2.1 Channel Soundbar', 'Soundbar with wireless subwoofer', 'Audio'),

  -- Home Appliances
  ('LG 7kg Front Load Washing Machine', 'Front load, multiple wash programs, inverter motor', 'Home Appliances'),
  ('Samsung 253L Double Door Refrigerator', 'Frost-free, double door, digital inverter', 'Home Appliances'),
  ('Panasonic Microwave Oven 23L', 'Solo microwave, multiple power levels', 'Home Appliances'),
  ('Philips Air Fryer 4.1L', 'Rapid air technology, digital display', 'Home Appliances'),
  ('Havells Room Heater', 'Fan heater with adjustable thermostat', 'Home Appliances'),
  ('Bajaj Mixer Grinder 750W', '3-jar mixer grinder, powerful motor', 'Home Appliances'),
  ('Prestige Induction Cooktop', 'Digital induction cooktop, multiple presets', 'Home Appliances'),
  ('Kent Water Purifier RO+UV', 'RO+UV+UF purification, storage tank', 'Home Appliances'),
  ('Usha Ceiling Fan', 'High-speed ceiling fan, energy efficient', 'Home Appliances'),
  ('Butterfly Electric Kettle 1.5L', 'Auto shut-off, stainless steel body', 'Home Appliances'),

  -- Networking
  ('TP-Link Archer C6 Router', 'AC1200 dual-band WiFi router', 'Networking'),
  ('TP-Link Deco Mesh WiFi (3-Pack)', 'Whole-home mesh WiFi system', 'Networking'),
  ('D-Link 8-Port Gigabit Switch', 'Unmanaged gigabit ethernet switch', 'Networking'),
  ('Netgear Nighthawk AX6000 Router', 'WiFi 6 router, high-speed dual-band', 'Networking'),
  ('TP-Link WiFi Range Extender', 'Extends WiFi coverage, easy setup', 'Networking'),
  ('Ethernet Cable Cat6 (50m)', 'High-speed gigabit-rated cable roll', 'Networking'),
  ('TP-Link 4G LTE WiFi Router', 'SIM-based portable 4G router', 'Networking'),
  ('MikroTik hAP ac2 Router', 'Dual-band gigabit router, advanced configuration', 'Networking'),
  ('Ubiquiti UniFi Access Point', 'Enterprise-grade WiFi access point', 'Networking'),
  ('USB WiFi Adapter AC600', 'Dual-band USB wireless adapter', 'Networking'),

  -- Cameras
  ('Canon EOS 1500D DSLR Kit', 'DSLR with 18-55mm lens, 24.1MP sensor', 'Cameras'),
  ('GoPro HERO12 Black', 'Waterproof action camera, 5.3K video', 'Cameras'),
  ('Nikon D3500 DSLR Kit', 'Entry-level DSLR with 18-55mm lens', 'Cameras'),
  ('CCTV Bullet Camera 2MP', 'Full HD outdoor bullet camera, night vision', 'Cameras'),
  ('CCTV Dome Camera 4MP', 'Indoor dome camera with night vision', 'Cameras'),
  ('4-Channel CCTV DVR Kit', 'DVR with 4 cameras, cables, and power supply', 'Cameras'),
  ('Video Doorbell Camera', 'WiFi video doorbell with motion alerts', 'Cameras'),
  ('Sony Alpha a6000 Mirrorless', 'Mirrorless camera, 24.3MP APS-C sensor', 'Cameras'),
  ('Instax Mini 12 Instant Camera', 'Instant film camera, automatic exposure', 'Cameras'),
  ('1080p Webcam with Microphone', 'Full HD webcam with built-in mic', 'Cameras'),

  -- Gaming
  ('Sony PlayStation 5 Console', 'Next-gen gaming console, 825GB SSD', 'Gaming'),
  ('Xbox Series S Console', 'All-digital next-gen console, 512GB', 'Gaming'),
  ('Nintendo Switch OLED', 'Handheld/docked hybrid console, OLED screen', 'Gaming'),
  ('PS5 DualSense Controller', 'Wireless controller with haptic feedback', 'Gaming'),
  ('Logitech G502 Gaming Mouse', 'Wired gaming mouse, adjustable weights', 'Gaming'),
  ('Razer BlackWidow Keyboard', 'Mechanical gaming keyboard, RGB backlit', 'Gaming'),
  ('Gaming Headset Surround Sound', 'Over-ear gaming headset with mic', 'Gaming'),
  ('Ergonomic Gaming Chair', 'Adjustable gaming chair with lumbar support', 'Gaming'),
  ('24" Gaming Monitor 144Hz', 'Full HD, 144Hz refresh rate, 1ms response', 'Gaming'),
  ('Xbox Wireless Controller', 'Standard wireless controller for Xbox/PC', 'Gaming'),

  -- Accessories
  ('Anker PowerCore 20000mAh', 'High-capacity portable power bank', 'Accessories'),
  ('USB-C Fast Charger 65W', 'GaN fast charger for laptops and phones', 'Accessories'),
  ('Type-C to Type-C Cable 1m', 'Fast charging and data transfer cable', 'Accessories'),
  ('Wireless Charging Pad 15W', 'Qi-certified fast wireless charger', 'Accessories'),
  ('Water Resistant Laptop Backpack', 'Padded compartment, multiple pockets', 'Accessories'),
  ('Phone Tripod with Remote', 'Adjustable tripod with Bluetooth remote', 'Accessories'),
  ('Tempered Glass Screen Protector', 'Universal-fit scratch-resistant protector', 'Accessories'),
  ('Car Phone Mount Holder', 'Dashboard/vent mount, adjustable grip', 'Accessories'),
  ('4-in-1 USB Hub', 'Multi-port USB hub for laptops', 'Accessories'),
  ('Bluetooth FM Transmitter', 'Car FM transmitter with USB charging', 'Accessories'),

  -- Smart Home
  ('Mi Smart WiFi LED Bulb', 'Color-changing smart bulb, app controlled', 'Smart Home'),
  ('Smart Plug WiFi Enabled', 'Remote-controlled smart power plug', 'Smart Home'),
  ('Smart Door Lock Fingerprint + PIN', 'Keyless entry with app control', 'Smart Home'),
  ('Video Intercom Smart Doorbell', 'Two-way audio, motion detection', 'Smart Home'),
  ('Smart Switch Board 4-Gang WiFi', 'WiFi-enabled wall switch panel', 'Smart Home'),
  ('Google Nest Mini', 'Smart speaker with Google Assistant', 'Smart Home'),
  ('Amazon Echo Dot (5th Gen)', 'Smart speaker with Alexa', 'Smart Home'),
  ('Smart CCTV Camera WiFi Pan-Tilt', 'Indoor WiFi camera with pan-tilt control', 'Smart Home'),
  ('Smart Curtain Motor WiFi', 'App and voice-controlled curtain motor', 'Smart Home'),
  ('Smart Power Strip with USB', 'WiFi power strip with individual outlet control', 'Smart Home')
on conflict (name) do nothing;
