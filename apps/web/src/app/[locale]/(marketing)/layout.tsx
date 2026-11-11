import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import { MaintenanceNotice } from '@/components/landing/MaintenanceNotice';
import { getLandingCms } from '@/components/landing/landingData';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Maintenance mode covers the whole public site, not only the home page.
  // (The fetch is cached and shared with the home page and the root layout.)
  const cms = await getLandingCms();
  if (cms?.maintenanceEnabled === true) {
    return <MaintenanceNotice cms={cms} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
