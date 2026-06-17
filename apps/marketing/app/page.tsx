import { AnimatedTestimonials, type Testimonial } from "../components/ui/animated-testimonials";
import { FeatureCarousel, type TemplateSlide } from "../components/ui/feature-carousel";
import { PricingCard, type PricingPlan } from "../components/ui/pricing-card";
import Logo from "../components/Logo";

const ONBOARDING_PATH = "/onboarding";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:5173";

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

// Each slide centers on a LIVE event page (previewUrl) so the real invite
// animates in-frame, exactly like the dashboard mobile preview. The screenshot
// (src) is the cheap fallback for the blurred side cards / slow loads.
const templates: TemplateSlide[] = [
  {
    id: "punk-poster",
    name: "Punk",
    tone: "פוסטר הופעה",
    description: "שחור, ורוד לוהט וטיפוגרפיה של פוסטר רוק קרוע. נועז, קולני ובלתי נשכח.",
    src: "/templates/punk-poster.png",
    alt: "תצוגה מקדימה של עיצוב Punk להזמנת חתונה",
    previewUrl: absoluteUrl(appUrl, "hagit-and-itai"),
  },
  {
    id: "wedding-modern",
    name: "Modern",
    tone: "מודרני גרפי",
    description: "קרם, אדום עז וטיפוגרפיה ענקית בהשראת עריכה גרפית. מינימליסטי, חד ובטוח בעצמו.",
    src: "/templates/wedding-modern.png",
    alt: "תצוגה מקדימה של עיצוב Modern להזמנת חתונה",
    previewUrl: absoluteUrl(appUrl, "הדר-and-ניר-rymizj"),
  },
  {
    id: "wedding-default",
    name: "Default",
    tone: "קלאסי חם",
    description: "בורדו וקרם עם פרחים ודקורציה. הקלאסיקה שמתאימה כמעט לכל אולם.",
    src: "/templates/wedding-default.png",
    alt: "תצוגה מקדימה של עיצוב Default להזמנת חתונה",
    previewUrl: absoluteUrl(appUrl, "mor-and-eyal"),
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

// Placeholder reviews — swap quotes/names for real couples before launch.
// Photos are self-hosted in public/testimonials/ (couple-1..4.jpg).
const testimonials: Testimonial[] = [
  {
    name: "נועה ויואב",
    designation: "התחתנו בספטמבר, תל אביב",
    quote:
      "הרכבנו את ההזמנה בערב אחד ושלחנו בווטסאפ למחרת. תוך יומיים היו לנו מאה אישורי הגעה, בלי אקסל אחד.",
    src: "/testimonials/couple-1.jpg",
  },
  {
    name: "שירה ועומר",
    designation: "חתונה בכרם, יוני",
    quote:
      "הכי אהבנו שכל המשפחה פשוט לחצה על הקישור. אפילו אמא שלי, שלא מתחברת לשום אפליקציה, אישרה הגעה לבד.",
    src: "/testimonials/couple-2.jpg",
  },
  {
    name: "מאיה ודניאל",
    designation: "התארסו, מתכננים אביב",
    quote:
      "ניסינו שלושה כלים אחרים לפני זה. גסטו היה היחיד שבאמת נראה כמו ההזמנה שרצינו, בלי לשלם מראש.",
    src: "/testimonials/couple-3.jpg",
  },
  {
    name: "טל ורון",
    designation: "חתונה קטנה, חיפה",
    quote:
      "המעקב אחרי מי הגיע ומי עוד לא ענה חסך לנו ריבים שלמים. ראינו הכל במקום אחד ובזמן אמת.",
    src: "/testimonials/couple-4.jpg",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="ניווט ראשי">
        <a className="brand-mark" href="#top" aria-label="Guesto">
          <Logo variant="onLight" height={30} />
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
            <span dir="ltr">guesto.co.il/your-name</span>.
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
            <h2 id="templates-title">העיצוב שלכם כבר קיים רק צריך את השמות שלכם</h2>
          </div>
          <p>
            כל תבנית כאן היא עיצוב חי שרץ על אירוע אמיתי, לא תמונת מוקאפ. בוחרים, ממלאים פרטים, ותוך דקות ההזמנה מוכנה לשליחה בווטסאפ.
          </p>
        </div>
        <FeatureCarousel items={templates} />
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
