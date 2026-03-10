import { getAIProvider } from '../index';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import type { ConversationMessage } from '@mojeeb/shared-types';

interface TemplateSuggestion {
  id: string;
  title: string;
  contentEn: string;
  contentAr: string;
  category: string | null;
  relevanceScore: number;
  reasoning: string;
}

interface TemplateRanking {
  templateId: string;
  relevance: number;
  reasoning: string;
}

interface AIRankingResponse {
  suggestions: TemplateRanking[];
}

const SUGGESTION_SYSTEM_PROMPT = `You are a template suggestion assistant. Given a conversation context and a list of available message templates, identify the top 3 most relevant templates.

Rules:
- Analyze the conversation to understand the customer's needs and situation
- Consider the template category and content to determine relevance
- Return a relevance score from 0.0 to 1.0 (1.0 = highly relevant, 0.0 = not relevant)
- Provide a brief reasoning (1 sentence) for each suggestion
- Return templates in order of relevance (most relevant first)
- Return at most 3 templates
- If no templates are relevant (all below 0.3), return an empty array

Output format (JSON):
{
  "suggestions": [
    {
      "templateId": "template_id_here",
      "relevance": 0.95,
      "reasoning": "This template addresses the customer's shipping inquiry directly"
    }
  ]
}`;

export class TemplateSuggestionPipeline {
  /**
   * Suggest relevant templates based on conversation context.
   * Analyzes last 3 messages and returns top 3 relevant templates.
   */
  async suggest(params: {
    conversationId: string;
    orgId: string;
    userId?: string;
  }): Promise<TemplateSuggestion[]> {
    try {
      // 1. Load conversation context (last 3 messages)
      const messages = await prisma.message.findMany({
        where: { conversationId: params.conversationId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { role: true, content: true, contentType: true },
      });

      if (messages.length === 0) {
        return [];
      }

      const contextMessages: ConversationMessage[] = messages
        .reverse()
        .filter((m) => m.role !== 'SYSTEM')
        .map((m) => ({
          role: m.role === 'CUSTOMER' ? ('user' as const) : ('assistant' as const),
          content: this.annotateContentText(m.content, m.contentType as string),
        }));

      // 2. Fetch available templates (active only)
      const templates = await prisma.messageTemplate.findMany({
        where: {
          orgId: params.orgId,
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          contentEn: true,
          contentAr: true,
          category: true,
        },
        take: 20, // Limit to avoid large context
      });

      if (templates.length === 0) {
        return [];
      }

      // 3. Build template list for AI
      const templateList = templates.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category || 'uncategorized',
        contentPreview: t.contentEn.substring(0, 100),
      }));

      // 4. Use AI to rank templates
      const provider = getAIProvider('OPENAI');

      const prompt = `Recent conversation:
${contextMessages.map((m) => `${m.role}: ${m.content}`).join('\n')}

Available templates:
${JSON.stringify(templateList, null, 2)}

Which templates are most relevant for this conversation? Return top 3.`;

      const result = await provider.generateJSON<AIRankingResponse>({
        systemPrompt: SUGGESTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        maxTokens: 500,
        model: 'gpt-4o-mini',
      });

      // 5. Filter and sort by relevance (threshold: 0.3)
      const relevantTemplates = result.suggestions
        .filter((s) => s.relevance >= 0.3)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3);

      // 6. Map back to full template data
      const suggestions = relevantTemplates
        .map((ranking) => {
          const template = templates.find((t) => t.id === ranking.templateId);
          if (!template) return null;

          return {
            id: template.id,
            title: template.title,
            contentEn: template.contentEn,
            contentAr: template.contentAr,
            category: template.category,
            relevanceScore: ranking.relevance,
            reasoning: ranking.reasoning,
          } as TemplateSuggestion;
        })
        .filter((s): s is TemplateSuggestion => s !== null);

      logger.info(
        {
          conversationId: params.conversationId,
          totalTemplates: templates.length,
          suggestionsCount: suggestions.length,
        },
        'Template suggestions generated'
      );

      return suggestions;
    } catch (err) {
      logger.error({ err, conversationId: params.conversationId }, 'Template suggestion failed');
      return [];
    }
  }

  private annotateContentText(content: string, contentType: string): string {
    switch (contentType) {
      case 'IMAGE':
        return `[Customer sent image: ${content}]`;
      case 'VIDEO':
        return `[Customer sent video: ${content}]`;
      case 'AUDIO':
        return `[Customer sent audio: ${content}]`;
      case 'DOCUMENT':
        return `[Customer sent document: ${content}]`;
      default:
        return content;
    }
  }
}

export const templateSuggestionPipeline = new TemplateSuggestionPipeline();
