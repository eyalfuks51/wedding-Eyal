import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/brand/Logo';
import SiteFooter from '@/components/brand/SiteFooter';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Already signed in → skip login
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const handleGoogleLogin = async () => {
    await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex flex-col font-brand">
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm text-center">
          <div className="flex justify-center mb-4">
            <Logo variant="onLight" height={42} />
          </div>
          <p className="text-slate-500 text-sm mb-8">התחברו לניהול האירוע שלכם</p>
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-5 h-5"
            />
            המשיכו עם Google
          </button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
