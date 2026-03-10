import { MobileNav } from '@/components/mobile/MobileNav';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ui/Toast';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
          <main className="flex-1 overflow-y-auto pb-16">
            <ErrorBoundary>
              <div className="animate-page-in">
                {children}
              </div>
            </ErrorBoundary>
          </main>
          <MobileNav />
        </div>
      </ToastProvider>
    </AuthGuard>
  );
}
