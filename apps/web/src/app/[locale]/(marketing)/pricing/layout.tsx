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
    path: '/pricing',
    title: isAr ? 'الأسعار' : 'Pricing',
    description: isAr ? 'أسعار مجيب: ابدأ مجاناً وادفع حسب عدد الرسائل والوكلاء. بدون بطاقة ائتمان.' : 'Mojeeb pricing: start free and pay as your messages and agents grow. No credit card required.',
  });
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
