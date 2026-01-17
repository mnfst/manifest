#!/bin/bash
# Download external assets to local storage

AVATARS_DIR="/home/user/manifest/packages/manifest-ui/public/demo/avatars"
IMAGES_DIR="/home/user/manifest/packages/manifest-ui/public/demo/images"

mkdir -p "$AVATARS_DIR" "$IMAGES_DIR"

echo "Downloading avatar images..."

# Pravatar avatars (150px)
for user in sarah alex jordan morgan casey jamie drew riley avery quinn sage blake charlie sydney taylor team mickael mike kirsten anthony ivan elon natgeo satya techtalks live; do
  echo "  Downloading avatar: $user (150px)"
  curl -sL -o "$AVATARS_DIR/${user}-150.jpg" "https://i.pravatar.cc/150?u=$user"
done

# Pravatar avatars (40px)
for user in alex sam; do
  echo "  Downloading avatar: $user (40px)"
  curl -sL -o "$AVATARS_DIR/${user}-40.jpg" "https://i.pravatar.cc/40?u=$user"
done

# Pravatar avatars (80px)
for user in midnight cavityfree; do
  echo "  Downloading avatar: $user (80px)"
  curl -sL -o "$AVATARS_DIR/${user}-80.jpg" "https://i.pravatar.cc/80?u=$user"
done

echo ""
echo "Downloading Unsplash images..."

# Unsplash images - content/blog images (800px width)
declare -A unsplash_800=(
  ["1633356122544-f134324a6cee"]="tech-react"
  ["1559028012-481c04fa702d"]="tech-ux"
  ["1558494949-ef010cbdcc31"]="tech-cloud"
  ["1556742049-0cfed4f6a45d"]="tech-ecommerce"
  ["1552664730-d307ca884978"]="tech-team"
  ["1573164713988-8665fc963095"]="tech-women"
  ["1551288049-bebda4e38f71"]="tech-dashboard"
  ["1516321318423-f06f85e504b3"]="tech-remote"
  ["1555066931-4365d14bab8c"]="tech-code"
  ["1460925895917-afdab827c52f"]="tech-seo"
  ["1504639725590-34d0984388bd"]="tech-debug"
  ["1526304640581-d334cdbbf45e"]="tech-marketing"
  ["1512941937669-90a1b58e7e9c"]="tech-mobile"
  ["1558655146-d09347e92766"]="tech-design"
  ["1470225620780-dba8ba36b745"]="event-music"
  ["1585699324551-f6c309eedeca"]="event-comedy"
  ["1504609813442-a8924e83f76e"]="event-yoga"
  ["1545205597-3d9d02c29597"]="event-wellness"
  ["1546519638-68e109498ffc"]="event-basketball"
  ["1555939594-58d7cb561ad1"]="event-food"
  ["1531243269054-5ebf6f34081e"]="event-wine"
  ["1514320291840-2e0a9bf2a9ae"]="event-jazz"
  ["1571266028243-e4733b0f0bb0"]="event-rooftop"
  ["1527224538127-2104bb71c51b"]="event-art"
  ["1506157786151-b8491531f063"]="event-concert"
  ["1489599849927-2ee91cede3ba"]="event-movie"
  ["1566577739112-5180d4bf9390"]="event-salsa"
  ["1510812431401-41d2bd2722f3"]="event-tasting"
  ["1506126613408-eca07ce68773"]="event-meditation"
  ["1514525253161-7a46d19cd819"]="event-edm"
  ["1533174072545-7a4b6ad7a6c3"]="event-festival"
  ["1620712943543-bcc4688e7485"]="tech-ai"
  ["1540575467063-178a50c2df87"]="event-conference"
  ["1506905925346-21bda4d32df4"]="nature-mountain"
  ["1677442136019-21780ecad995"]="tech-ai-2"
  ["1459749411175-04bf5292ceea"]="event-summer"
)

for id in "${!unsplash_800[@]}"; do
  name="${unsplash_800[$id]}"
  echo "  Downloading: $name.jpg"
  curl -sL -o "$IMAGES_DIR/${name}.jpg" "https://images.unsplash.com/photo-${id}?w=800&q=80"
done

# Unsplash images - smaller sizes for specific use cases
echo ""
echo "Downloading smaller Unsplash images..."

# Hotel images (200x200)
declare -A unsplash_hotels=(
  ["1566073771259-6a8506099945"]="hotel-1"
  ["1551882547-ff40c63fe5fa"]="hotel-2"
  ["1542314831-068cd1dbfeeb"]="hotel-3"
  ["1578683010236-d716f9a3f461"]="hotel-4"
  ["1564501049412-61c2a3083791"]="hotel-5"
  ["1571896349842-33c89424de2d"]="hotel-6"
  ["1582719478250-c89cae4dc85b"]="hotel-7"
  ["1590490360182-c33d57733427"]="hotel-8"
)

for id in "${!unsplash_hotels[@]}"; do
  name="${unsplash_hotels[$id]}"
  echo "  Downloading: $name.jpg"
  curl -sL -o "$IMAGES_DIR/${name}.jpg" "https://images.unsplash.com/photo-${id}?w=200&h=200&fit=crop&q=80"
done

# Homepage images (various sizes)
echo ""
echo "Downloading homepage images..."

curl -sL -o "$IMAGES_DIR/blog-cover-1.jpg" "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&h=450&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/blog-cover-2.jpg" "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=450&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/blog-cover-3.jpg" "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&h=450&fit=crop&q=80"

curl -sL -o "$IMAGES_DIR/product-1.jpg" "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/product-2.jpg" "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&h=400&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/product-3.jpg" "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/product-4.jpg" "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=400&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/product-5.jpg" "https://images.unsplash.com/photo-1631867675167-90a456a90863?w=400&h=400&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/product-6.jpg" "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=400&fit=crop&q=80"

# Misc images
curl -sL -o "$IMAGES_DIR/thumbnail-1.jpg" "https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&h=300&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/thumbnail-2.jpg" "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=400&h=300&fit=crop&q=80"
curl -sL -o "$IMAGES_DIR/thumbnail-3.jpg" "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=400&h=300&fit=crop&q=80"

echo ""
echo "Download complete!"
echo "Avatars: $(ls -1 $AVATARS_DIR | wc -l) files"
echo "Images: $(ls -1 $IMAGES_DIR | wc -l) files"
