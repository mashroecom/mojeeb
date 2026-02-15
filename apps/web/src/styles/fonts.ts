import { Inter } from 'next/font/google';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';

export const fontEnglish = Inter({
  subsets: ['latin'],
  variable: '--font-english',
  display: 'swap',
});

export const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});
