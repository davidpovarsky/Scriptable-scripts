// modules/ui/utils.js
// פונקציות עזר כלליות עבור ה-UI

export function getVariedColor(hex, strSalt) {
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

export async function fetchJson(url, proxyUrl) {
  const isLocal = window.APP_ENVIRONMENT === 'local';
  
  try {
    if (isLocal && proxyUrl) {
      const proxiedUrl = proxyUrl + "?url=" + encodeURIComponent(url);
      const response = await fetch(proxiedUrl);
      return await response.json();
    } else {
      const response = await fetch(url);
      return await response.json();
    }
  } catch (e) {
    console.error("Fetch error:", e);
    throw e;
  }
}
const IS_LOCAL = window.APP_ENVIRONMENT === 'local';
const PROXY_URL = "https://script.google.com/macros/s/AKfycbxKfWtTeeoOJCoR_WD4JQhvDGHcE3j82tVHVQXqElwL9NVO9ourZxSHTA20GoBJKfmiLw/exec";

export async function fetchJson(url) {
  try {
    if (IS_LOCAL) {
      const proxyUrl = PROXY_URL + "?url=" + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      return await response.json();
    } else {
      const response = await fetch(url);
      return await response.json();
    }
  } catch (e) {
    console.error("Fetch error:", e);
    throw e;
  }
}

export async function getUserLocation() {
  if (IS_LOCAL) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => resolve({ 
          latitude: position.coords.latitude, 
          longitude: position.coords.longitude 
        }),
        error => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  } else {
    return null; 
  }
}