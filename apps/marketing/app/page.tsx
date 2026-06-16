import { AnimatedTestimonials, type Testimonial } from "../components/ui/animated-testimonials";
import { FeatureCarousel, type TemplateSlide } from "../components/ui/feature-carousel";
import { PricingCard, type PricingPlan } from "../components/ui/pricing-card";

const ONBOARDING_PATH = "/onboarding";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";
const inviteUrl = process.env.NEXT_PUBLIC_INVITE_URL ?? appUrl;

function absoluteUrl(base: string, path: string) {
  return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
}

const ctaHref = absoluteUrl(appUrl, ONBOARDING_PATH);

const steps = [
  {
    label: "בוחרים עיצוב",
    detail: "מתחילים מתבנית אמיתית שקיימת במערכת, לא מציור דמו ריק.",
  },
  {
    label: "מוסיפים פרטים",
    detail: "שמות, תאריך, אולם, זמני הערב ופרטי הגעה נכנסים לטופס קצר.",
  },
  {
    label: "משתפים קישור",
    detail: "הקישור נשלח בקלות בווטסאפ, עם כתובת הזמנה ציבורית לפי אירוע.",
  },
  {
    label: "עוקבים אחרי אישורי הגעה",
    detail: "הדשבורד מרכז משפחות, סטטוסים, כמויות והודעות בלי קובץ מפוצל.",
  },
];

// Screenshots drop into apps/marketing/public/templates/<id>.png (see README there).
// Until a file exists the carousel renders a branded placeholder, so the section
// looks intentional now and swaps to the real screenshot with zero code change.
const templates: TemplateSlide[] = [
  {
    id: "wedding-modern",
    name: "Modern",
    tone: "רטרו צבעוני",
    description: "ירוק, חרדל וכתום עם כרטיס RSVP בולט. הזמנה שנראית כמו מותג, לא כמו טופס.",
    src: "/templates/wedding-modern.png",
    alt: "תצוגה מקדימה של עיצוב Modern להזמנת חתונה",
  },
  {
    id: "elegant",
    name: "Elegant",
    tone: "בוהו אלגנטי",
    description: "קרם, ירוק עמוק וזהב שמפניה. שקט, מוקפד, ומרגיש יוקרתי בלי להתאמץ.",
    src: "/templates/elegant.png",
    alt: "תצוגה מקדימה של עיצוב Elegant להזמנת חתונה",
  },
  {
    id: "wedding-default",
    name: "Default",
    tone: "קלאסי חם",
    description: "בורדו וקרם עם פרחים ודקורציה. הקלאסיקה שמתאימה כמעט לכל אולם.",
    src: "/templates/wedding-default.png",
    alt: "תצוגה מקדימה של עיצוב Default להזמנת חתונה",
  },
];

const plans: PricingPlan[] = [
  {
    title: "חינם",
    price: "₪0",
    priceDescription: "בלי כרטיס אשראי, בלי תפוגה",
    description: "כל מה שצריך כדי להקים הזמנה יפה ולשלוח אותה לכל המוזמנים.",
    features: [
      "יצירת הזמנה דיגיטלית",
      "שיתוף קישור בווטסאפ",
      "ניהול פרטי אירוע ועיצוב",
      "מעקב RSVP בסיסי עד 20 אורחים",
    ],
    buttonText: "צרו הזמנה בחינם",
    buttonHref: ctaHref,
    badge: "זמין עכשיו",
  },
  {
    title: "מתקדם",
    priceDescription: "התמחור ייפתח בהמשך — בינתיים הכול פתוח בחינם",
    description: "כשהרשימה גדלה: ייבוא אקסל, אוטומציית וואטסאפ והודעות לקבוצות.",
    features: [
      "ייבוא וייצוא אורחים באקסל",
      "אוטומציית וואטסאפ וציר זמן",
      "שליחת הודעות לקבוצות אורחים",
      "אורחים ללא הגבלת גרסת החינם",
    ],
    buttonText: "להתחיל בחינם ולשדרג בהמשך",
    buttonHref: ctaHref,
    badge: "Pro",
    highlighted: true,
  },
];

