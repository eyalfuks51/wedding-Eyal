import DashboardNav from '@/components/dashboard/DashboardNav';

export default function AutomationTimeline() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-brand" dir="rtl">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">⏱</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 font-danidin leading-none">
              ציר זמן אוטומציה
            </h1>
            <p className="text-xs text-slate-400 font-brand mt-0.5">hagit-and-itai</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav />
        <p className="font-brand text-slate-500">טוען...</p>
      </main>
    </div>
  );
}
