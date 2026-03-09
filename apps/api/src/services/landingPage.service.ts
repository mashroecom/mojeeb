import { prisma } from '../config/database';
import { sanitizeCss } from '../utils/cssSanitizer';

export class LandingPageService {
  async get() {
    let content = await prisma.landingPageContent.findUnique({
      where: { id: 'singleton' },
    });

    if (!content) {
      content = await prisma.landingPageContent.create({
        data: { id: 'singleton' },
      });
    }

    return content;
  }

  async update(data: Record<string, unknown>) {
    // Remove id and updatedAt from update data
    const { id, updatedAt, ...updateData } = data as any;

    // Sanitize customCss if present to prevent CSS injection attacks
    if (updateData.customCss !== undefined && updateData.customCss !== null) {
      updateData.customCss = sanitizeCss(updateData.customCss as string);
    }

    const content = await prisma.landingPageContent.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...updateData },
      update: updateData,
    });

    return content;
  }
}

export const landingPageService = new LandingPageService();
