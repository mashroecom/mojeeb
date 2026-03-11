import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { routing } from '@/i18n/routing';
import { getDirection } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { fontEnglish, fontArabic } from '@/styles/fonts';
import { Providers } from '@/components/providers/Providers';
import '../globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mojeeb.app';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface SiteSettings {
  siteName: string;
  description: string;
  keywords: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  supportEmail: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
}

interface LandingCmsSeo {
  seoMetaTitle: string;
  seoMetaTitleAr: string;
  seoMetaDescription: string;
  seoMetaDescriptionAr: string;
  seoOgImage: string | null;
  seoGoogleAnalyticsId: string;
  seoCustomHeadCode: string | null;
  seoCustomFooterCode: string | null;
  seoFavicon: string | null;
}

async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const res = await fetch(`${API_BASE}/public/site-settings`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

async function getLandingCms(): Promise<LandingCmsSeo | null> {
  try {
    const res = await fetch(`${API_BASE}/public/landing-page`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const [settings, cms] = await Promise.all([getSiteSettings(), getLandingCms()]);

  const siteName = settings?.siteName || 'Mojeeb';
  const siteDescription = settings?.description || '';

  // CMS SEO fields override site-settings defaults
  const seoTitle = isAr ? cms?.seoMetaTitleAr : cms?.seoMetaTitle;
  const seoDescription = isAr ? cms?.seoMetaDescriptionAr : cms?.seoMetaDescription;

  const title =
    seoTitle ||
    (isAr ? `${siteName} - دعم العملاء بالذكاء الاصطناعي` : `${siteName} - AI Customer Support`);
  const description =
    seoDescription ||
    siteDescription ||
    (isAr
      ? 'منصة دعم العملاء بالذكاء الاصطناعي للشرق الأوسط. أتمتة المحادثات عبر واتساب وماسنجر وإنستغرام.'
      : 'AI-powered customer support platform for the Middle East. Automate conversations across WhatsApp, Messenger, and Instagram.');

  const keywordsStr = settings?.keywords || '';
  const keywords = keywordsStr
    ? keywordsStr.split(',').map((k) => k.trim())
    : isAr
      ? ['دعم العملاء', 'ذكاء اصطناعي', 'شات بوت', 'واتساب', 'ماسنجر', 'خدمة عملاء', siteName]
      : [
          'customer support',
          'AI chatbot',
          'WhatsApp',
          'Messenger',
          'Instagram',
          'help desk',
          siteName,
        ];

  // Favicon: CMS landing page > site-settings
  const faviconUrl = cms?.seoFavicon || settings?.faviconUrl;

  // OG Image from CMS
  const ogImage = cms?.seoOgImage
    ? cms.seoOgImage.startsWith('http')
      ? cms.seoOgImage
      : `${SITE_URL}${cms.seoOgImage}`
    : undefined;

  return {
    title: {
      default: title,
      template: isAr ? `%s | ${siteName}` : `%s | ${siteName}`,
    },
    description,
    keywords,
    authors: [{ name: siteName }],
    creator: siteName,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: '/en', ar: '/ar' },
    },
    openGraph: {
      type: 'website',
      locale: isAr ? 'ar_EG' : 'en_US',
      url: SITE_URL,
      siteName,
      title,
      description,
      ...(ogImage && { images: [{ url: ogImage, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: faviconUrl || '/icons/icon-192.png',
    },
  };
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'ar' | 'en')) {
    notFound();
  }

  const [messages, cms] = await Promise.all([getMessages(), getLandingCms()]);
  const dir = getDirection(locale);

  const gaId = cms?.seoGoogleAnalyticsId;
  const customHead = cms?.seoCustomHeadCode;
  const customFooter = cms?.seoCustomFooterCode;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Google Analytics */}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
        {/* Custom head code from CMS */}
        {customHead && (
          <Script id="custom-head" strategy="afterInteractive">
            {customHead}
          </Script>
        )}
      </head>
      <body
        className={cn(
          'min-h-screen bg-background antialiased',
          fontEnglish.variable,
          fontArabic.variable,
          dir === 'rtl' ? 'font-arabic' : 'font-english',
        )}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        {/* Custom footer code from CMS */}
        {customFooter && (
          <Script id="custom-footer" strategy="lazyOnload">
            {customFooter}
          </Script>
        )}
      </body>
    </html>
  );
}
