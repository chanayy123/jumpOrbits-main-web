import os
from PIL import Image

THEMES_DIR = './platforms/wechat/assets/themes'
TARGET_WIDTH = 800
TARGET_HEIGHT = 500

def process_images():
    if not os.path.exists(THEMES_DIR):
        print(f"Directory {THEMES_DIR} does not exist.")
        return

    files = [f for f in os.listdir(THEMES_DIR) if f.lower().endswith('.png')]
    
    for file in files:
        file_path = os.path.join(THEMES_DIR, file)
        output_file = os.path.splitext(file)[0] + '.jpg'
        output_path = os.path.join(THEMES_DIR, output_file)
        print(f"Processing {file} -> {output_file}...")
        
        try:
            with Image.open(file_path) as img:
                # Convert to RGB (required for JPG)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Calculate aspect ratios
                target_ratio = TARGET_WIDTH / TARGET_HEIGHT
                img_ratio = img.width / img.height
                
                if img_ratio > target_ratio:
                    # Image is wider than target
                    new_height = TARGET_HEIGHT
                    new_width = int(new_height * img_ratio)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    left = (new_width - TARGET_WIDTH) / 2
                    top = 0
                    right = (new_width + TARGET_WIDTH) / 2
                    bottom = TARGET_HEIGHT
                    img = img.crop((left, top, right, bottom))
                else:
                    # Image is taller than target
                    new_width = TARGET_WIDTH
                    new_height = int(new_width / img_ratio)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    left = 0
                    top = (new_height - TARGET_HEIGHT) / 2
                    right = TARGET_WIDTH
                    bottom = (new_height + TARGET_HEIGHT) / 2
                    img = img.crop((left, top, right, bottom))
                
                # Double check size and save
                img = img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)
                img.save(output_path, "JPEG", quality=85)
                print(f"Successfully processed to {output_path}")
                
                # Delete the original PNG file
                os.remove(file_path)
                print(f"Removed original file: {file}")
        except Exception as e:
            print(f"Error processing {file}: {e}")

if __name__ == "__main__":
    process_images()
