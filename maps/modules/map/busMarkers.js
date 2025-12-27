// modules/map/busMarkers.js
// אחראי על ציור רכבים כ-GLB על Mapbox באמצעות BusModelLayer
// ✅ עובד לכל הרכבים: שכבת GLB אחת + אינסטנסים לכל vehicleId
// כולל: fallback positionOnLine + חישוב bearing אם חסר

class BusMarkers {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.map = mapManager.getMap();

    // ✅ שכבת GLB
    this.busLayer = mapManager.getBusModelLayer ? mapManager.getBusModelLayer() : null;

    // מעקב IDs פעילים + מיקום קודם לחישוב bearing
    this.knownIds = new Set();
    this.lastPosById = new Map(); // id -> {lon,lat}

    console.log("🚌 BusMarkers initialized (GLB layer)");
  }

  _makeVehicleId(v, fallbackIndex) {
    // חייב להיות עקבי עם prune + set
    if (v.vehicleId != null) return String(v.vehicleId);
    if (v.tripId != null && v.routeNumber != null) return `${v.routeNumber}-${v.tripId}`;
    if (v.plate != null) return String(v.plate);
    return `veh-${fallbackIndex}`;
  }

  _bearingFrom2Points(lon1, lat1, lon2, lat2) {
    const toRad = (d) => d * Math.PI / 180;
    const toDeg = (r) => r * 180 / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const λ1 = toRad(lon1);
    const λ2 = toRad(lon2);

    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  _bearingFromShape(shapeLatLngs, idx) {
    if (!shapeLatLngs || shapeLatLngs.length < 2) return 0;
    const i = Math.max(0, Math.min(shapeLatLngs.length - 2, idx));
    const a = shapeLatLngs[i];
    const b = shapeLatLngs[i + 1];
    return this._bearingFrom2Points(a[0], a[1], b[0], b[1]);
  }

  drawBuses(vehicles, color, shapeCoords) {
    if (!this.map || !Array.isArray(vehicles)) return new Set();

    // אם שכבת GLB לא קיימת (לא נטענה) – לא ניפול
    this.busLayer = this.busLayer || (this.mapManager.getBusModelLayer ? this.mapManager.getBusModelLayer() : null);
    if (!this.busLayer || !this.busLayer.upsertVehicles) {
      console.warn("⚠️ busLayer (GLB) not ready yet");
      return new Set();
    }

    const activeIds = new Set();
    const updates = [];

    const shapeLatLngs = shapeCoords ? shapeCoords.map(c => [c[0], c[1]]) : [];

    vehicles.forEach((v, idx) => {
      try {
        let lon = v.lon;
        let lat = v.lat;

        // fallback: positionOnLine -> shape
        if ((!lat || !lon) && typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
          const sIdx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
          const p = shapeLatLngs[sIdx];
          if (p) {
            lon = p[0];
            lat = p[1];
          }
        }

        if (typeof lon !== 'number' || typeof lat !== 'number') return;

        const id = this._makeVehicleId(v, idx);
        activeIds.add(id);

        // bearing priority:
        // 1) v.bearing אם קיים
        // 2) מחישוב נקודה קודמת
        // 3) מה-shape segment
        let bearing = (typeof v.bearing === 'number') ? v.bearing : null;

        if (bearing == null) {
          const prev = this.lastPosById.get(id);
          if (prev) {
            bearing = this._bearingFrom2Points(prev.lon, prev.lat, lon, lat);
          } else if (typeof v.positionOnLine === "number" && shapeLatLngs.length > 1) {
            const sIdx = Math.floor(v.positionOnLine * (shapeLatLngs.length - 1));
            bearing = this._bearingFromShape(shapeLatLngs, sIdx);
          } else {
            bearing = 0;
          }
        }

        // שמירת prev
        this.lastPosById.set(id, { lon, lat });

        updates.push({
          id,
          lon,
          lat,
          bearingDeg: bearing,
          routeNumber: v.routeNumber
        });

      } catch (e) {
        console.error("❌ Error preparing bus GLB update:", e);
      }
    });

    // upsert לכולם במכה אחת
    try {
      this.busLayer.upsertVehicles(updates);
    } catch (e) {
      console.error("❌ Error upserting GLB buses:", e);
    }

    // עדכון knownIds
    activeIds.forEach(id => this.knownIds.add(id));
    return activeIds;
  }

  pruneMarkers(activeVehicleIds) {
    if (!activeVehicleIds || !(activeVehicleIds instanceof Set)) return;

    this.busLayer = this.busLayer || (this.mapManager.getBusModelLayer ? this.mapManager.getBusModelLayer() : null);
    if (!this.busLayer || !this.busLayer.removeVehicles) return;

    const toRemove = [];
    this.knownIds.forEach((id) => {
      if (!activeVehicleIds.has(id)) {
        toRemove.push(id);
        this.knownIds.delete(id);
        this.lastPosById.delete(id);
      }
    });

    if (toRemove.length) {
      try {
        this.busLayer.removeVehicles(toRemove);
      } catch (e) {
        console.error("❌ Error removing GLB vehicles:", e);
      }
    }
  }

  clearAll() {
    try {
      this.busLayer = this.busLayer || (this.mapManager.getBusModelLayer ? this.mapManager.getBusModelLayer() : null);
      if (this.busLayer && this.busLayer.clearAll) this.busLayer.clearAll();
    } catch (e) {}

    this.knownIds.clear();
    this.lastPosById.clear();
    console.log("🗑️ All GLB buses cleared");
  }
}