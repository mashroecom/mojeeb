import { AuthGuard } from '@/components/auth/AuthGuard';
import { ToastProvider } from '@/components/ui/Toast';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <div className="min-h-screen bg-muted/30">
          {/* Logo */}
          <div className="flex justify-center pt-6 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
                  <path d="M10 22h4" />
                </svg>
              </div>
              <span className="text-xl font-bold">Mojeeb</span>
            </div>
          </div>

          <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</div>
        </div>
      </ToastProvider>
    </AuthGuard>
  );
}
