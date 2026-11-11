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
    path: '/request-demo',
    title: isAr ? 'اطلب عرضاً توضيحياً مجاناً' : 'Request a free demo',
    description: isAr ? 'احجز عرضاً توضيحياً مجاناً مع فريق مجيب وشاهد كيف يرد الذكاء الاصطناعي على عملائك.' : 'Book a free demo with the Mojeeb team and see an AI agent answer your customers.',
  });
}

export default function RequestDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