// Placeholder reviews — swap for real couples + self-hosted photos before launch.
const testimonials: Testimonial[] = [
  {
    name: "נועה ויואב",
    designation: "התחתנו בספטמבר, תל אביב",
    quote:
      "הרכבנו את ההזמנה בערב אחד ושלחנו בווטסאפ למחרת. תוך יומיים היו לנו מאה אישורי הגעה, בלי אקסל אחד.",
    src: "https://images.unsplash.com/photo-1636041293178-808a6762ab39?q=80&w=400&h=400&auto=format&fit=crop",
  },
  {
    name: "שירה ועומר",
    designation: "חתונה בכרם, יוני",
    quote:
      "הכי אהבנו שכל המשפחה פשוט לחצה על הקישור. אפילו אמא שלי, שלא מתחברת לשום אפליקציה, אישרה הגעה לבד.",
    src: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&h=400&auto=format&fit=crop",
  },
  {
    name: "מאיה ודניאל",
    designation: "התארסו, מתכננים אביב",
    quote:
      "ניסינו שלושה כלים אחרים לפני זה. גסטו היה היחיד שבאמת נראה כמו ההזמנה שרצינו, בלי לשלם מראש.",
    src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=400&h=400&auto=format&fit=crop",
  },
  {
    name: "טל ורון",
    designation: "חתונה קטנה, חיפה",
    quote:
      "המעקב אחרי מי הגיע ומי עוד לא ענה חסך לנו ריבים שלמים. ראינו הכל במקום אחד ובזמן אמת.",
    src: "https://images.unsplash.com/photo-1624561172888-ac93c696e10c?q=80&w=400&h=400&auto=format&fit=crop",
  },
  {
    name: "ליאת ואסף",
    designation: "התחתנו במרץ, ירושלים",
    quote:
      "שלחנו תזכורת אחת בוואטסאפ לכל מי שלא ענה, והרשימה נסגרה לבד. הרגיש כאילו יש לנו מפיק צמוד לאירוע.",
    src: "https://images.unsplash.com/photo-1623582854588-d60de57fa33f?q=80&w=400&h=400&auto=format&fit=crop",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="ניווט ראשי">
        <a className="brand-mark" href="#top" aria-label="Guesto">
          <span className="brand-mark__glyph">G</span>
          <span>Guesto</span>
        </a>
        <div className="topbar__links">
          <a href="#how">איך זה עובד</a>
          <a href="#templates">עיצובים</a>
          <a href="#manage">ניהול RSVP</a>
        </div>
        <a className="topbar__cta" href={ctaHref}>
          צרו הזמנה בחינם
        </a>
      </nav>

      <section className="hero-section" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Guesto לחתונות בישראל</p>
          <h1 id="hero-title">
            <span className="hero-title__full">
              הזמנה דיגיטלית לחתונה, מוכנה לשליחה תוך כמה דקות
            </span>
            <span className="hero-title__short">
              הזמנה לחתונה
              <br />
              שמוכנה בדקות
            </span>
          </h1>
          <p className="hero-copy__sub">
            יוצרים הזמנה יפה בחינם, משתפים בווטסאפ, ומנהלים אישורי הגעה בלי אקסלים מבולגנים.
          </p>
          <div className="hero-actions">
            <a className="button button--primary" href={ctaHref}>
              צרו הזמנה בחינם
            </a>
            <a className="button button--quiet" href="#templates">
              ראו עיצובים אמיתיים
            </a>
          </div>
          <ul className="hero-trust" aria-label="למה Guesto">
            <li>ללא אקסלים</li>
            <li>RSVP בזמן אמת</li>
            <li>רשימת אורחים</li>
          </ul>
          <p className="route-note">
            ההזמנות עצמן נשארות בקישור ציבורי לפי אירוע, למשל{" "}
            <span dir="ltr">{inviteUrl.replace(/\/$/, "")}/your-slug</span>.
          </p>
        </div>

        <div className="proof-board" aria-label="המחשה של מוצר Guesto">
          <div className="invite-phone" aria-hidden="true">
            <div className="invite-phone__chrome" />
            <div className="invite-phone__screen">
              <div className="mini-template mini-template--modern">
                <span className="mini-template__stamp">RSVP</span>
                <strong>נועה ויואב</strong>
                <small>19.09.26</small>
              </div>
              <div className="rsvp-strip">
                <span>מגיעים?</span>
                <div>
                  <b>כן</b>
                  <b>לא</b>
                </div>
              </div>
            </div>
          </div>

          <div className="phone-status" aria-hidden="true">
            <span className="phone-status__dot" />
            <b>124</b>
            <span>אישרו הגעה</span>
          </div>

          <div className="dashboard-slice">
            <div className="dashboard-slice__header">
              <span>אורחים</span>
              <strong>124</strong>
            </div>
            <div className="dashboard-slice__row is-done">
              <span>משפחת כהן</span>
              <b>מגיעים</b>
            </div>
            <div className="dashboard-slice__row">
              <span>חברים מהעבודה</span>
              <b>ממתין</b>
            </div>
            <div className="dashboard-slice__row is-error">
              <span>רשומה חסרה</span>
              <b>לטיפול</b>
            </div>
          </div>
        </div>
      </section>

      <section className="process-section" id="how" aria-labelledby="how-title">
        <div className="section-heading">
          <p className="eyebrow">ארבעה צעדים</p>
          <h2 id="how-title">מהרגע שיש תאריך עד קישור שאפשר לשלוח</h2>
        </div>
        <ol className="steps-list">
          {steps.map((step, index) => (
            <li className="step-card" key={step.label}>
              <span className="step-card__num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="step-card__title">{step.label}</h3>
              <p className="step-card__detail">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="templates-section" id="templates" aria-labelledby="templates-title">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">עיצובים מוכנים לשליחה</p>
            <h2 id="templates-title">העיצוב שלכם כבר קיים — רק צריך את השמות שלכם</h2>
          </div>
          <p>
            כל תבנית כאן היא עיצוב חי שרץ על אירוע אמיתי, לא תמונת מוקאפ. בוחרים, ממלאים פרטים, ותוך דקות ההזמנה מוכנה לשליחה בווטסאפ.
          </p>
        </div>
        <FeatureCarousel items={templates} autoplay />
      </section>

      <section className="plans-section" aria-labelledby="plans-title">
        <div className="section-heading">
          <p className="eyebrow">חינם עכשיו, מתקדם כשצריך</p>
          <h2 id="plans-title">מתחילים בחינם, משדרגים רק כשהרשימה גדלה</h2>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <PricingCard key={plan.title} {...plan} />
          ))}
        </div>
      </section>

      <section className="whatsapp-section" id="manage" aria-labelledby="whatsapp-title">
        <div className="whatsapp-copy">
          <p className="eyebrow">וואטסאפ קודם</p>
          <h2 id="whatsapp-title">האורחים לא צריכים עוד אפליקציה</h2>
          <p>
            Guesto בנוי סביב המציאות של חתונות בארץ: שולחים קישור בווטסאפ, מקבלים RSVP, ורואים מי אישר, מי ממתין, ומי צריך תזכורת.
          </p>
        </div>
        <div className="message-panel" aria-label="דוגמת ניהול הודעות">
          <div className="message-panel__bubble">
            <span>היי משפחת לוי, נשמח שתאשרו הגעה</span>
            <b>נשלח</b>
          </div>
          <div className="message-panel__timeline">
            <span>טרם נשלח</span>
            <span>ממתין בתור</span>
            <span>נשלח</span>
          </div>
        </div>
      </section>

      <section className="testimonials-section" aria-labelledby="love-title">
        <div className="section-heading">
          <p className="eyebrow">זוגות שכבר שלחו</p>
          <h2 id="love-title">מה שזוגות מספרים אחרי שההזמנה יצאה</h2>
        </div>
        <AnimatedTestimonials testimonials={testimonials} autoplay />
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <p className="eyebrow">אפשר להתחיל קטן</p>
        <h2 id="final-title">בנו הזמנה, שלחו קישור, ותראו את הרשימה מתעדכנת</h2>
        <a className="button button--primary" href={ctaHref}>
          צרו הזמנה בחינם
        </a>
      </section>
    </main>
  );
}
