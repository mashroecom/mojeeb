import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === 'ar';
  return {
    title: isAr ? 'تواصل معنا' : 'Contact Us',
    description: isAr
      ? 'تواصل مع فريق موجيب. نحن هنا لمساعدتك في أي استفسار حول منصة دعم العملاء بالذكاء الاصطناعي.'
      : 'Get in touch with the Mojeeb team. We are here to help with any questions about our AI customer support platform.',
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
