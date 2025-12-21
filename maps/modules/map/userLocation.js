// modules/map/userLocation.js
// אחראי על ניהול מיקום המשתמש וכפתור ה-locate - ללא export

class UserLocationManager {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.isLocal = window.APP_ENVIRONMENT === 'local';
  }

  async getUserLocation() {
    if (this.isLocal) {
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

  setupLocateButton() {
    const locateBtn = document.getElementById('locateMeBtn');
    if (!locateBtn) return;

    locateBtn.addEventListener('click', async () => {
      const originalIcon = locateBtn.textContent;
      locateBtn.textContent = '⏳';
      
      try {
        const location = await this.getUserLocation();
        
        if (location) {
          console.log("Updated location:", location);
          this.mapManager.setUserLocation(location.latitude, location.longitude);
          this.mapManager.centerOnUser();
        } else {
          this.mapManager.centerOnUser();
        }
      } catch (e) {
        console.log("Could not refresh location, using last known:", e);
        this.mapManager.centerOnUser();
      } finally {
        setTimeout(() => {
          locateBtn.textContent = originalIcon;
        }, 500);
      }
    });
  }
}