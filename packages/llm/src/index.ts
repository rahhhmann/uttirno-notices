import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import {
  DocumentTextSchema,
  ExtractionPlanSchema,
  PositionExtractionSchema,
  type DocumentText,
  type ExtractionPlan,
} from '@uttirno/contracts';
import { extractPositions } from '@uttirno/domain';
import prompt from './prompt.v1.json' with { type: 'json' };

export const PROMPT_VERSION = prompt.version;
export const SCHEMA_VERSION = 'position-extraction-v1';
const instruction = prompt.instruction;
const OutputSchema = z.strictObject({
  positions: z.array(PositionExtractionSchema).min(1).max(200),
});
export type ProviderOptions = {
  endpoint: string;
  model: string;
  apiKey: string;
  processorApproval: { reviewedBy: string; expiresAt: string; permitted: true };
  maxInputChars: number;
  maxOutputTokens: number;
  maxSessionTokens: number;
  maxSessionCostMicros: number;
  inputMicrosPerToken: number;
  outputMicrosPerToken: number;
  timeoutMs: number;
};
// Optional operator-controlled JSON gateway protocol, not an assumed vendor endpoint.
// Provider has text-only messages and an explicit empty tool set; no agent capabilities are passed.
export class JsonExtractionProvider {
  private tokens = 0;
  private cost = 0;
  constructor(private readonly options: ProviderOptions) {
    const u = new URL(options.endpoint);
    if (
      u.protocol !== 'https:' ||
      u.username ||
      u.password ||
      u.hash ||
      u.port ||
      isIP(u.hostname.replace(/^\[|\]$/g, '')) ||
      !u.hostname.includes('.') ||
      !options.apiKey ||
      !options.model ||
      !options.processorApproval.reviewedBy.trim()
    )
      throw new Error('INVALID_PROVIDER_CONFIG');
    for (const value of [
      options.maxInputChars,
      options.maxOutputTokens,
      options.maxSessionTokens,
      options.maxSessionCostMicros,
      options.timeoutMs,
    ])
      if (!Number.isSafeInteger(value) || value < 1) throw new Error('INVALID_PROVIDER_BUDGET');
    if (
      options.maxInputChars > 200000 ||
      options.maxOutputTokens > 16000 ||
      options.timeoutMs > 30000 ||
      ![options.inputMicrosPerToken, options.outputMicrosPerToken].every(
        (v) => Number.isSafeInteger(v) && v >= 0,
      )
    )
      throw new Error('INVALID_PROVIDER_BUDGET');
  }
  async extract(document: DocumentText, plan: ExtractionPlan) {
    DocumentTextSchema.parse(document);
    ExtractionPlanSchema.parse(plan);
    const baseline = extractPositions(document, plan);
    if (
      !this.options.processorApproval.permitted ||
      !(Date.parse(this.options.processorApproval.expiresAt) > Date.now())
    )
      throw new Error('PROCESSOR_APPROVAL_EXPIRED');
    const content = JSON.stringify({ document, plan });
    if (content.length > this.options.maxInputChars) throw new Error('PROVIDER_CONTEXT_LIMIT');
    const request = {
      protocol: 'uttirno-extract-v1',
      model: this.options.model,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      tools: [],
      tool_choice: 'none',
      max_output_tokens: this.options.maxOutputTokens,
      responseSchema: z.toJSONSchema(OutputSchema),
      messages: [
        { role: 'system', content: instruction },
        { role: 'user', content },
      ],
    };
    // UTF-8 bytes are a conservative upper bound for byte-based tokenizers. Reserve before I/O,
    // never refund on failure: concurrent requests cannot overspend the configured session budget.
    const inputTokens = Buffer.byteLength(JSON.stringify(request)) + 100; // cache-key property allowance
    const reserved = inputTokens + this.options.maxOutputTokens;
    const cost =
      inputTokens * this.options.inputMicrosPerToken +
      this.options.maxOutputTokens * this.options.outputMicrosPerToken;
    if (
      this.tokens + reserved > this.options.maxSessionTokens ||
      this.cost + cost > this.options.maxSessionCostMicros
    )
      throw new Error('PROVIDER_SESSION_BUDGET');
    this.tokens += reserved;
    this.cost += cost;
    const key = createHash('sha256')
      .update(
        JSON.stringify({
          content,
          model: this.options.model,
          prompt: PROMPT_VERSION,
          schema: SCHEMA_VERSION,
        }),
      )
      .digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(this.options.endpoint, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({ ...request, cacheKey: key }),
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json') ||
        !response.body
      )
        throw new Error('INVALID_PROVIDER_RESPONSE');
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.length;
        if (size > Math.min(1048576, this.options.maxOutputTokens * 32)) {
          await reader.cancel();
          throw new Error('PROVIDER_OUTPUT_LIMIT');
        }
        chunks.push(result.value);
      }
      const output = OutputSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      // Models can propose only deterministically reproducible values at this milestone.
      // Do not silently accept plausible unsupported prose, omissions, or a wrong sibling.
      if (JSON.stringify(output.positions) !== JSON.stringify(baseline))
        throw new Error('UNSUPPORTED_MODEL_OUTPUT');
      return {
        ...output,
        cacheKey: key,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        model: this.options.model,
        publicationApproved: false as const,
      };
    } catch {
      throw new Error('PROVIDER_EXTRACTION_REJECTED');
    } finally {
      clearTimeout(timer);
    }
  }
}
