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
    path: '/features',
    title: isAr ? 'المميزات' : 'Features',
    description: isAr ? 'كل ما يقدمه مجيب: ردود بالذكاء الاصطناعي من قاعدة معرفتك، واتساب وشات الموقع في صندوق واحد، تحويل للموظفين، وتحليلات.' : 'Everything Mojeeb does: AI replies from your knowledge base, WhatsApp and web chat in one inbox, human handover and analytics.',
  });
}

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
