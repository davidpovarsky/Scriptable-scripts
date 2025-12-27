// config/bus3DConfig.js
// קובץ הגדרות מרכזי לכיוונון מודל האוטובוס התלת-מימדי

/**
 * הגדרות מודל תלת-מימדי - GLB
 * 
 * כל הפרמטרים הללו ניתנים לשינוי כדי להתאים את המודל למפה.
 * שמור קובץ זה וטען מחדש את האפליקציה כדי לראות שינויים.
 */

const BUS_3D_CONFIG = {
  
  // ============================================
  // מיקום המודל
  // ============================================
  
  /**
   * URL למודל GLB
   * ניתן להחליף למודל אחר (חייב להיות נגיש דרך HTTPS)
   */
  glbUrl: "https://raw.githubusercontent.com/davidpovarsky/Scriptable-scripts/3D/maps/Bus4glb.glb",
  
  /**
   * גודל המודל (scale)
   * ערכים טיפוסיים: 30-60
   * ערך גבוה יותר = מודל גדול יותר
   */
  modelScale: 45,
  
  /**
   * גובה המודל מעל פני הקרקע במטרים
   * 0 = על הקרקע
   * ערכים חיוביים = מעל הקרקע
   */
  altitudeMeters: 0,
  
  // ============================================
  // סיבובי המודל (Rotation)
  // ============================================
  
  /**
   * תיקון כיוון בסיסי (Yaw) במעלות
   * מתאים את הכיוון שהמודל "מסתכל" בו
   * טווח: -180 עד 180
   * 
   * כיוונים:
   * 0   = צפון
   * 90  = מזרח
   * 180 = דרום
   * -90 = מערב
   */
  yawOffsetDeg: -51.75,
  
  /**
   * סיבוב בסיסי סביב ציר X במעלות
   * שולט על הטיית המודל קדימה/אחורה
   * טווח: 0-360
   */
  baseRotXDeg: 88.25,
  
  /**
   * סיבוב בסיסי סביב ציר Y במעלות
   * שולט על הטיית המודל שמאלה/ימינה
   * טווח: 0-360
   */
  baseRotYDeg: 0,
  
  /**
   * סיבוב בסיסי סביב ציר Z במעלות
   * שולט על סיבוב המודל סביב עצמו
   * טווח: 0-360
   */
  baseRotZDeg: 0,
  
  // ============================================
  // הזזות (Offsets)
  // ============================================
  
  /**
   * הזזה מזרחה במטרים
   * ערכים חיוביים = מזרח
   * ערכים שליליים = מערב
   */
  offsetEastM: 0,
  
  /**
   * הזזה צפונה במטרים
   * ערכים חיוביים = צפון
   * ערכים שליליים = דרום
   */
  offsetNorthM: 0,
  
  /**
   * הזזה כלפי מעלה במטרים
   * ערכים חיוביים = למעלה
   * ערכים שליליים = למטה
   */
  offsetUpM: 0,
  
  /**
   * מכפיל קנה מידה נוסף
   * 1.0 = רגיל
   * > 1.0 = גדול יותר
   * < 1.0 = קטן יותר
   */
  scaleMul: 1,
  
  // ============================================
  // אנימציה ותנועה
  // ============================================
  
  /**
   * משך אנימציה למעבר בין נקודות במילישניות
   * ערך גבוה יותר = תנועה איטית וחלקה יותר
   * ערך נמוך יותר = תנועה מהירה וחדה יותר
   * טווח מומלץ: 1000-3000
   */
  animationDuration: 2000,
  
  /**
   * מקדם החלקה (Smoothing Factor)
   * שולט על מהירות התגובה לשינויי מיקום
   * 
   * ערכים:
   * 0.05 = תגובה איטית, תנועה מאוד חלקה
   * 0.15 = מאוזן (ברירת מחדל)
   * 0.30 = תגובה מהירה, פחות חלק
   * 1.00 = ללא החלקה (קפיצות)
   */
  smoothingFactor: 0.15,
  
  // ============================================
  // הגדרות תאורה (Lighting)
  // ============================================
  
  /**
   * עוצמת תאורת רקע (Ambient Light)
   * טווח: 0.0-1.0
   * 0.0 = חושך מוחלט
   * 1.0 = תאורה מלאה
   */
  ambientLightIntensity: 0.9,
  
  /**
   * עוצמת תאורה כיוונית (Directional Light)
   * טווח: 0.0-1.0
   */
  directionalLightIntensity: 0.9,
  
  /**
   * מיקום תאורה כיוונית [X, Y, Z]
   */
  directionalLightPosition: [10, -10, 20],
  
  // ============================================
  // צבעים וחומרים
  // ============================================
  
  /**
   * האם להחיל את צבע הקו על המודל
   * true = כן, צבע המודל ישתנה לפי צבע הקו
   * false = לא, המודל ישאר בצבע המקורי שלו
   */
  applyRouteColor: true,
  
  /**
   * עוצמת הצבע (כאשר applyRouteColor = true)
   * 0.0 = צבע מקורי של המודל
   * 1.0 = צבע הקו במלואו
   */
  colorIntensity: 1.0,
  
  // ============================================
  // ביצועים (Performance)
  // ============================================
  
  /**
   * מספר מקסימלי של מודלים על המפה
   * אם יש יותר אוטובוסים, הישנים יוסרו
   * 0 = ללא הגבלה
   */
  maxInstances: 0,
  
  /**
   * האם להשתמש ב-Level of Detail (LOD)
   * מודלים רחוקים יוצגו בפשטות רבה יותר
   */
  useLOD: false,
  
  /**
   * מרחק LOD במטרים
   * מעל מרחק זה, המודל יוצג בפשטות
   */
  lodDistance: 500,
  
  // ============================================
  // Debug
  // ============================================
  
  /**
   * מצב Debug - מציג מידע נוסף בקונסול
   */
  debugMode: false,
  
  /**
   * מציג Bounding Box סביב המודל
   */
  showBoundingBox: false,
  
  /**
   * מציג צירים (X=אדום, Y=ירוק, Z=כחול)
   */
  showAxes: false,
  
};

