// Konfigurasi asal (origin) API backend.
// - Dibuka lewat GitHub Pages -> frontend & backend beda origin,
//   arahkan ke URL server Render.
// - Dibuka lokal (mis. http://localhost:3000) -> backend satu origin
//   dengan frontend, biarkan kosong supaya pakai path relatif.
window.API_ORIGIN = window.location.hostname.endsWith("github.io")
  ? "https://REPLACE-WITH-RENDER-URL.onrender.com"
  : "";
