import checkoutAgent from './checkoutAgent.js';
import upsellAgent from './upsellAgent.js';
import campaignAgent from './campaignAgent.js';
import buyerAgent from './buyerAgent.js';
import { callLLM } from './llmClient.js';

export class AgentOrchestrator {
  constructor() {
    this.agents = {
      checkout: checkoutAgent,
      upsell: upsellAgent,
      campaign: campaignAgent,
      buyer: buyerAgent
    };
  }

  /**
   * Routes incoming intent to appropriate sub-agent
   */
  async routeIntent(input) {
    const { message, intent } = input;
    if (intent) return intent;

    const lower = (message || '').toLowerCase();
    if (lower.includes('campaign') || lower.includes('discount') || lower.includes('clearance') || lower.includes('slow moving')) {
      return 'campaign';
    }
    if (lower.includes('upsell') || lower.includes('recommend') || lower.includes('bundle') || lower.includes('complement')) {
      return 'upsell';
    }
    if (lower.includes('autonomous') || lower.includes('ai buyer') || lower.includes('simulate buyer')) {
      return 'buyer';
    }
    return 'checkout';
  }
}

export const orchestrator = new AgentOrchestrator();
export default orchestrator;
