import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { routing } from '@/i18n/routing';
import { getDirection } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { fontEnglish, fontArabic } from '@/styles/fonts';
import { Providers } from '@/components/providers/Providers';
import { PUBLIC_CONTENT_TAG } from '@/lib/publicContent';
import { DEFAULT_OG_IMAGE, SITE_URL, localePath } from '@/lib/seo';
import { brandName } from '@/components/brand/Logo';
import '../globals.css';

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
      next: { revalidate: 300, tags: [PUBLIC_CONTENT_TAG] },
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
      next: { revalidate: 300, tags: [PUBLIC_CONTENT_TAG] },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

/** Column defaults of the landing-page CMS row: placeholders, not text an admin chose. */
const STOCK_SEO_TEXT = new Set([
  'Mojeeb - AI-Powered Customer Support',
  'موجيب - دعم العملاء بالذكاء الاصطناعي',
  'مجيب - دعم العملاء بالذكاء الاصطناعي',
  'Automate your customer support with intelligent AI agents',
  'أتمت دعم العملاء مع وكلاء ذكاء اصطناعي',
]);

function customSeoText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text && !STOCK_SEO_TEXT.has(text) ? text : undefined;
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0A7A63' },
    { media: '(prefers-color-scheme: dark)', color: '#09150F' },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const [settings, cms] = await Promise.all([getSiteSettings(), getLandingCms()]);

  const siteName = brandName(settings?.siteName, locale);
  const siteDescription = settings?.description || '';

  // CMS SEO fields override site-settings defaults
  // (the database's stock placeholder values count as "not set")
  const seoTitle = customSeoText(isAr ? cms?.seoMetaTitleAr : cms?.seoMetaTitle);
  const seoDescription = customSeoText(
    isAr ? cms?.seoMetaDescriptionAr : cms?.seoMetaDescription,
  );

  const title =
    seoTitle ||
    (isAr
      ? `${siteName} | موظف خدمة عملاء بالذكاء الاصطناعي على واتساب`
      : `${siteName} | AI customer support agent for WhatsApp and web`);
  const description =
    seoDescription ||
    siteDescription ||
    (isAr
      ? 'مجيب يرد على عملائك بالعربي وبلهجتهم على واتساب وموقعك، من معلومات نشاطك نفسها، ويحوّل المحادثة لفريقك وقت الحاجة. جرّبه مجاناً.'
      : 'Mojeeb answers your customers in Arabic and English on WhatsApp and your website, using your own business knowledge, and hands over to your team when needed. Try it free.');

  const keywordsStr = settings?.keywords || '';
  const keywords = keywordsStr
    ? keywordsStr.split(',').map((k) => k.trim())
    : isAr
      ? [
          'خدمة عملاء بالذكاء الاصطناعي',
          'شات بوت واتساب',
          'شات بوت عربي',
          'رد آلي واتساب',
          'دعم العملاء',
          siteName,
        ]
      : [
          'AI customer support',
          'Arabic chatbot',
          'WhatsApp chatbot',
          'AI agent',
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
    : DEFAULT_OG_IMAGE;

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
    applicationName: siteName,
    manifest: '/manifest.json',
    openGraph: {
      type: 'website',
      locale: isAr ? 'ar_EG' : 'en_US',
      alternateLocale: isAr ? 'en_US' : 'ar_EG',
      url: localePath(locale),
      siteName,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: faviconUrl || [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' },
      ],
      apple: '/icons/apple-touch-icon.png',
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
