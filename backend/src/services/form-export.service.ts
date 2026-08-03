import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
// pdfmake ships no ESM/CJS default export types that play well with `import`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMake = require('pdfmake')
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { db } from '../db/client'
import { formResponses, formTemplates, companies } from '../models'
import type { FormQuestion } from '../models'

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
}
pdfMake.setFonts(fonts)

async function getResponseWithContext(responseId: number) {
  const [row] = await db
    .select({ response: formResponses, template: formTemplates, company: companies })
    .from(formResponses)
    .innerJoin(formTemplates, eq(formResponses.templateId, formTemplates.id))
    .innerJoin(companies, eq(formResponses.companyId, companies.id))
    .where(eq(formResponses.id, responseId))
    .limit(1)
  return row ?? null
}

// Server-side formula evaluation is intentionally simpler than the client's:
// only same-row-id lookups ([rowId]), non-recursive (a referenced cell that
// is itself a formula resolves to "0") — matching the reference export's
// export.service.ts exactly, since exports are a point-in-time snapshot, not
// a live recalculation surface.
function evaluateFormula(formula: string, rowMap: Map<string, Record<string, unknown>>, colId: string): string {
  try {
    let evaluated = formula.substring(1)
    const idRegex = /\[([^\]]+)\]/g
    let match: RegExpExecArray | null
    while ((match = idRegex.exec(formula)) !== null) {
      const id = match[1]
      const row = rowMap.get(id)
      let val = '0'
      if (row && row[colId] !== undefined) {
        val = String(row[colId]).replace(/,/g, '') || '0'
        if (val.startsWith('=')) val = '0'
      }
      evaluated = evaluated.replace(`[${id}]`, val)
    }
    const safeExpression = evaluated.replace(/[^0-9+\-*/.() ]/g, '')
    const result = new Function(`return ${safeExpression}`)()
    return isNaN(result) ? '0' : String(result)
  } catch {
    return '0'
  }
}

export interface ResolvedItem {
  label: string
  value: unknown
  type: 'table' | 'text'
}

export function resolveFormLabels(responseJson: Record<string, unknown>, schema: FormQuestion[]): ResolvedItem[] {
  if (!Array.isArray(schema)) return []
  const result: ResolvedItem[] = []

  for (const question of schema) {
    const qId = question.id
    const qLabel = question.title || qId
    const value = responseJson[qId]

    if (value === undefined || value === null || value === '') continue

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      const columns = question.columns ?? []
      const rowMap = new Map<string, Record<string, unknown>>()
      for (const row of value as Record<string, unknown>[]) {
        if (row.id) rowMap.set(String(row.id), row)
      }

      const resolvedTable = (value as Record<string, unknown>[]).map((row) => {
        const resolvedRow: Record<string, unknown> = {}
        for (const col of columns) {
          const colLabel = col.label || col.id
          let cellValue = row[col.id] ?? ''
          if (typeof cellValue === 'string' && cellValue.startsWith('=') && cellValue.includes('[')) {
            cellValue = evaluateFormula(cellValue, rowMap, col.id)
          }
          resolvedRow[colLabel] = cellValue
        }
        return resolvedRow
      })
      result.push({ label: qLabel, value: resolvedTable, type: 'table' })
    } else if (Array.isArray(value)) {
      result.push({ label: qLabel, value: value.join(', '), type: 'text' })
    } else {
      result.push({ label: qLabel, value, type: 'text' })
    }
  }
  return result
}

export async function generateExcel(responseId: number): Promise<ExcelJS.Buffer> {
  const row = await getResponseWithContext(responseId)
  if (!row) throw new Error('Response or template not found')

  const resolvedData = resolveFormLabels(row.response.responseJson as Record<string, unknown>, (row.template.schema as FormQuestion[]) ?? [])
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Form Response')

  sheet.columns = [
    { header: 'Question', key: 'question', width: 40 },
    { header: 'Answer', key: 'answer', width: 60 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }

  for (const item of resolvedData) {
    if (item.type === 'table') {
      sheet.addRow({ question: item.label, answer: '[Table Below]' })
      sheet.lastRow!.font = { bold: true, italic: true }
      const tableData = item.value as Record<string, unknown>[]
      if (tableData.length > 0) {
        const headers = Object.keys(tableData[0])
        const headerRow = sheet.addRow(['', ...headers])
        headerRow.font = { bold: true }
        for (const rowData of tableData) {
          const rowValues = headers.map((h) => rowData[h])
          sheet.addRow(['', ...rowValues])
        }
      }
      sheet.addRow([])
    } else {
      const dataRow = sheet.addRow({ question: item.label, answer: item.value })
      const cell = dataRow.getCell(2)
      if (typeof item.value === 'string' && item.value.startsWith('=')) {
        cell.value = { richText: [{ text: item.value }] }
      }
      cell.alignment = { wrapText: true }
    }
  }
  return workbook.xlsx.writeBuffer()
}

export async function generatePdf(responseId: number): Promise<Buffer> {
  const row = await getResponseWithContext(responseId)
  if (!row) throw new Error('Response or template not found')

  const resolvedData = resolveFormLabels(row.response.responseJson as Record<string, unknown>, (row.template.schema as FormQuestion[]) ?? [])

  const content: Record<string, unknown>[] = [
    { text: row.template.title, style: 'header' },
    { text: `Company: ${row.company.name || 'N/A'}`, style: 'subheader' },
    { text: `Submitted: ${row.response.submittedAt ? new Date(row.response.submittedAt).toLocaleString() : 'N/A'}`, style: 'info', margin: [0, 0, 0, 20] },
    { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }] },
  ]

  for (const item of resolvedData) {
    content.push({ text: item.label, style: 'question', margin: [0, 15, 0, 5] })
    if (item.type === 'table') {
      const tableData = item.value as Record<string, unknown>[]
      if (tableData.length > 0) {
        const headers = Object.keys(tableData[0])
        const body = [headers.map((h) => ({ text: h, style: 'tableHeader' }))]
        for (const rowData of tableData) {
          body.push(headers.map((h) => ({ text: String(rowData[h] ?? ''), style: 'tableCell' })))
        }
        content.push({ table: { headerRows: 1, widths: Array(headers.length).fill('*'), body }, margin: [0, 5, 0, 15] })
      } else {
        content.push({ text: 'No data in table', style: 'answer', italics: true })
      }
    } else {
      content.push({ text: String(item.value ?? 'N/A'), style: 'answer', margin: [0, 0, 0, 10] })
    }
  }

  const docDefinition: TDocumentDefinitions = {
    content: content as unknown as TDocumentDefinitions['content'],
    styles: {
      header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
      subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 5] },
      info: { fontSize: 10, color: '#666' },
      question: { fontSize: 12, bold: true, color: '#333' },
      answer: { fontSize: 11, color: '#555' },
      tableHeader: { fontSize: 10, bold: true, fillColor: '#eeeeee' },
      tableCell: { fontSize: 9 },
    },
    defaultStyle: { font: 'Roboto' },
  }

  const doc = pdfMake.createPdf(docDefinition)
  return doc.getBuffer()
}

export async function getResponseCompanyId(responseId: number): Promise<number | null> {
  const [row] = await db.select({ companyId: formResponses.companyId }).from(formResponses).where(eq(formResponses.id, responseId)).limit(1)
  return row?.companyId ?? null
}
