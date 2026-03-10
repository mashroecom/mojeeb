import { getAIProvider } from '../index';
import { buildAnalysisPrompt } from '../prompts/analysis';
import type {
  EmotionResult,
  RoutingDecision,
  LeadResult,
  ConversationMessage,
  ExtractedCustomerData,
} from '@mojeeb/shared-types';
import { logger } from '../../config/logger';

/**
 * Human-request patterns checked before AI call (zero cost).
 */
const HUMAN_REQUEST_PATTERNS = [
  // English patterns
  /talk to (a |an )?(human|agent|person|representative)/i,
  /speak (to|with) (a )?(human|agent|person|someone)/i,
  /real person/i,
  /transfer (me )?(to )?(a )?(human|agent|person|support)/i,
  /connect me (to|with) (a )?(human|agent|person|support)/i,
  /i (want|need) (a )?human/i,
  /don'?t want (to talk to )?(a |the )?(bot|ai|robot|machine)/i,
  // Arabic patterns — MSA
  /اريد التحدث مع (شخص|موظف|إنسان|انسان|حد|أحد|احد)/,
  /أريد (شخص|موظف) حقيقي/,
  /وصلني (بـ?|ب)(موظف|شخص|حد|أحد|الدعم)/,
  /كلم(ني|وني)? (موظف|شخص|حد|أحد)/,
  /تحدث مع (موظف|شخص|إنسان|انسان|حد|أحد)/,
  /حول(ني|لي) (على|ل|إلى|الى)(موظف|شخص|الدعم|حد)/,
  /ممكن (احد|أحد|حد) يساعدني/,
  // Arabic patterns — Egyptian dialect
  /عايز (اتكلم|أتكلم|اكلم|أكلم) (مع )?(موظف|شخص|حد|أحد)/,
  /عايز (حد|أحد) (يساعدني|من الدعم|حقيقي)/,
  /مش عايز (اتكلم|أتكلم|اكلم) (مع )?(بوت|روبوت|ذكاء)/,
  // Arabic patterns — Gulf/Saudi dialect
  /ابي (اتكلم|أتكلم|اكلم|أكلم) (مع )?(موظف|شخص|حد|أحد)/,
  /ابغى (اتكلم|أتكلم|اكلم|أكلم) (مع )?(موظف|شخص|حد|أحد)/,
  // Generic "I don't want a bot" in Arabic
  /(مش |ما |لا )?(عايز|أريد|اريد|ابي|ابغى) (بوت|روبوت)/,
];

export interface AnalysisResult {
  emotion: EmotionResult | null;
  lead: LeadResult | null;
  routing: RoutingDecision;
  category: string | null;
  extractedData: ExtractedCustomerData | null;
  quickReplies: string[];
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
  category: { category: string; confidence: number };
  extractedData: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    address: string | null;
    orderNumber: string | null;
  };
  quickReplies: string[];
}

const DEFAULT_RESULT: AnalysisResult = {
  emotion: null,
  lead: null,
  routing: { shouldHandoff: false, reason: '', confidence: 0 },
  category: null,
  extractedData: null,
  quickReplies: [],
};

export class AnalysisPipeline {
  /**
   * Run emotion + lead + routing + data extraction + quick replies in a single GPT-4o-mini call.
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
      dataCollectionFields?: string[];
      escalationKeywords?: string[];
      sentimentEscalation?: boolean;
      escalationMessageCount?: number;
      enableQuickReplies?: boolean;
    },
  ): Promise<AnalysisResult> {
    // Fast rule-based routing check first (no API call)
    if (options.enableRouting) {
      // Custom keyword-based escalation
      if (options.escalationKeywords?.length) {
        const lowerMessage = message.toLowerCase();
        const matchedKeyword = options.escalationKeywords.find((kw) =>
          lowerMessage.includes(kw.toLowerCase()),
        );
        if (matchedKeyword) {
          return {
            ...DEFAULT_RESULT,
            routing: {
              shouldHandoff: true,
              reason: `Escalation keyword detected: "${matchedKeyword}"`,
              confidence: 0.9,
            },
          };
        }
      }

      if (HUMAN_REQUEST_PATTERNS.some((p) => p.test(message))) {
        return {
          ...DEFAULT_RESULT,
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
          ...DEFAULT_RESULT,
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
      return { ...DEFAULT_RESULT };
    }

    try {
      const provider = getAIProvider('OPENAI');

      // Use only last 5 messages for analysis (saves tokens)
      const trimmedHistory = history.slice(-5);

      const result = await provider.generateJSON<CombinedJSON>({
        systemPrompt: buildAnalysisPrompt(
          options.language,
          options.agentDescription,
          options.agentName,
          options.dataCollectionFields,
        ),
        messages: [...trimmedHistory, { role: 'user', content: message }],
        temperature: 0.1,
        maxTokens: 500,
        model: 'gpt-4o-mini',
      });

      // Parse emotion
      const emotion: EmotionResult | null =
        options.enableEmotion && result.emotion
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

      // Parse category
      const category = result.category?.category || null;

      // Parse extracted customer data
      const extractedData: ExtractedCustomerData | null = result.extractedData
        ? {
            name: result.extractedData.name || null,
            email: result.extractedData.email || null,
            phone: result.extractedData.phone || null,
            company: result.extractedData.company || null,
            address: result.extractedData.address || null,
            orderNumber: result.extractedData.orderNumber || null,
          }
        : null;

      // Parse quick replies
      const quickReplies = Array.isArray(result.quickReplies)
        ? result.quickReplies.filter((r) => typeof r === 'string' && r.length > 0).slice(0, 4)
        : [];

      // Cross-check: high anger → handoff (configurable message threshold)
      const customerMsgCount = history.filter((m) => m.role === 'user').length;
      const minMessagesForEscalation = options.escalationMessageCount || 5;

      logger.info(
        { customerMsgCount, aiWantsHandoff: routing.shouldHandoff, aiReason: routing.reason },
        'Handoff decision debug',
      );

      // Sentiment-based escalation: only trigger after enough messages
      if (
        emotion &&
        options.enableRouting &&
        options.sentimentEscalation &&
        !routing.shouldHandoff &&
        ['angry', 'frustrated'].includes(emotion.emotion) &&
        emotion.score > Math.max(options.handoffThreshold, 0.7) &&
        customerMsgCount >= minMessagesForEscalation
      ) {
        routing = {
          shouldHandoff: true,
          reason: `${emotion.emotion} detected with score ${emotion.score} after ${customerMsgCount} messages`,
          confidence: emotion.score,
        };
      }

      return { emotion, lead, routing, category, extractedData, quickReplies };
    } catch (err) {
      logger.error({ err }, 'Combined analysis failed');
      return { ...DEFAULT_RESULT };
    }
  }
}

export const analysisPipeline = new AnalysisPipeline();
