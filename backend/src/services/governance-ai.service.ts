// pdfmake ships no ESM/CJS default export types that play well with `import`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require('pdfmake')
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { getOpenAiClient } from './ai/provider-client'

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}
pdfMake.setFonts(fonts)

export interface GovernanceNarratives {
  document_narrative: string
  structured_json: Record<string, unknown>
}

export interface DocSection {
  title: string
  subsections: { heading: string; content: string }[]
}

export interface StructuredDoc {
  title: string
  sections: DocSection[]
  conclusion: string
}

import { hasAvailableCredits, spendAiCredits, InsufficientCreditsError } from './ai-credits.service'

/** Step 1: raw governance session data -> a rich, investor-grade narrative. */
export async function transformGovernanceData(
  rawData: Record<string, unknown>,
  companyName: string,
  purpose?: string,
  tenantId?: number,
): Promise<GovernanceNarratives> {
  if (tenantId && !(await hasAvailableCredits(tenantId))) {
    throw new InsufficientCreditsError()
  }

  const resolved = await getOpenAiClient(tenantId)
  if (!resolved) throw new Error('No AI provider configured — set an OpenAI key in AI provider settings.')

  const dataJson = JSON.stringify(rawData, null, 2)

  const systemPrompt = `You are an expert governance analyst and business writer.
Your task is to transform raw startup assessment form data into high-fidelity,
professional narrative content suitable for investor-grade governance reports.

MANDATE: You MUST include 100% of all data fields provided. Do not omit any field.
Every metric, answer, and data point must be woven into the narrative.
Do not hallucinate. Only use the data provided.`

  const userPrompt = `Company: ${companyName}
Governance Purpose: ${purpose || 'General Governance Review'}

RAW FORM DATA:
${dataJson}

Generate a JSON response with exactly these two keys:
1. "document_narrative": A comprehensive 2000+ word professional narrative covering ALL data fields, written in third person, suitable for a governance report document. Structure it with clear sections covering each pillar/area from the data.
2. "structured_json": A structured breakdown of all form data organized by category, preserving all original values but adding brief context for each.

Return only valid JSON, no markdown.`

  const response = await resolved.client.chat.completions.create({
    model: resolved.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
  })

  if (tenantId && response.usage?.total_tokens) {
    await spendAiCredits(tenantId, response.usage.total_tokens)
  }

  const content = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(content) as GovernanceNarratives
}

/** Step 2: narrative -> a structured doc schema (title/sections/conclusion). */
export async function narrativeToStructuredDoc(narrative: string, companyName: string, tenantId?: number): Promise<StructuredDoc> {
  if (tenantId && !(await hasAvailableCredits(tenantId))) {
    throw new InsufficientCreditsError()
  }

  const resolved = await getOpenAiClient(tenantId)
  if (!resolved) throw new Error('No AI provider configured — set an OpenAI key in AI provider settings.')

  const response = await resolved.client.chat.completions.create({
    model: resolved.model,
    messages: [
      {
        role: 'system',
        content: `You are a document structure expert. Convert the provided narrative into a
well-structured JSON document schema with a title, sections, subsections with headings and content paragraphs, and a conclusion.`,
      },
      {
        role: 'user',
        content: `Company: ${companyName}

NARRATIVE:
${narrative}

Return a JSON object with this exact structure:
{
  "title": "Governance Review Report - ${companyName}",
  "sections": [
    {
      "title": "Section Title",
      "subsections": [
        { "heading": "Subsection Heading", "content": "Full paragraph content..." }
      ]
    }
  ],
  "conclusion": "Conclusion paragraph..."
}

Return only valid JSON, no markdown.`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 3000,
  })

  if (tenantId && response.usage?.total_tokens) {
    await spendAiCredits(tenantId, response.usage.total_tokens)
  }

  const content = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(content) as StructuredDoc
}

/** Step 3: structured doc -> a pdfmake-rendered PDF buffer. */
export async function buildGovernancePdfBuffer(doc: StructuredDoc): Promise<Buffer> {
  const content: Record<string, unknown>[] = [
    { text: doc.title, style: 'header' },
    { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }], margin: [0, 0, 0, 10] },
  ]

  for (const section of doc.sections) {
    content.push({ text: section.title, style: 'sectionTitle', margin: [0, 20, 0, 8] })
    for (const sub of section.subsections) {
      content.push({ text: sub.heading, style: 'subsectionHeading', margin: [0, 10, 0, 4] })
      content.push({ text: sub.content, style: 'body', margin: [0, 0, 0, 8] })
    }
  }

  content.push({ text: 'Conclusion', style: 'sectionTitle', margin: [0, 20, 0, 8] })
  content.push({ text: doc.conclusion, style: 'body' })

  const docDefinition: TDocumentDefinitions = {
    content: content as unknown as TDocumentDefinitions['content'],
    styles: {
      header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
      sectionTitle: { fontSize: 16, bold: true, color: '#222' },
      subsectionHeading: { fontSize: 12, bold: true, color: '#333' },
      body: { fontSize: 11, color: '#444', alignment: 'justify' },
    },
    defaultStyle: { font: 'Roboto' },
  }

  const pdfDoc = pdfMake.createPdf(docDefinition)
  return pdfDoc.getBuffer()
}
