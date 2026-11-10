import { load, type CheerioAPI } from 'cheerio';
import { createHash } from 'node:crypto';
import {
  assertSourceUrl,
  SourcePolicyError,
  type SourceConfig,
  type AdapterConfig,
} from '@uttirno/source-config';
type Scope = ReturnType<CheerioAPI>;
export type Candidate = {
  title: string;
  detailUrl: string | null;
  attachments: string[];
  siblings: string[];
  fields: Record<string, { original: string; normalized: string; locator: string }>;
  locator: string;
};
export type ParsedPage = {
  items: Candidate[];
  nextUrl: string | null;
  quarantined: string[];
  errors: string[];
};
function normalize(value: string, transforms: string[]): string {
  let result = value;
  for (const transform of transforms) {
    if (transform === 'trim') result = result.trim();
    if (transform === 'collapse_whitespace') result = result.replace(/\s+/g, ' ').trim();
    if (transform === 'bangla_digits')
      result = result.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
  }
  return result;
}
function selected(scope: Scope, selector: string): Scope {
  return selector === '$self' ? scope : scope.find(selector);
}
function pointer(value: unknown, path: string): unknown {
  let current = value;
  if (path === '') return current;
  for (const part of path
    .slice(1)
    .split('/')
    .map((p) => p.replaceAll('~1', '/').replaceAll('~0', '~'))) {
    if (
      ['__proto__', 'constructor', 'prototype'].includes(part) ||
      current === null ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, part)
    )
      return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
export function parsePage(
  config: SourceConfig,
  url: string,
  body: string,
  adapter: AdapterConfig = config.adapter,
): ParsedPage {
  const result: ParsedPage = { items: [], nextUrl: null, quarantined: [], errors: [] };
  function safeLink(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const link = new URL(raw, url);
      link.hash = '';
      assertSourceUrl(config, link.href);
      return link.href;
    } catch {
      result.quarantined.push(createHash('sha256').update(String(raw)).digest('hex'));
      return null;
    }
  }
  if (adapter.kind === 'json') {
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new SourcePolicyError('INVALID_JSON_DOCUMENT');
    }
    const items = pointer(json, adapter.items);
    if (!Array.isArray(items)) throw new SourcePolicyError('JSON_ITEMS_NOT_ARRAY');
    if (items.length < adapter.minItems || items.length > adapter.maxItems)
      throw new SourcePolicyError('ITEM_COUNT_DRIFT');
    for (const [index, item] of items.entries()) {
      const title = pointer(item, adapter.title);
      if (typeof title !== 'string' || !title.trim()) {
        result.errors.push(`MISSING_TITLE:${index}`);
        continue;
      }
      const attachments = adapter.attachments ? pointer(item, adapter.attachments) : [];
      if (adapter.attachments && !Array.isArray(attachments))
        result.errors.push(`ATTACHMENT_SHAPE:${index}`);
      const detailUrl = adapter.detailLink ? safeLink(pointer(item, adapter.detailLink)) : null;
      if (adapter.detailLink && !detailUrl) result.errors.push(`MISSING_DETAIL_LINK:${index}`);
      result.items.push({
        title: title.trim(),
        detailUrl,
        attachments: Array.isArray(attachments)
          ? attachments.map(safeLink).filter((v): v is string => v !== null)
          : [],
        siblings: [],
        fields: {},
        locator: `${adapter.items}/${index}`,
      });
    }
    if (adapter.next) result.nextUrl = safeLink(pointer(json, adapter.next));
    return result;
  }
  try {
    let html = body;
    if (adapter.embeddedHtml) {
      const container = load(body)(adapter.embeddedHtml.selector);
      if (container.length !== 1) throw new SourcePolicyError('EMBEDDED_HTML_CARDINALITY');
      const encoded = container.attr(adapter.embeddedHtml.attribute);
      if (
        !encoded ||
        encoded.length > 1398104 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
      )
        throw new SourcePolicyError('INVALID_EMBEDDED_HTML');
      const decoded = Buffer.from(encoded, 'base64');
      if (decoded.length > 1048576 || decoded.toString('base64') !== encoded)
        throw new SourcePolicyError('EMBEDDED_HTML_LIMIT');
      html = new TextDecoder('utf-8', { fatal: true }).decode(decoded);
    }
    const $ = load(html);
    $('script,style,noscript,template').remove();
    const items = $(adapter.items);
    if (items.length < adapter.minItems || items.length > adapter.maxItems)
      throw new SourcePolicyError('ITEM_COUNT_DRIFT');
    for (const [index, node] of items.toArray().entries()) {
      const scope = $(node);
      const titleNodes = selected(scope, adapter.title);
      if (titleNodes.length !== 1) {
        result.errors.push(`TITLE_CARDINALITY:${index}`);
        continue;
      }
      const title = normalize(titleNodes.text(), ['collapse_whitespace']);
      if (!title) {
        result.errors.push(`MISSING_TITLE:${index}`);
        continue;
      }
      const links = (selector: string | undefined, attributes = ['href', 'src']) =>
        selector
          ? [
              ...new Set(
                selected(scope, selector)
                  .toArray()
                  .map((n) =>
                    safeLink(
                      attributes
                        .map((attribute) => $(n).attr(attribute))
                        .find((v) => v !== undefined),
                    ),
                  )
                  .filter((v): v is string => v !== null),
              ),
            ]
          : [];
      const fields: Candidate['fields'] = {};
      for (const mapping of adapter.fields) {
        const nodes = selected(scope, mapping.selector);
        if (nodes.length !== 1) {
          if (mapping.required) result.errors.push(`FIELD_CARDINALITY:${index}:${mapping.name}`);
          continue;
        }
        const original = mapping.attribute ? nodes.attr(mapping.attribute) : nodes.text();
        if (original === undefined || !original.trim()) {
          if (mapping.required) result.errors.push(`MISSING_FIELD:${index}:${mapping.name}`);
          continue;
        }
        fields[mapping.name] = {
          original,
          normalized: normalize(original, mapping.transforms),
          locator: `${adapter.items}[${index}] ${mapping.selector}`,
        };
      }
      const detailLinks = links(adapter.detailLink);
      if (detailLinks.length > 1) result.errors.push(`DETAIL_CARDINALITY:${index}`);
      if (adapter.detailLink && !detailLinks.length)
        result.errors.push(`MISSING_DETAIL_LINK:${index}`);
      result.items.push({
        title,
        detailUrl: detailLinks.length === 1 ? (detailLinks[0] ?? null) : null,
        attachments: links(adapter.attachments, adapter.attachmentAttributes),
        siblings: links(adapter.siblings),
        fields,
        locator: `${adapter.items}[${index}]`,
      });
    }
    if (adapter.next) {
      const next = $(adapter.next).filter(
        (_i, n) => $(n).attr('aria-disabled') !== 'true' && !$(n).is('[disabled]'),
      );
      if (next.length > 1) result.errors.push('NEXT_CARDINALITY');
      if (next.length === 1) result.nextUrl = safeLink(next.attr('href'));
    }
  } catch (error) {
    if (error instanceof SourcePolicyError) throw error;
    throw new SourcePolicyError('INVALID_SELECTOR_OR_HTML');
  }
  return result;
}
