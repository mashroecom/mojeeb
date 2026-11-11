import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return pageMetadata({
    locale,
    path: '/terms',
    title: isAr ? 'شروط الخدمة' : 'Terms of Service',
    description: isAr ? 'شروط استخدام منصة مجيب لخدمة العملاء بالذكاء الاصطناعي.' : 'Terms of Service for the Mojeeb AI customer support platform.',
  });
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
