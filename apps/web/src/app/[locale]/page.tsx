import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ChatWidget } from '@/components/ChatWidget';
import { LandingContent } from '@/components/landing/LandingContent';
import { MaintenanceNotice } from '@/components/landing/MaintenanceNotice';
import { CustomStyles } from '@/components/landing/CustomStyles';
import type { Metadata } from 'next';
import { getLandingPageData } from '@/components/landing/landingData';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_URL, absoluteUrl, alternatesFor, localePath, siteNameFor } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: alternatesFor(locale) };
}

/**
 * Public home page. The landing-page CMS content, testimonials, FAQs and plans
 * are loaded here on the server and passed down as props, so the HTML already
 * contains the CMS content and the client hydrates from the very same data.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const { cms, testimonials, faqs, plans } = await getLandingPageData();

  // Maintenance mode (CMS toggle or Site Settings): the API then returns only
  // the maintenance texts, and the notice replaces the whole landing page.
  if (cms?.maintenanceEnabled === true) {
    return <MaintenanceNotice cms={cms} />;
  }

  const siteName = siteNameFor(locale);
  const pageUrl = absoluteUrl(localePath(locale));
  const description = isAr
    ? 'موظف خدمة عملاء بالذكاء الاصطناعي يرد على عملائك بالعربي على واتساب وموقعك.'
    : 'An AI customer support agent that answers your customers in Arabic and English on WhatsApp and your website.';
  const faqEntities = faqs
    .map((f) => ({
      question: (isAr ? f.questionAr || f.question : f.question || f.questionAr) || '',
      answer: (isAr ? f.answerAr || f.answer : f.answer || f.answerAr) || '',
    }))
    .filter((f) => f.question && f.answer);

  const structuredData: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Mojeeb',
      alternateName: 'مجيب',
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: siteName,
      url: pageUrl,
      inLanguage: isAr ? 'ar' : 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description,
      inLanguage: isAr ? 'ar' : 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    ...(faqEntities.length > 0
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqEntities.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <CustomStyles css={cms?.customCss ?? null} />
      <JsonLd data={structuredData} />
      <Header />
      <main className="flex-1">
        <LandingContent cms={cms} testimonials={testimonials} faqs={faqs} plans={plans} />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
