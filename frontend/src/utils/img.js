const API = import.meta.env.VITE_API_URL || "http://192.168.0.145:5000";

// رابط صورة اللوحة المخزّنة في قاعدة البيانات (LONGBLOB) عبر نقطة الوصول.
// يُرجع null إن لم تكن للّوحة صورة، فيعرض المكوّن البديل المحايد بدل صورة عشوائية وهمية.
export function paintingImageUrl(painting) {
  if (!painting) return null;
  if (painting.has_image || painting.image) {
    return `${API}/api/paintings/${painting.id}/image`;
  }
  return null;
}

// رابط صورة الفنان المخزّنة في قاعدة البيانات (LONGBLOB).
// يُرجع null إن لم تكن للفنان صورة — فتُعرض الأحرف الأولى من اسمه كبديل أنيق.
export function artistPhotoUrl(artist) {
  if (!artist) return null;
  if (artist.has_photo) {
    return `${API}/api/artists/${artist.id}/photo`;
  }
  // توافق خلفي: لو كان photo رابطاً كاملاً مخزّناً سابقاً
  if (artist.photo && /^https?:\/\//.test(artist.photo)) return artist.photo;
  return null;
}

// بديل محايد بنفس الثيم الداكن — «لا توجد صورة» بدل صورة عشوائية مضلّلة.
export const IMG_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'>" +
      "<rect width='400' height='500' fill='#14141c'/>" +
      "<g fill='none' stroke='#3a3a48' stroke-width='4'>" +
      "<rect x='150' y='205' width='100' height='80' rx='6'/>" +
      "<circle cx='178' cy='233' r='9'/>" +
      "<path d='M158 277 l26 -26 20 17 26 -28 18 21'/></g>" +
      "<text x='200' y='325' fill='#5a5a68' font-family='sans-serif' font-size='17' text-anchor='middle'>Görsel yok</text>" +
      "</svg>",
  );
