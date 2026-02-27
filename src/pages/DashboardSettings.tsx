import DashboardNav from '@/components/dashboard/DashboardNav';

const SLUG = 'hagit-and-itai';

export default function DashboardSettings() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardNav />
        <h1 className="text-2xl font-danidin text-slate-800 mb-6">הגדרות האירוע</h1>
        <p className="text-slate-500 font-brand">בקרוב...</p>
      </div>
    </div>
  );
}
