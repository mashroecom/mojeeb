import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import { LandingContent } from '@/components/landing/LandingContent';
import { CustomStyles } from '@/components/landing/CustomStyles';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <CustomStyles />
      <Header />
      <main className="flex-1">
        <LandingContent />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
