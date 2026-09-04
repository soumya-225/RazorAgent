import OpenAI from 'openai';
import config from '../config/env.js';

let openaiClient = null;
if (config.openaiApiKey) {
  try {
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    console.log(`🧠 OpenAI Client: Connected (${config.openaiModel})`);
  } catch (err) {
    console.warn('OpenAI Client init error:', err.message);
  }
} else {
  console.log('🧠 OpenAI Client: No API Key provided in .env — using intelligent agent fallback engine');
}

export async function callLLM({ systemPrompt, messages = [], tools = [], responseFormat = null, temperature = 0.2 }) {
  if (openaiClient && config.openaiApiKey) {
    try {
      const payload = {
        model: config.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature
      };

      if (tools && tools.length > 0) {
        payload.tools = tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters || t.input_schema
          }
        }));
      }

      if (responseFormat) {
        payload.response_format = responseFormat;
      }

      const response = await openaiClient.chat.completions.create(payload);
      const choice = response.choices[0];
      return {
        content: choice.message.content,
        tool_calls: choice.message.tool_calls || [],
        usage: response.usage
      };
    } catch (err) {
      console.warn('OpenAI API call failed, using intelligent rule-based fallback:', err.message);
    }
  }

  // Intelligent Agent Fallback Engine
  return {
    content: null,
    tool_calls: [],
    fallback: true
  };
}

export default { callLLM };
