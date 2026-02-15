import { getAIProvider } from '../index';
import { buildAnalysisPrompt } from '../prompts/analysis';
import type { EmotionResult, RoutingDecision, LeadResult, ConversationMessage } from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

/**
 * Human-request patterns checked before AI call (zero cost).
 */
const HUMAN_REQUEST_PATTERNS = [
  /talk to (a |an )?(human|agent|person|representative)/i,
  /speak (to|with) (a )?(human|agent|person|someone)/i,
  /real person/i,
  /اريد التحدث مع (شخص|موظف|إنسان|انسان)/,
  /ممكن (احد|أحد) يساعدني/,
  /أريد (شخص|موظف) حقيقي/,
  /وصلني (بـ|ب)(موظف|شخص)/,
  /كلم(ني|وني)? (موظف|شخص)/,
  /تحدث مع (موظف|شخص|إنسان|انسان)/,
  /ابي (اتكلم|أتكلم|اكلم|أكلم) (مع )?(موظف|شخص)/,
  /عايز (اتكلم|أتكلم|اكلم|أكلم) (مع )?(موظف|شخص)/,
  /حول(ني|لي) (على|ل)(موظف|شخص|الدعم)/,
];

export interface AnalysisResult {
  emotion: EmotionResult | null;
  lead: LeadResult | null;
  routing: RoutingDecision;
}

interface CombinedJSON {
  emotion: { emotion: string; score: number; reasoning: string };
  lead: {
    isLead: boolean;
    confidence: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    interests: string[];
    budget: string | null;
    timeline: string | null;
    notes: string;
  };
  routing: { handoff: boolean; reason: string; confidence: number };
}

export class AnalysisPipeline {
  /**
   * Run emotion + lead + routing in a single GPT-4o-mini call.
   * Falls back gracefully if the call fails.
   */
  async analyze(
    message: string,
    history: ConversationMessage[],
    options: {
      enableEmotion: boolean;
      enableLead: boolean;
      enableRouting: boolean;
      handoffThreshold: number;
      language?: string;
      agentDescription?: string;
      agentName?: string;
    },
  ): Promise<AnalysisResult> {
    // Fast rule-based routing check first (no API call)
    if (options.enableRouting) {
      if (HUMAN_REQUEST_PATTERNS.some((p) => p.test(message))) {
        return {
          emotion: null,
          lead: null,
          routing: {
            shouldHandoff: true,
            reason: 'Customer explicitly requested human agent',
            confidence: 1.0,
          },
        };
      }

      // Repeated message check
      const customerMessages = history
        .filter((m) => m.role === 'user')
        .slice(-3)
        .map((m) => (typeof m.content === 'string' ? m.content : '').toLowerCase().trim());
      if (customerMessages.length >= 3 && new Set(customerMessages).size === 1) {
        return {
          emotion: null,
          lead: null,
          routing: {
            shouldHandoff: true,
            reason: 'Customer repeating same message - AI likely unhelpful',
            confidence: 0.8,
          },
        };
      }
    }

    // If nothing is enabled, skip the API call entirely
    const needsAny = options.enableEmotion || options.enableLead || options.enableRouting;
    if (!needsAny) {
      return {
        emotion: null,
        lead: null,
        routing: { shouldHandoff: false, reason: '', confidence: 0 },
      };
    }

    try {
      const provider = getAIProvider('OPENAI');

      // Use only last 5 messages for analysis (saves tokens)
      const trimmedHistory = history.slice(-5);

      const result = await provider.generateJSON<CombinedJSON>({
        systemPrompt: buildAnalysisPrompt(options.language, options.agentDescription, options.agentName),
        messages: [
          ...trimmedHistory,
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        maxTokens: 400,
        model: 'gpt-4o-mini',
      });

      // Parse emotion
      const emotion: EmotionResult | null = options.enableEmotion && result.emotion
        ? {
            emotion: (result.emotion.emotion || 'neutral') as EmotionResult['emotion'],
            score: Math.min(1, Math.max(0, result.emotion.score || 0.5)),
            reasoning: result.emotion.reasoning || '',
          }
        : null;

      // Parse lead
      let lead: LeadResult | null = null;
      if (options.enableLead && result.lead?.isLead && result.lead.confidence >= 0.5) {
        lead = {
          name: result.lead.name,
          email: result.lead.email,
          phone: result.lead.phone,
          company: result.lead.company,
          interests: result.lead.interests || [],
          budget: result.lead.budget,
          timeline: result.lead.timeline,
          confidence: result.lead.confidence,
          notes: result.lead.notes || '',
        };
      }

      // Parse routing
      let routing: RoutingDecision = { shouldHandoff: false, reason: '', confidence: 0 };
      if (options.enableRouting && result.routing) {
        routing = {
          shouldHandoff: result.routing.handoff || false,
          reason: result.routing.reason || '',
          confidence: Math.min(1, Math.max(0, result.routing.confidence || 0)),
        };
      }

      // Cross-check: high anger → handoff (only if enough messages exchanged)
      const customerMsgCount = history.filter((m) => m.role === 'user').length;

      logger.info(
        { customerMsgCount, aiWantsHandoff: routing.shouldHandoff, aiReason: routing.reason },
        'Handoff decision debug',
      );

      if (
        emotion &&
        options.enableRouting &&
        !routing.shouldHandoff &&
        ['angry', 'frustrated'].includes(emotion.emotion) &&
        emotion.score > Math.max(options.handoffThreshold, 0.7) &&
        customerMsgCount >= 5
      ) {
        routing = {
          shouldHandoff: true,
          reason: `${emotion.emotion} detected with score ${emotion.score} after ${customerMsgCount} messages`,
          confidence: emotion.score,
        };
      }

      // Safety: ALWAYS suppress AI-based handoff if fewer than 5 customer messages
      // (explicit human requests are already caught by rule-based check above)
      if (routing.shouldHandoff && customerMsgCount < 5) {
        logger.info(
          { customerMsgCount, suppressedReason: routing.reason },
          'Handoff SUPPRESSED - too few customer messages',
        );
        routing = {
          shouldHandoff: false,
          reason: 'Handoff suppressed - too few messages to determine need',
          confidence: 0,
        };
      }

      return { emotion, lead, routing };
    } catch (err) {
      logger.error({ err }, 'Combined analysis failed');
      return {
        emotion: null,
        lead: null,
        routing: { shouldHandoff: false, reason: 'Analysis failed', confidence: 0 },
      };
    }
  }
}

export const analysisPipeline = new AnalysisPipeline();
