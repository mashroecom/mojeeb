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
    path: '/about',
    title: isAr ? 'عن مجيب' : 'About Mojeeb',
    description: isAr ? 'تعرّف على مجيب: منصة خدمة عملاء بالذكاء الاصطناعي مبنية للعربية أولاً. مهمتنا ورؤيتنا وفريقنا.' : 'Meet Mojeeb, the Arabic-first AI customer support platform. Our mission, vision and team.',
  });
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
