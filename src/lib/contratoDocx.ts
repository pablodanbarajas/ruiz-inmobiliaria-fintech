import {
  AlignmentType,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const PAGE_WIDTH_DXA = 12240 // US Letter
const PAGE_MARGIN_DXA = 1134 // 2 cm
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'TABLE', 'OL', 'UL', 'SECTION', 'ARTICLE'])
const IGNORED_TAGS = new Set(['STYLE', 'SCRIPT', 'TITLE', 'META', 'HEAD'])

const LIST_FORMATS: Record<string, { format: (typeof LevelFormat)[keyof typeof LevelFormat]; text: string }> = {
  '1': { format: LevelFormat.DECIMAL, text: '%1.' },
  a: { format: LevelFormat.LOWER_LETTER, text: '%1)' },
  A: { format: LevelFormat.UPPER_LETTER, text: '%1)' },
  i: { format: LevelFormat.LOWER_ROMAN, text: '%1.' },
  I: { format: LevelFormat.UPPER_ROMAN, text: '%1.' },
  bullet: { format: LevelFormat.BULLET, text: '•' },
}

type RunStyle = {
  bold?: boolean
  italics?: boolean
  underline?: boolean
  size?: number
  color?: string
  font?: string
}

type InlineItem = { text: string; style: RunStyle } | { lineBreak: true }
type Block = Paragraph | Table
type ListContext = { reference: string; instance: number }

const cssValue = (element: Element, property: string): string | undefined => {
  const match = (element.getAttribute('style') || '').match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'))
  return match?.[1].trim()
}

/** Converts a CSS size to half-points, the unit Word uses for text. */
const toHalfPoints = (value: string | undefined): number | undefined => {
  const match = value?.match(/^([\d.]+)\s*(pt|px)$/i)
  if (!match) return undefined
  const points = match[2].toLowerCase() === 'px' ? Number(match[1]) * 0.75 : Number(match[1])
  return Math.round(points * 2)
}

const toHexColor = (value: string | null | undefined): string | undefined =>
  /^#[0-9a-f]{6}$/i.test(value?.trim() || '') ? value!.trim().slice(1) : undefined

const firstFont = (value: string | null | undefined): string | undefined => {
  const font = value?.split(',')[0].trim().replace(/['"]/g, '')
  if (!font) return undefined
  return font.toLowerCase() === 'courier' ? 'Courier New' : font
}

const styleOf = (element: Element, inherited: RunStyle): RunStyle => {
  const style = { ...inherited }
  const tag = element.tagName

  if (['B', 'STRONG', 'TH', 'H1', 'H2', 'H3', 'H4'].includes(tag) || /^(bold|[6-9]00)$/i.test(cssValue(element, 'font-weight') || '')) {
    style.bold = true
  }
  if (['I', 'EM'].includes(tag) || cssValue(element, 'font-style') === 'italic') style.italics = true
  if (tag === 'U' || /underline/i.test(cssValue(element, 'text-decoration') || '')) style.underline = true
  if (tag === 'H1') style.size = 32
  if (tag === 'H2') style.size = 28
  if (tag === 'H3') style.size = 26

  style.size = toHalfPoints(cssValue(element, 'font-size')) ?? style.size
  style.color = toHexColor(element.getAttribute('color')) ?? toHexColor(cssValue(element, 'color')) ?? style.color
  style.font = firstFont(cssValue(element, 'font-family')) ?? firstFont(element.getAttribute('face')) ?? style.font
  return style
}

const alignmentOf = (element: Element) => {
  const value = (cssValue(element, 'text-align') || element.getAttribute('align') || (/^H[12]$/.test(element.tagName) ? 'center' : '')).toLowerCase()
  if (value === 'center') return AlignmentType.CENTER
  if (value === 'right') return AlignmentType.RIGHT
  if (value === 'justify') return AlignmentType.JUSTIFIED
  return undefined
}

const collectInline = (node: Node, style: RunStyle, items: InlineItem[]) => {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      // Only HTML whitespace collapses; a non-breaking space must stay.
      const text = (child.textContent || '').replace(/[ \t\r\n\f]+/g, ' ')
      if (text) items.push({ text, style })
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const element = child as Element
    if (IGNORED_TAGS.has(element.tagName)) return
    if (element.tagName === 'BR') {
      items.push({ lineBreak: true })
      return
    }
    collectInline(element, styleOf(element, style), items)
  })
}

const toRuns = (items: InlineItem[]): TextRun[] => {
  // Mirrors the browser: a trailing line break adds no line, and edge spaces don't show.
  const trimmed = [...items]
  while (trimmed.length) {
    const last = trimmed[trimmed.length - 1]
    if ('lineBreak' in last || last.text === ' ') trimmed.pop()
    else break
  }
  while (trimmed.length && 'text' in trimmed[0] && trimmed[0].text === ' ') trimmed.shift()

  return trimmed.map((item, index) => {
    if ('lineBreak' in item) return new TextRun({ break: 1 })
    let text = item.text
    if (index === 0 || 'lineBreak' in trimmed[index - 1]) text = text.replace(/^ /, '')
    if (index === trimmed.length - 1) text = text.replace(/ $/, '')
    return new TextRun({
      text,
      bold: item.style.bold,
      italics: item.style.italics,
      underline: item.style.underline ? {} : undefined,
      size: item.style.size,
      color: item.style.color,
      font: item.style.font,
    })
  })
}

