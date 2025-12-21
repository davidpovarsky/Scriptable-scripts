// modules/routes/bottomSheet.js
// אחראי על ה-bottom sheet הניתן לגרירה - ללא export

class BottomSheet {
  constructor() {
    this.startY = 0;
    this.startH = 0;
  }

  init() {
    const sheet = document.getElementById('bottomSheet');
    if (!sheet) return;
    
    const handle = document.getElementById('dragHandleArea');
    if (!handle) return;

    handle.addEventListener('touchstart', (e) => {
      this.startY = e.touches[0].clientY;
      this.startH = sheet.offsetHeight;
      sheet.style.transition = 'none';
    });

    document.addEventListener('touchmove', (e) => {
      if (!this.startY) return;
      
      const delta = this.startY - e.touches[0].clientY;
      let h = this.startH + delta;
      h = Math.max(60, Math.min(window.innerHeight * 0.9, h));
      sheet.style.height = h + "px";
    });

    document.addEventListener('touchend', () => {
      this.startY = 0;
      sheet.style.transition = 'height 0.3s ease';
      
      const h = sheet.offsetHeight;
      if (h < 150) {
        sheet.style.height = "60px";
      } else if (h > window.innerHeight * 0.6) {
        sheet.style.height = "85vh";
      } else {
        sheet.style.height = "45vh";
      }
    });
  }
}