// ============================================
// פרופילי הגדרות מוכנים
// ============================================

/**
 * פרופילים שונים לשימוש מהיר
 * העתק את ההגדרות מהפרופיל הרצוי אל BUS_3D_CONFIG
 */
const PROFILES = {
  
  // פרופיל ברירת מחדל
  default: {
    modelScale: 45,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.15,
  },
  
  // מודל גדול ובולט
  large: {
    modelScale: 65,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.15,
  },
  
  // מודל קטן ודיסקרטי
  small: {
    modelScale: 30,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.15,
  },
  
  // תנועה מהירה וחדה
  fastResponse: {
    modelScale: 45,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.30,
    animationDuration: 1000,
  },
  
  // תנועה איטית וחלקה
  smooth: {
    modelScale: 45,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.08,
    animationDuration: 3000,
  },
  
  // ביצועים גבוהים
  performance: {
    modelScale: 35,
    yawOffsetDeg: -51.75,
    baseRotXDeg: 88.25,
    smoothingFactor: 0.20,
    animationDuration: 1500,
    useLOD: true,
    maxInstances: 50,
  },
  
};

// ============================================
// פונקציות עזר
// ============================================

/**
 * החזרת הגדרות לפרופיל מסוים
 * @param {string} profileName - שם הפרופיל (default, large, small, וכו')
 * @returns {object} הגדרות הפרופיל
 */
function getProfile(profileName) {
  return PROFILES[profileName] || PROFILES.default;
}

/**
 * מיזוג הגדרות פרופיל עם הגדרות בסיס
 * @param {string} profileName - שם הפרופיל
 * @returns {object} הגדרות משולבות
 */
function mergeProfile(profileName) {
  return { ...BUS_3D_CONFIG, ...getProfile(profileName) };
}

/**
 * שמירת הגדרות ל-localStorage
 */
function saveConfig() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('bus3d_config', JSON.stringify(BUS_3D_CONFIG));
      console.log('✅ Config saved to localStorage');
    } catch (e) {
      console.error('❌ Failed to save config:', e);
    }
  }
}

/**
 * טעינת הגדרות מ-localStorage
 */
function loadConfig() {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('bus3d_config');
      if (saved) {
        const config = JSON.parse(saved);
        Object.assign(BUS_3D_CONFIG, config);
        console.log('✅ Config loaded from localStorage');
      }
    } catch (e) {
      console.error('❌ Failed to load config:', e);
    }
  }
}

/**
 * איפוס הגדרות לברירת מחדל
 */
function resetConfig() {
  Object.assign(BUS_3D_CONFIG, PROFILES.default);
  saveConfig();
  console.log('✅ Config reset to default');
}

// ייצוא לשימוש בקבצים אחרים
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BUS_3D_CONFIG,
    PROFILES,
    getProfile,
    mergeProfile,
    saveConfig,
    loadConfig,
    resetConfig
  };
}

// גישה גלובלית
if (typeof window !== 'undefined') {
  window.BUS_3D_CONFIG = BUS_3D_CONFIG;
  window.BUS_3D_PROFILES = PROFILES;
  window.setBus3DProfile = (name) => {
    Object.assign(BUS_3D_CONFIG, getProfile(name));
    console.log(`✅ Profile set to: ${name}`);
  };
}

// טען הגדרות שמורות בהפעלה
loadConfig();

console.log('⚙️ Bus 3D Config loaded');
