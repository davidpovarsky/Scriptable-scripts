// modules/ui/utils.js
// פונקציות עזר כלליות עבור ה-UI - גרסה מתוקנת (ללא כפילויות)

function getVariedColor(hex, strSalt) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  
  let r = parseInt(c.substring(0, 2), 16);
  let g = parseInt(c.substring(2, 4), 16);
  let b = parseInt(c.substring(4, 6), 16);
  
  let hash = 0;
  for (let i = 0; i < strSalt.length; i++) {
    hash = strSalt.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const v = (hash % 60) - 30;
  const clamp = n => Math.min(255, Math.max(0, Math.round(n + v)));
  
  return "#" + [clamp(r), clamp(g), clamp(b)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join("");
}