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
    path: '/privacy',
    title: isAr ? 'سياسة الخصوصية' : 'Privacy Policy',
    description: isAr ? 'سياسة الخصوصية لمنصة مجيب: كيف نحمي بياناتك وبيانات عملائك ونستخدمها.' : 'The Mojeeb Privacy Policy: how we protect and use your data and the data of your customers.',
  });
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
