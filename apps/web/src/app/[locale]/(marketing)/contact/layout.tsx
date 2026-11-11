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
    path: '/contact',
    title: isAr ? 'تواصل معنا' : 'Contact us',
    description: isAr ? 'تواصل مع فريق مجيب. نرد على أي استفسار عن منصة خدمة العملاء بالذكاء الاصطناعي.' : 'Get in touch with the Mojeeb team about our AI customer support platform.',
  });
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
