import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { DashboardTopbar } from '@/components/layout/DashboardTopbar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <AdminSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <DashboardTopbar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/30">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminGuard>
  );
}
