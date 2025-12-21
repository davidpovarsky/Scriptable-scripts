// modules/ui/modeToggle.js
// אחראי על כפתור המעבר בין מצב דואלי למפה בלבד - ללא export

class ModeToggle {
  constructor(mapManager) {
    this.mapManager = mapManager;
  }

  init() {
    const radios = document.getElementsByName('viewMode');
    
    radios.forEach(r => {
      r.addEventListener('change', (e) => {
        const isDual = e.target.value === 'dual';
        
        if (isDual) {
          document.body.classList.add('mode-dual');
          document.body.classList.remove('mode-map-only');
        } else {
          document.body.classList.add('mode-map-only');
          document.body.classList.remove('mode-dual');
        }
        
        // תיקון גודל מפה לאחר האנימציה
        setTimeout(() => {
          if (this.mapManager) {
            this.mapManager.invalidateSize();
          }
        }, 450);
      });
    });
  }
}