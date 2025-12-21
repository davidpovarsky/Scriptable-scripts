// integration.js - גשר בין שני הפרויקטים

(function() {
  'use strict';
  
  console.log('Integration module loaded');
  
  // --- Toggle Side Panel ---
  const toggleBtn = document.getElementById('toggleSidePanel');
  const sidePanel = document.getElementById('sidePanel');
  
  if (toggleBtn && sidePanel) {
    toggleBtn.addEventListener('click', function() {
      const isOpen = sidePanel.classList.toggle('open');
      document.body.classList.toggle('side-panel-open', isOpen);
      
      // רענון המפה אחרי אנימציה
      setTimeout(() => {
        if (window.mapInstance) {
          window.mapInstance.invalidateSize();
        }
      }, 350);
    });
  }
  
  // --- רענון תחנות אוטומטי ---
  let refreshInterval = null;
  
  function startStationsRefresh() {
    // רענון ראשוני
    if (typeof window.refreshNearestStations === 'function') {
      window.refreshNearestStations();
    }
    
    // רענון כל 10 שניות
    if (refreshInterval) clearInterval(refreshInterval);
    
    refreshInterval = setInterval(() => {
      if (typeof window.refreshNearestStations === 'function') {
        window.refreshNearestStations();
      }
    }, 10000);
  }
  
  // התחל רענון כאשר יש תחנות
  const originalSetNearestStops = window.setNearestStops;
  window.setNearestStops = function(stops) {
    if (originalSetNearestStops) {
      originalSetNearestStops(stops);
    }
    
    if (stops && stops.length > 0) {
      startStationsRefresh();
    }
  };
  
  // --- סנכרון בין שתי המפות (אופציונלי) ---
  // אם תרצה שלחיצה על תחנה תסמן אותה גם במפה הראשית
  
  // נקה interval בעת סגירת הדף
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
  });
  
  console.log('Integration initialized');
  
})();