import os
from PIL import Image

AVATARS_DIR = './platforms/wechat/assets/avatars'
TARGET_SIZE = 256

def convert_avatars():
    if not os.path.exists(AVATARS_DIR):
        print(f"Directory {AVATARS_DIR} does not exist.")
        return

    files = [f for f in os.listdir(AVATARS_DIR) if f.lower().endswith('.png')]
    
    for file in files:
        file_path = os.path.join(AVATARS_DIR, file)
        output_file = os.path.splitext(file)[0] + '.jpg'
        output_path = os.path.join(AVATARS_DIR, output_file)
        print(f"Processing {file} -> {output_file}...")
        
        try:
            with Image.open(file_path) as img:
                # Convert to RGB (required for JPG)
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Resize to 256x256
                img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)
                
                # Save as JPG with quality 80
                img.save(output_path, "JPEG", quality=80)
                print(f"Successfully processed to {output_path}")
                
                # Delete the original PNG file
                os.remove(file_path)
                print(f"Removed original file: {file}")
        except Exception as e:
            print(f"Error processing {file}: {e}")

if __name__ == "__main__":
    convert_avatars()
