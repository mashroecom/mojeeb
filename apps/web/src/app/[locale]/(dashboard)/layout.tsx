import { DashboardSidebar } from '@/components/layout/DashboardSidebar';
import { DashboardTopbar } from '@/components/layout/DashboardTopbar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner';
import { ToastProvider } from '@/components/ui/Toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <SidebarProvider>
          <div className="flex h-screen overflow-hidden">
            <DashboardSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <DashboardTopbar />
              <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/30">
                <AnnouncementBanner />
                <ErrorBoundary>
                  <div className="animate-page-in">
                    {children}
                  </div>
                </ErrorBoundary>
              </main>
            </div>
          </div>
        </SidebarProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
