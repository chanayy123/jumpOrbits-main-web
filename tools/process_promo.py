from PIL import Image
import os

def process_promo_image(input_path, output_path, target_width=720, target_height=1280, max_kb=200):
    if not os.path.exists(input_path):
        if "_" in input_path:
             print(f"Error: Input file {input_path} not found.")
             return

    # Open the image
    img = Image.open(input_path)
    
    # --- AUTO DETECT CONTENT AREA ---
    rgb_img = img.convert('RGB')
    width, height = img.size
    left, top, right, bottom = 0, 0, width, height
    
    # Find edges by scanning for non-light pixels (poster is dark)
    for y in range(height):
        r, g, b = rgb_img.getpixel((width // 2, y))
        if r < 60 and g < 60 and b < 60:
            top = y
            break
    for y in range(height - 1, -1, -1):
        r, g, b = rgb_img.getpixel((width // 2, y))
        if r < 60 and g < 60 and b < 60:
            bottom = y
            break
    for x in range(width):
        r, g, b = rgb_img.getpixel((x, height // 2))
        if r < 60 and g < 60 and b < 60:
            left = x
            break
    for x in range(width - 1, -1, -1):
        r, g, b = rgb_img.getpixel((x, height // 2))
        if r < 60 and g < 60 and b < 60:
            right = x
            break

    print(f"Detected content box: {left, top, right, bottom}")
    # Add a small margin and crop
    img_cropped = img.crop((left + 2, top + 2, right - 2, bottom - 2))
    
    # Apply aspect ratio crop for 9:16 (720x1280)
    cw, ch = img_cropped.size
    target_ratio = target_width / target_height
    current_ratio = cw / ch
    
    if current_ratio > target_ratio:
        new_w = int(ch * target_ratio)
        off = (cw - new_w) // 2
        img_cropped = img_cropped.crop((off, 0, off + new_w, ch))
    else:
        new_h = int(cw / target_ratio)
        off = (ch - new_h) // 2
        img_cropped = img_cropped.crop((0, off, cw, off + new_h))

    # Resize to final dimensions 720x1280
    img_final = img_cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    if img_final.mode in ('RGBA', 'P'):
        img_final = img_final.convert('RGB')
        
    # --- ITERATIVE QUALITY REDUCTION TO FIT 200KB ---
    quality = 95
    while quality > 10:
        img_final.save(output_path, 'JPEG', quality=quality, optimize=True)
        file_size = os.path.getsize(output_path) / 1024
        if file_size <= max_kb:
            print(f"Success: Saved at quality {quality}, size: {file_size:.2f} KB")
            break
        quality -= 5

if __name__ == "__main__":
    base_dir = r"d:\workspace\cursor\jumpOrbits-main-wechat-phaser"
    assets_path = os.path.join(base_dir, "platforms", "wechat", "assets", "images")
    
    tasks = [
        ("promo_vertical_raw.png", "promo_1.jpg"),
        ("promo_2_raw.png", "promo_2.jpg"),
        ("promo_3_raw.png", "promo_3.jpg")
    ]
    
    for input_name, output_name in tasks:
        input_path = os.path.join(assets_path, input_name)
        output_path = os.path.join(assets_path, output_name)
        
        if os.path.exists(input_path):
            print(f"\n--- Processing {input_name} ---")
            process_promo_image(input_path, output_path)
        else:
            print(f"Skipping {input_name}: file not found.")
