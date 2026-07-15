-- Enriches the 100 electronics catalog items seeded in
-- 0018_seed_electronics_catalog.sql with full, detailed specifications
-- (display, processor, storage, camera, battery, etc. per item) instead of
-- one-line summaries. Matched and updated by name - does not insert
-- duplicates, since these are the same 100 catalog templates.
-- Additive only. Safe to run once against the existing schema.

update catalog_products as cp set
  description = v.description,
  updated_at = now()
from (values
  -- Mobile Phones
  ('Samsung Galaxy A54 5G', 'Display: 6.4" Super AMOLED, 120Hz | Processor: Exynos 1380 | RAM/Storage: 8GB/128GB | Rear Camera: 50MP+12MP+5MP | Front: 32MP | Battery: 5000mAh, 25W fast charging | OS: Android 13, One UI 5.1 | Build: IP67 water resistant, Gorilla Glass 5'),
  ('iPhone 13', 'Display: 6.1" Super Retina XDR OLED | Chip: A15 Bionic | Storage: 128GB | Rear Camera: Dual 12MP (wide + ultrawide) | Front: 12MP TrueDepth | Battery: Up to 19hrs video playback | OS: iOS 17 | Build: Ceramic Shield, IP68'),
  ('Xiaomi Redmi Note 13', 'Display: 6.67" AMOLED, 120Hz | Processor: Snapdragon 685 | RAM/Storage: 6GB/128GB | Rear Camera: 108MP+8MP+2MP | Front: 16MP | Battery: 5000mAh, 33W fast charging | OS: Android 13, MIUI 14'),
  ('Samsung Galaxy S23', 'Display: 6.1" Dynamic AMOLED 2X, 120Hz | Processor: Snapdragon 8 Gen 2 | RAM/Storage: 8GB/256GB | Rear Camera: 50MP+10MP+12MP | Front: 12MP | Battery: 3900mAh, 25W fast charging | OS: Android 13, One UI 5.1'),
  ('Realme C55', 'Display: 6.72" IPS LCD, 90Hz | Processor: MediaTek Helio G88 | RAM/Storage: 6GB/128GB | Rear Camera: 64MP+2MP | Front: 8MP | Battery: 5000mAh, 33W fast charging | OS: Android 13, Realme UI 4.0'),
  ('Vivo Y36', 'Display: 6.64" IPS LCD, 90Hz | Processor: Snapdragon 680 | RAM/Storage: 8GB/128GB | Rear Camera: 50MP+2MP | Front: 16MP | Battery: 5000mAh, 44W fast charging | OS: Android 13, Funtouch OS 13'),
  ('Oppo A78', 'Display: 6.56" IPS LCD, 90Hz | Processor: Snapdragon 680 | RAM/Storage: 8GB/128GB | Rear Camera: 50MP+2MP | Front: 8MP | Battery: 5000mAh, 67W SuperVOOC charging | OS: Android 13, ColorOS 13.1'),
  ('iPhone 15', 'Display: 6.1" Super Retina XDR OLED | Chip: A16 Bionic | Storage: 128GB | Rear Camera: Dual 48MP+12MP | Front: 12MP | Battery: Up to 20hrs video playback | Port: USB-C | OS: iOS 17 | Build: Color-infused glass and aluminum'),
  ('OnePlus Nord CE 3', 'Display: 6.7" AMOLED, 120Hz | Processor: Snapdragon 782G | RAM/Storage: 8GB/128GB | Rear Camera: 100MP+8MP+2MP | Front: 16MP | Battery: 5000mAh, 100W SuperVOOC charging | OS: Android 13, OxygenOS 13.1'),
  ('Redmi 13C', 'Display: 6.74" IPS LCD, 90Hz | Processor: MediaTek Helio G85 | RAM/Storage: 4GB/128GB | Rear Camera: 50MP+2MP | Front: 8MP | Battery: 5000mAh, 18W fast charging | OS: Android 13, MIUI 14'),

  -- Laptops & Computers
  ('Dell Inspiron 15 3000', 'Processor: Intel Core i5-1235U | RAM: 8GB DDR4 | Storage: 512GB SSD | Display: 15.6" FHD | Graphics: Intel UHD | OS: Windows 11 Home | Battery: Up to 8 hours | Ports: USB-A, USB-C, HDMI'),
  ('HP Pavilion 14', 'Processor: Intel Core i5-1335U | RAM: 8GB DDR4 | Storage: 256GB SSD | Display: 14" FHD touchscreen | Graphics: Intel Iris Xe | OS: Windows 11 Home | Battery: Up to 10 hours'),
  ('Lenovo IdeaPad Slim 3', 'Processor: AMD Ryzen 5 7530U | RAM: 8GB DDR4 | Storage: 512GB SSD | Display: 15.6" FHD | Graphics: AMD Radeon | OS: Windows 11 Home | Battery: Up to 9 hours'),
  ('ASUS VivoBook 15', 'Processor: Intel Core i3-1215U | RAM: 8GB DDR4 | Storage: 512GB SSD | Display: 15.6" FHD | Graphics: Intel UHD | OS: Windows 11 Home | Weight: 1.7kg'),
  ('MacBook Air M2', 'Chip: Apple M2, 8-core CPU / 8-core GPU | RAM: 8GB unified memory | Storage: 256GB SSD | Display: 13.6" Liquid Retina | Battery: Up to 18 hours | OS: macOS | Build: Fanless aluminum design'),
  ('Acer Aspire 5', 'Processor: Intel Core i5-1235U | RAM: 16GB DDR4 | Storage: 512GB SSD | Display: 15.6" FHD IPS | Graphics: Intel Iris Xe | OS: Windows 11 Home'),
  ('HP Desktop Tower PC', 'Processor: Intel Core i5-12400 | RAM: 8GB DDR4 | Storage: 1TB HDD | Graphics: Intel UHD 730 | OS: Windows 11 Home | Ports: 6x USB, HDMI, VGA'),
  ('Dell OptiPlex Desktop', 'Processor: Intel Core i5-12500 | RAM: 8GB DDR4 | Storage: 256GB SSD | Graphics: Intel UHD 770 | OS: Windows 11 Pro | Form Factor: Small form factor'),
  ('Lenovo ThinkPad E14', 'Processor: Intel Core i7-1355U | RAM: 16GB DDR4 | Storage: 512GB SSD | Display: 14" FHD IPS | Graphics: Intel Iris Xe | OS: Windows 11 Pro | Security: Fingerprint reader, TPM 2.0'),
  ('ASUS ROG Strix Gaming Laptop', 'Processor: Intel Core i7-13650HX | Graphics: NVIDIA RTX 4060 8GB | RAM: 16GB DDR5 | Storage: 512GB SSD | Display: 15.6" FHD 144Hz | OS: Windows 11 Home'),

  -- Televisions
  ('Samsung 43" Crystal UHD 4K Smart TV', 'Resolution: 4K UHD (3840x2160) | Panel: Crystal Display | HDR: HDR10+ | Smart Platform: Tizen OS | Ports: 3x HDMI, 2x USB | Audio: 20W, 2-channel'),
  ('LG 55" OLED 4K Smart TV', 'Resolution: 4K UHD | Panel: Self-lit OLED | HDR: Dolby Vision, HDR10 | Smart Platform: webOS 23 | Ports: 4x HDMI (eARC), 2x USB | Audio: 20W with AI Sound Pro'),
  ('Sony Bravia 50" 4K Google TV', 'Resolution: 4K UHD | Processor: X1 4K Processor | HDR: Dolby Vision, HDR10 | Smart Platform: Google TV, built-in Chromecast | Ports: 3x HDMI, 2x USB'),
  ('Xiaomi 43" Smart TV', 'Resolution: 4K UHD | HDR: HDR10 | Smart Platform: Android TV 11 | Audio: Dolby Audio, DTS-HD | Ports: 3x HDMI, 2x USB'),
  ('TCL 32" HD Smart TV', 'Resolution: HD Ready (1366x768) | Smart Platform: Built-in WiFi, app support | Ports: 2x HDMI, 1x USB | Audio: 16W speakers'),
  ('Samsung 65" QLED 4K TV', 'Resolution: 4K UHD | Panel: Quantum Dot QLED | HDR: HDR10+ | Smart Platform: Tizen OS, Smart Hub | Ports: 4x HDMI, 2x USB | Audio: Object Tracking Sound Lite'),
  ('Walton 32" LED TV', 'Resolution: HD (1366x768) | Panel: LED | Ports: 2x HDMI, 2x USB | Audio: Built-in stereo speakers'),
  ('LG 43" Full HD Smart TV', 'Resolution: Full HD (1920x1080) | Smart Platform: webOS | Features: Screen mirroring, AI ThinQ | Ports: 2x HDMI, 1x USB'),
  ('Haier 40" Full HD LED TV', 'Resolution: Full HD | Panel: LED | Audio: Built-in speakers | Ports: 2x HDMI, 2x USB'),
  ('Vision Plus 55" 4K Android TV', 'Resolution: 4K UHD | Smart Platform: Android TV, Google Assistant | Remote: Voice remote included | Ports: 3x HDMI, 2x USB'),

  -- Audio
  ('JBL Flip 6 Bluetooth Speaker', 'Output: 30W | Battery: Up to 12 hours | Waterproof: IP67 | Connectivity: Bluetooth 5.1 | Features: PartyBoost pairing'),
  ('Sony WH-1000XM5 Headphones', 'Type: Over-ear, wireless | Noise Cancelling: Industry-leading ANC | Battery: Up to 30 hours | Connectivity: Bluetooth 5.2, multipoint | Features: Speak-to-chat, touch controls'),
  ('boAt Rockerz 450 Headphones', 'Type: On-ear, wireless | Battery: Up to 15 hours playback | Driver: 40mm | Connectivity: Bluetooth 5.0 | Features: Foldable design'),
  ('JBL Tune 230NC Earbuds', 'Type: True wireless in-ear | Noise Cancelling: Active NC | Battery: 8hrs (buds) + 32hrs (case) | Connectivity: Bluetooth 5.2'),
  ('Marshall Emberton II Speaker', 'Output: Portable stereo | Battery: Up to 30 hours | Waterproof: IP67 | Connectivity: Bluetooth 5.1 | Features: Multi-directional sound'),
  ('Sony SRS-XB13 Speaker', 'Output: Extra Bass | Battery: Up to 16 hours | Waterproof: IP67 | Connectivity: Bluetooth 5.0 | Features: Compact, strap included'),
  ('Apple AirPods Pro (2nd Gen)', 'Type: True wireless in-ear | Chip: Apple H2 | Noise Cancelling: Active NC + Adaptive Transparency | Battery: 6hrs (buds) + 30hrs (case) | Features: Spatial audio, MagSafe charging case'),
  ('Samsung Galaxy Buds2 Pro', 'Type: True wireless in-ear | Noise Cancelling: Intelligent ANC | Battery: 5hrs (buds) + 18hrs (case) | Connectivity: Bluetooth 5.3 | Features: 24-bit Hi-Fi audio'),
  ('Home Theater 5.1 System', 'Channels: 5.1 surround | Output: 1000W PMPO | Connectivity: Bluetooth, HDMI ARC, USB | Includes: Subwoofer + 5 satellite speakers'),
  ('2.1 Channel Soundbar', 'Channels: 2.1 | Output: 120W | Connectivity: Bluetooth, HDMI ARC, Optical | Includes: Wireless subwoofer'),

  -- Home Appliances
  ('LG 7kg Front Load Washing Machine', 'Capacity: 7kg | Type: Front load | Motor: Smart Inverter | Programs: 10+ wash programs | Features: 6 Motion DD technology, child lock'),
  ('Samsung 253L Double Door Refrigerator', 'Capacity: 253L | Type: Frost-free, double door | Compressor: Digital Inverter | Features: Toughened glass shelves, stabilizer-free operation'),
  ('Panasonic Microwave Oven 23L', 'Capacity: 23L | Type: Solo microwave | Power: 800W | Features: 6 auto cook menus, child lock'),
  ('Philips Air Fryer 4.1L', 'Capacity: 4.1L | Technology: Rapid Air | Power: 1400W | Features: Digital display, dishwasher-safe basket'),
  ('Havells Room Heater', 'Type: Fan heater | Power: 2000W | Features: Adjustable thermostat, overheat protection, tip-over safety switch'),
  ('Bajaj Mixer Grinder 750W', 'Power: 750W | Jars: 3 (liquidizing, dry grinding, chutney) | Features: Overload protection, stainless steel blades'),
  ('Prestige Induction Cooktop', 'Power: 2000W | Type: Digital induction | Features: 8 preset menus, auto shut-off, voltage protection'),
  ('Kent Water Purifier RO+UV', 'Purification: RO+UV+UF | Storage: 8L tank | Features: TDS controller, mineral retention technology'),
  ('Usha Ceiling Fan', 'Sweep: 1200mm | Speed: High-speed, 5-star rated | Features: Rust-proof blades, double ball bearing motor'),
  ('Butterfly Electric Kettle 1.5L', 'Capacity: 1.5L | Power: 1500W | Features: Auto shut-off, boil-dry protection, stainless steel body'),

  -- Networking
  ('TP-Link Archer C6 Router', 'Standard: AC1200 dual-band | Speed: 300Mbps (2.4GHz) + 867Mbps (5GHz) | Antennas: 4 external | Ports: 4x LAN, 1x WAN'),
  ('TP-Link Deco Mesh WiFi (3-Pack)', 'Standard: AC1200 mesh | Coverage: Up to 5,500 sq ft | Features: Seamless roaming, parental controls, one app management'),
  ('D-Link 8-Port Gigabit Switch', 'Ports: 8x Gigabit Ethernet | Type: Unmanaged, plug-and-play | Features: Auto MDI/MDIX, fanless design'),
  ('Netgear Nighthawk AX6000 Router', 'Standard: WiFi 6 (802.11ax) | Speed: Up to 6Gbps combined | Antennas: 8 high-performance | Ports: 4x Gigabit LAN, 1x WAN'),
  ('TP-Link WiFi Range Extender', 'Standard: AC1200 | Coverage: Extends up to 1200 sq ft | Setup: One-button WPS | Ports: 1x Ethernet'),
  ('Ethernet Cable Cat6 (50m)', 'Category: Cat6 | Speed: Up to 10Gbps (short runs) | Length: 50m roll | Shielding: UTP, PVC jacket'),
  ('TP-Link 4G LTE WiFi Router', 'Standard: 4G LTE Cat4 | Speed: Up to 150Mbps | WiFi: N300 | Features: SIM card slot, WAN/LAN port'),
  ('MikroTik hAP ac2 Router', 'Standard: AC1200 dual-concurrent | Ports: 5x Gigabit Ethernet | OS: RouterOS with advanced configuration | Features: USB port for storage/modem'),
  ('Ubiquiti UniFi Access Point', 'Standard: WiFi 6 | Coverage: Up to 1000 sq ft per unit | Management: UniFi Controller software | Power: PoE powered'),
  ('USB WiFi Adapter AC600', 'Standard: AC600 dual-band | Speed: 150Mbps (2.4GHz) + 433Mbps (5GHz) | Interface: USB 2.0 | Compatibility: Windows, macOS, Linux'),

  -- Cameras
  ('Canon EOS 1500D DSLR Kit', 'Sensor: 24.1MP APS-C CMOS | Lens: 18-55mm kit lens | Video: Full HD 1080p | ISO: 100-6400 | Screen: 3" LCD'),
  ('GoPro HERO12 Black', 'Video: 5.3K60, 4K120 | Photo: 27MP | Waterproof: Up to 10m without housing | Stabilization: HyperSmooth 6.0 | Battery: Enduro battery'),
  ('Nikon D3500 DSLR Kit', 'Sensor: 24.2MP DX-format CMOS | Lens: 18-55mm kit lens | Video: Full HD 1080p | Battery: Up to 1550 shots | Screen: 3" LCD'),
  ('CCTV Bullet Camera 2MP', 'Resolution: 2MP Full HD | Night Vision: Up to 20m IR range | Type: Outdoor weatherproof | Lens: Fixed 3.6mm'),
  ('CCTV Dome Camera 4MP', 'Resolution: 4MP | Night Vision: Up to 20m IR range | Type: Indoor/outdoor dome | Field of View: Wide angle'),
  ('4-Channel CCTV DVR Kit', 'Includes: DVR + 4 cameras + cables + power supply | Resolution: 2MP per camera | Storage: HDD-ready (not included) | Remote viewing: Mobile app support'),
  ('Video Doorbell Camera', 'Resolution: 1080p HD | Features: Two-way audio, motion detection, night vision | Connectivity: WiFi | Power: Battery or wired'),
  ('Sony Alpha a6000 Mirrorless', 'Sensor: 24.3MP APS-C | Autofocus: 179-point hybrid AF | Video: Full HD 1080p | Viewfinder: OLED electronic viewfinder'),
  ('Instax Mini 12 Instant Camera', 'Film Format: Instax Mini | Exposure: Automatic | Features: Selfie mode, close-up lens | Power: 2x AA batteries'),
  ('1080p Webcam with Microphone', 'Resolution: 1080p Full HD | Frame Rate: 30fps | Microphone: Built-in noise-reducing mic | Connectivity: USB plug-and-play'),

  -- Gaming
  ('Sony PlayStation 5 Console', 'Storage: 825GB SSD | Resolution: Up to 4K/120fps | Features: Ray tracing, DualSense controller included | Backward compatibility: PS4 games'),
  ('Xbox Series S Console', 'Storage: 512GB SSD (digital) | Resolution: Up to 1440p/120fps | Features: Quick Resume, Xbox Game Pass ready'),
  ('Nintendo Switch OLED', 'Screen: 7" OLED | Storage: 64GB internal (expandable) | Modes: TV, tabletop, handheld | Battery: 4.5-9 hours'),
  ('PS5 DualSense Controller', 'Features: Haptic feedback, adaptive triggers | Battery: Built-in rechargeable | Connectivity: Bluetooth, USB-C'),
  ('Logitech G502 Gaming Mouse', 'Sensor: HERO 25K DPI | Buttons: 11 programmable | Features: Adjustable weights, RGB lighting'),
  ('Razer BlackWidow Keyboard', 'Switch Type: Mechanical (green switches) | Lighting: Per-key RGB Chroma | Features: Dedicated media controls'),
  ('Gaming Headset Surround Sound', 'Audio: 7.1 virtual surround | Microphone: Noise-cancelling boom mic | Connectivity: USB/3.5mm | Comfort: Memory foam ear cushions'),
  ('Ergonomic Gaming Chair', 'Adjustability: Reclining, lumbar support, armrests | Material: PU leather | Weight capacity: Up to 150kg'),
  ('24" Gaming Monitor 144Hz', 'Resolution: Full HD (1920x1080) | Refresh Rate: 144Hz | Response Time: 1ms | Panel: IPS/VA'),
  ('Xbox Wireless Controller', 'Compatibility: Xbox Series X|S, Xbox One, PC | Connectivity: Bluetooth | Battery: AA batteries or rechargeable pack'),

  -- Accessories
  ('Anker PowerCore 20000mAh', 'Capacity: 20000mAh | Output: Dual USB-A + USB-C | Fast Charging: PowerIQ technology | Recharge time: ~7 hours'),
  ('USB-C Fast Charger 65W', 'Output: 65W GaN technology | Ports: USB-C PD + USB-A | Compatibility: Laptops, tablets, phones'),
  ('Type-C to Type-C Cable 1m', 'Length: 1m | Speed: Up to 480Mbps data transfer | Charging: Up to 60W | Build: Braided, durable'),
  ('Wireless Charging Pad 15W', 'Output: Up to 15W fast charging | Compatibility: Qi-certified devices | Features: LED indicator, overcharge protection'),
  ('Water Resistant Laptop Backpack', 'Capacity: Fits up to 15.6" laptop | Material: Water-resistant polyester | Features: Multiple compartments, USB charging port'),
  ('Phone Tripod with Remote', 'Height: Adjustable up to 1.6m | Mount: Universal phone clip | Remote: Bluetooth shutter remote included'),
  ('Tempered Glass Screen Protector', 'Hardness: 9H tempered glass | Compatibility: Universal fit (specify model) | Features: Anti-scratch, oleophobic coating'),
  ('Car Phone Mount Holder', 'Mount Type: Dashboard/air vent | Compatibility: 4-7 inch phones | Features: 360-degree rotation, one-hand operation'),
  ('4-in-1 USB Hub', 'Ports: 4x USB 3.0 | Speed: Up to 5Gbps | Compatibility: Windows, macOS, Linux'),
  ('Bluetooth FM Transmitter', 'Connectivity: Bluetooth 5.0 | Charging: Dual USB car charger built-in | Features: Hands-free calling, TF card MP3 playback'),

  -- Smart Home
  ('Mi Smart WiFi LED Bulb', 'Brightness: 800 lumens | Colors: 16 million (RGB+White) | Connectivity: WiFi, app + voice control | Compatibility: Google Assistant, Alexa'),
  ('Smart Plug WiFi Enabled', 'Load: Up to 2400W | Connectivity: WiFi | Features: Remote on/off, scheduling, voice control compatible'),
  ('Smart Door Lock Fingerprint + PIN', 'Unlock Methods: Fingerprint, PIN, app, physical key backup | Power: Battery operated | Features: Access logs, guest codes'),
  ('Video Intercom Smart Doorbell', 'Resolution: 1080p | Features: Two-way audio, motion alerts, night vision | Connectivity: WiFi, app notifications'),
  ('Smart Switch Board 4-Gang WiFi', 'Gangs: 4 | Connectivity: WiFi | Features: App control, voice control, scheduling, no hub required'),
  ('Google Nest Mini', 'Audio: 360-degree sound | Assistant: Google Assistant built-in | Connectivity: WiFi, Bluetooth | Features: Voice match, multi-room audio'),
  ('Amazon Echo Dot (5th Gen)', 'Audio: Improved bass | Assistant: Alexa built-in | Connectivity: WiFi, Bluetooth | Features: Temperature sensor, smart home hub'),
  ('Smart CCTV Camera WiFi Pan-Tilt', 'Resolution: 1080p | Movement: Pan 355°, tilt 90° | Features: Motion tracking, two-way audio, night vision | Storage: microSD + cloud'),
  ('Smart Curtain Motor WiFi', 'Control: App, voice, remote, schedule | Compatibility: Most curtain track types | Power: Rechargeable battery or wired'),
  ('Smart Power Strip with USB', 'Outlets: 4 AC + 4 USB ports | Connectivity: WiFi | Features: Individual outlet control, surge protection, voice control compatible')
) as v(name, description)
where cp.name = v.name;
