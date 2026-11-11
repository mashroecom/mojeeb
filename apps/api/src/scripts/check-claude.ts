/* eslint-disable no-console -- CLI script: console output is the interface */
/**
 * Checks the Claude integration with the configured ANTHROPIC_API_KEY:
 *
 *   pnpm --filter @mojeeb/api exec tsx src/scripts/check-claude.ts
 *
 * Makes two small real requests (a reply and a structured-JSON side task) and
 * prints what came back. Costs a few hundred tokens.
 */
import '../config';
import { getAIProvider } from '../ai';

async function main() {
  const provider = getAIProvider('ANTHROPIC');

  const reply = await provider.generateResponse({
    systemPrompt: 'You are a concise customer-support assistant for a bakery.',
    messages: [{ role: 'user', content: 'Do you sell birthday cakes? Answer in one sentence.' }],
    temperature: 0.7,
    maxTokens: 512,
  });
  console.log(`reply   [${reply.model}] ${reply.content.replace(/\s+/g, ' ').slice(0, 160)}`);
  console.log(`tokens  in=${reply.tokensUsed.prompt} out=${reply.tokensUsed.completion}`);

  const analysis = await provider.generateJSON<{
    emotion: string;
    isLead: boolean;
    email: string | null;
  }>({
    systemPrompt:
      'Classify the customer message. Return JSON with keys: emotion (one of happy, neutral, frustrated, angry), isLead (boolean), email (string or null).',
    messages: [
      {
        role: 'user',
        content: 'This is the third time my order is late! Email me at sara@example.com',
      },
    ],
    temperature: 0,
    maxTokens: 256,
  });
  console.log(`json    ${JSON.stringify(analysis)}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Claude check failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
