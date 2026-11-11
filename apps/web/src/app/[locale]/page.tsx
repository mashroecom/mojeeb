import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import { LandingContent } from '@/components/landing/LandingContent';
import { MaintenanceNotice } from '@/components/landing/MaintenanceNotice';
import { CustomStyles } from '@/components/landing/CustomStyles';
import { getLandingPageData } from '@/components/landing/landingData';

/**
 * Public home page. The landing-page CMS content, testimonials, FAQs and plans
 * are loaded here on the server and passed down as props, so the HTML already
 * contains the CMS content and the client hydrates from the very same data.
 */
export default async function HomePage() {
  const { cms, testimonials, faqs, plans } = await getLandingPageData();

  // Maintenance mode (CMS toggle or Site Settings): the API then returns only
  // the maintenance texts, and the notice replaces the whole landing page.
  if (cms?.maintenanceEnabled === true) {
    return <MaintenanceNotice cms={cms} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <CustomStyles css={cms?.customCss ?? null} />
      <Header />
      <main className="flex-1">
        <LandingContent cms={cms} testimonials={testimonials} faqs={faqs} plans={plans} />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
