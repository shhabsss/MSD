import zlib
import struct
import math
import os

def create_png(width, height, draw_func, filename):
    # RGBA image buffer
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = draw_func(x, y, width, height)
            raw_data.extend([r, g, b, a])
            
    # PNG signature
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('>I', len(ihdr_data)))
    png.extend(b'IHDR')
    png.extend(ihdr_data)
    png.extend(struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)))
    png.extend(b'IDAT')
    png.extend(compressed)
    png.extend(struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0))
    png.extend(b'IEND')
    png.extend(struct.pack('>I', iend_crc))
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename} ({width}x{height})")

def draw_icon(x, y, w, h, maskable=False):
    # Normalized coords from -1 to 1
    nx = (x / w) * 2 - 1
    ny = (y / h) * 2 - 1
    dist = math.sqrt(nx*nx + ny*ny)
    
    # Background color: Deep Navy / Blue #1e3a8a -> rgb(30, 58, 138)
    bg_r, bg_g, bg_b = 30, 58, 138
    
    if maskable:
        # Full bleed background
        r, g, b, a = bg_r, bg_g, bg_b, 255
    else:
        # Rounded squircle/circle badge
        if dist > 0.98:
            return 0, 0, 0, 0
        elif dist > 0.92:
            # subtle smooth border
            alpha = int(255 * (0.98 - dist) / 0.06)
            return bg_r, bg_g, bg_b, max(0, min(255, alpha))
        else:
            r, g, b, a = bg_r, bg_g, bg_b, 255

    # Center badge: Inner gold/emerald shield ring
    scale = 0.55 if maskable else 0.65
    scaled_x = nx / scale
    scaled_y = ny / scale
    
    # Draw an inner elegant diamond/shield emblem
    shield_val = abs(scaled_x) + abs(scaled_y)
    if shield_val < 0.85 and shield_val > 0.72:
        # Gold accent ring
        return 245, 158, 11, 255 # amber-500
    
    # Inner circle for symbol
    inner_dist = math.sqrt(scaled_x*scaled_x + scaled_y*scaled_y)
    if inner_dist < 0.68:
        # Subtle gradient circle
        if inner_dist < 0.58:
            # Service checkmark / tool pattern in white
            # Let's draw an 'M' or checkmark
            # Checkmark:
            # Segment 1: from (-0.25, 0.0) to (-0.05, 0.25)
            # Segment 2: from (-0.05, 0.25) to (0.28, -0.20)
            px, py = scaled_x, scaled_y
            
            # Distance to segment 1
            # y - y0 = m (x - x0), m = (0.25 - 0.0) / (-0.05 - (-0.25)) = 0.25 / 0.20 = 1.25
            in_seg1 = (px >= -0.28 and px <= -0.02) and abs(py - (1.25 * (px + 0.25) + 0.0)) < 0.08
            in_seg2 = (px >= -0.05 and px <= 0.32) and abs(py - (-1.35 * (px - (-0.05)) + 0.25)) < 0.08
            
            if in_seg1 or in_seg2:
                return 255, 255, 255, 255 # crisp white checkmark
            
            # Under checkmark: small 'MSD' text representation or clean blue backdrop
            return 37, 99, 235, 255 # blue-600
        else:
            return 255, 255, 255, 220
            
    return r, g, b, a

create_png(192, 192, lambda x,y,w,h: draw_icon(x,y,w,h, False), 'public/pwa-192x192.png')
create_png(512, 512, lambda x,y,w,h: draw_icon(x,y,w,h, False), 'public/pwa-512x512.png')
create_png(512, 512, lambda x,y,w,h: draw_icon(x,y,w,h, True), 'public/pwa-maskable-512x512.png')
create_png(180, 180, lambda x,y,w,h: draw_icon(x,y,w,h, False), 'public/apple-touch-icon.png')
create_png(64, 64, lambda x,y,w,h: draw_icon(x,y,w,h, False), 'public/favicon.png')
print("All icons successfully generated!")
