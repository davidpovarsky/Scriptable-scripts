// modules/map/busMarkers.js
// אחראי על ציור/עדכון כלי רכב על המפה.
// ✅ גרסה חדשה: משתמשת במודל GLB (Three.js Custom Layer) לכל הרכבים.
// נשמר API זהה ל-app.js: drawBuses(...) + pruneMarkers(activeIdsSet)

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();

    // אם שכבת GLB קיימת - נשתמש בה
    this.busModelLayer = (typeof mapManager.getBusModelLayer === 'function') ? mapManager.getBusModelLayer() : null;

    // fallback (אם תרצה בעתיד): markers DOM
    this.domMarkers = new Map();

    console.log("🚌 BusMarkers initialized (GLB for all vehicles)");
  }

  // יוצר ID יציב לרכב (כדי שה-prune יעבוד)
  getVehicleId(v, idx = 0) {
    const raw =
      v?.vehicleId ??
      v?.id ??
      v?.vehicle_ref ??
      v?.licensePlate ??
      v?.vehicleRef ??
      null;

    if (raw) return String(raw);

    // fallback פחות אידיאלי, אבל יציב יחסית:
    const route = v?.routeNumber ?? v?.line ?? v?.routeId ?? 'X';
    const trip  = v?.tripId ?? v?.trip_id ?? v?.journeyId ?? v?.blockId ?? '';
    const dir   = v?.directionId ?? v?.direction ?? '';
    const suffix = `${route}-${trip}-${dir}`.replace(/--+/g,'-').replace(/-$/,'');
    return suffix ? `${suffix}-${idx}` : `veh-${idx}`;
  }

  // מחשב נקודה לאורך shape לפי positionOnLine (0..1)
  getPointAlongShape(shapeCoords, positionOnLine) {
    if (!Array.isArray(shapeCoords) || shapeCoords.length < 2) return null;
    if (typeof positionOnLine !== 'number' || !isFinite(positionOnLine)) return null;

    const t = Math.max(0, Math.min(1, positionOnLine));
    const n = shapeCoords.length;

    const f = t * (n - 1);
    const i = Math.floor(f);
    const frac = f - i;

    const p0 = shapeCoords[i];
    const p1 = shapeCoords[Math.min(i + 1, n - 1)];
    if (!p0 || !p1) return null;

    // shapeCoords במערכת שלנו: [lon,lat]
    const lon = p0[0] + (p1[0] - p0[0]) * frac;
    const lat = p0[1] + (p1[1] - p0[1]) * frac;
    return { lon, lat };
  }

  // מחלץ lon/lat לרכב: או מהשדות הישירים, או מתוך positionOnLine+shape
  resolveLonLat(v, shapeCoords) {
    const lon = (typeof v?.lon === 'number' && isFinite(v.lon)) ? v.lon : null;
    const lat = (typeof v?.lat === 'number' && isFinite(v.lat)) ? v.lat : null;

    if (lon != null && lat != null) return { lon, lat };

    if (typeof v?.positionOnLine === 'number' && shapeCoords) {
      const p = this.getPointAlongShape(shapeCoords, v.positionOnLine);
      if (p) return p;
    }

    return null;
  }

  // ✅ drawBuses מחזיר Set של vehicleIds שצוירו - כדי ש-app.js יוכל לבנות activeVehicleIds נכון
  drawBuses(vehicles, color, shapeCoords) {
    if (!Array.isArray(vehicles) || !vehicles.length) return new Set();

    const activeIds = new Set();

    if (!this.map) return activeIds;

    // אם שכבת GLB עדיין לא נוצרה (למשל בגלל טוקן/טעינת מפה), ננסה למשוך אותה מחדש
    if (!this.busModelLayer && typeof this.mapManager.getBusModelLayer === 'function') {
      this.busModelLayer = this.mapManager.getBusModelLayer();
    }

    const states = [];

    vehicles.forEach((v, idx) => {
      try {
        const id = this.getVehicleId(v, idx);
        const pos = this.resolveLonLat(v, shapeCoords);
        if (!pos) return;

        activeIds.add(id);

        const bearingDeg =
          (typeof v?.bearing === 'number' && isFinite(v.bearing)) ? v.bearing :
          (typeof v?.heading === 'number' && isFinite(v.heading)) ? v.heading :
          null;

        states.push({
          id,
          lon: pos.lon,
          lat: pos.lat,
          bearingDeg
        });
      } catch (e) {
        console.error("❌ Error normalizing vehicle:", e);
      }
    });

    if (this.busModelLayer && states.length) {
      this.busModelLayer.upsertVehicles(states);
    }

    return activeIds;
  }

  pruneMarkers(activeVehicleIds) {
    if (!(activeVehicleIds instanceof Set)) return;

    if (!this.busModelLayer && typeof this.mapManager.getBusModelLayer === 'function') {
      this.busModelLayer = this.mapManager.getBusModelLayer();
    }

    if (this.busModelLayer) {
      this.busModelLayer.pruneVehicles(activeVehicleIds);
      return;
    }

    // fallback DOM markers (לא אמור לקרות אצלך אם שכבת GLB מופעלת)
    this.domMarkers.forEach((marker, id) => {
      if (!activeVehicleIds.has(id)) {
        try { marker.remove(); } catch(e){}
        this.domMarkers.delete(id);
      }
    });
  }

  clearAll() {
    if (this.busModelLayer) {
      this.busModelLayer.pruneVehicles(new Set());
    }
    this.domMarkers.forEach((marker) => { try { marker.remove(); } catch(e){} });
    this.domMarkers.clear();
  }
}