const hasVisibleContent = (items: InlineItem[]) =>
  items.some((item) => 'lineBreak' in item || item.text.trim() !== '')

class ContratoConverter {
  private listCount = 0

  blocksFrom(parent: Element, style: RunStyle, list?: ListContext): Block[] {
    const blocks: Block[] = []
    let inline: InlineItem[] = []

    const flushInline = () => {
      if (hasVisibleContent(inline)) {
        blocks.push(new Paragraph({ children: toRuns(inline), numbering: list && { reference: list.reference, instance: list.instance, level: 0 } }))
      }
      inline = []
    }

    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element
        if (IGNORED_TAGS.has(element.tagName)) return
        if (BLOCK_TAGS.has(element.tagName)) {
          flushInline()
          blocks.push(...this.blockFrom(element, style, list))
          return
        }
        if (element.tagName === 'BR') {
          inline.push({ lineBreak: true })
          return
        }
        collectInline(element, styleOf(element, style), inline)
        return
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || '').replace(/[ \t\r\n\f]+/g, ' ')
        if (text) inline.push({ text, style })
      }
    })
    flushInline()
    return blocks
  }

  private blockFrom(element: Element, inherited: RunStyle, list?: ListContext): Block[] {
    const style = styleOf(element, inherited)
    if (element.tagName === 'TABLE') return [this.tableFrom(element as HTMLTableElement, style)]
    if (element.tagName === 'OL' || element.tagName === 'UL') return this.listFrom(element, style)

    const hasNestedBlocks = Array.from(element.children).some((child) => BLOCK_TAGS.has(child.tagName))
    if (hasNestedBlocks) return this.blocksFrom(element, style, list)

    const items: InlineItem[] = []
    collectInline(element, style, items)
    return [new Paragraph({
      children: toRuns(items),
      alignment: alignmentOf(element),
      numbering: list && { reference: list.reference, instance: list.instance, level: 0 },
    })]
  }

  private listFrom(element: Element, style: RunStyle): Block[] {
    const type = element.tagName === 'UL' ? 'bullet' : element.getAttribute('type') || '1'
    const reference = `contrato-lista-${LIST_FORMATS[type] ? type : '1'}`
    this.listCount += 1
    const list = { reference, instance: this.listCount }

    return Array.from(element.children)
      .filter((child) => child.tagName === 'LI')
      .flatMap((item) => this.blocksFrom(item, styleOf(item, style), list))
  }

  private tableFrom(table: HTMLTableElement, style: RunStyle): Table {
    const rows = Array.from(table.rows)
    const columnCount = Math.max(1, ...rows.map((row) => Array.from(row.cells).reduce((sum, cell) => sum + cell.colSpan, 0)))

    return new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: Array(columnCount).fill(Math.floor(CONTENT_WIDTH_DXA / columnCount)),
      rows: rows.map((row) => new TableRow({
        children: Array.from(row.cells).map((cell) => {
          const fill = toHexColor(cssValue(row, 'background')) ?? toHexColor(cssValue(cell, 'background'))
          const blocks = this.blocksFrom(cell, styleOf(cell, style))
          return new TableCell({
            columnSpan: cell.colSpan,
            rowSpan: cell.rowSpan,
            shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            children: blocks.length ? blocks : [new Paragraph({})],
          })
        }),
      })),
    })
  }
}

const readBodyStyle = (doc: globalThis.Document): RunStyle => {
  const rule = Array.from(doc.querySelectorAll('style'))
    .map((tag) => tag.textContent?.match(/(?:^|[\s}])body\s*\{([^}]*)\}/i)?.[1])
    .find(Boolean)
  const value = (property: string) => rule?.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+)`, 'i'))?.[1]
  return {
    font: firstFont(value('font-family')) ?? 'Courier New',
    size: toHalfPoints(value('font-size')?.trim()) ?? 24,
  }
}

/** Builds an editable Word file from a contract's final HTML. */
export const buildContratoDocx = async (html: string): Promise<Blob> => {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const base = readBodyStyle(parsed)
  const children = new ContratoConverter().blocksFrom(parsed.body, {})

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: base.font, size: base.size },
          paragraph: { spacing: { after: 120 } },
        },
      },
    },
    numbering: {
      config: Object.entries(LIST_FORMATS).map(([key, { format, text }]) => ({
        reference: `contrato-lista-${key}`,
        levels: [{
          level: 0,
          format,
          text,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 400, hanging: 300 } } },
        }],
      })),
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_DXA, height: 15840 },
          margin: { top: PAGE_MARGIN_DXA, bottom: PAGE_MARGIN_DXA, left: PAGE_MARGIN_DXA, right: PAGE_MARGIN_DXA },
        },
      },
      children: children.length ? children : [new Paragraph({})],
    }],
  })

  return Packer.toBlob(doc)
}
