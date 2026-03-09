import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import { LandingContent } from '@/components/landing/LandingContent';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <LandingContent />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
