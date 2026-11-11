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
    path: '/faq',
    title: isAr ? 'الأسئلة الشائعة' : 'Frequently asked questions',
    description: isAr ? 'إجابات عن أكثر الأسئلة شيوعاً حول مجيب: الإعداد، القنوات، اللغات، الأسعار والأمان.' : 'Answers to common questions about Mojeeb: setup, channels, languages, pricing and security.',
  });
}

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
