const INLINE_BOLD_PATTERN = /(\*\*[^*]+\*\*)/g

export function escapeCvExportHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderInlineMarkdownToHtml(text) {
  return String(text ?? '')
    .split(INLINE_BOLD_PATTERN)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return `<strong>${escapeCvExportHtml(part.slice(2, -2))}</strong>`
      }

      return escapeCvExportHtml(part)
    })
    .join('')
}

export function classifyCvProjectMarkdownLine(line) {
  const trimmed = String(line ?? '').trimEnd()

  if (trimmed.startsWith('# ')) {
    return { type: 'h1', text: trimmed.slice(2) }
  }

  if (trimmed.startsWith('## ')) {
    return { type: 'h2', text: trimmed.slice(3) }
  }

  if (trimmed.startsWith('### ')) {
    return { type: 'h3', text: trimmed.slice(4) }
  }

  if (/^[•\-*]\s/.test(trimmed)) {
    return { type: 'bullet', text: trimmed }
  }

  if (trimmed === '') {
    return { type: 'blank' }
  }

  if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
    return { type: 'title', text: trimmed.slice(2, -2) }
  }

  return { type: 'paragraph', text: trimmed }
}

const WORD_STYLES = {
  h1: 'font-family:Calibri;font-size:18pt;font-weight:bold;margin:0 0 12pt',
  h2: 'font-family:Calibri;font-size:14pt;font-weight:bold;margin:12pt 0 6pt',
  h3: 'font-family:Calibri;font-size:12pt;font-weight:bold;margin:10pt 0 4pt',
  paragraph: 'font-family:Calibri;font-size:11pt;margin:0 0 6pt',
  title: 'font-family:Calibri;font-size:11pt;font-weight:bold;margin:12pt 0 4pt',
  bullet: 'font-family:Calibri;font-size:11pt;margin:0 0 6pt 18pt',
}

function lineToWordHtml(line) {
  const block = classifyCvProjectMarkdownLine(line)

  switch (block.type) {
    case 'h1':
      return `<h1 style="${WORD_STYLES.h1}">${renderInlineMarkdownToHtml(block.text)}</h1>`
    case 'h2':
      return `<h2 style="${WORD_STYLES.h2}">${renderInlineMarkdownToHtml(block.text)}</h2>`
    case 'h3':
      return `<h3 style="${WORD_STYLES.h3}">${renderInlineMarkdownToHtml(block.text)}</h3>`
    case 'title':
      return `<p style="${WORD_STYLES.title}">${renderInlineMarkdownToHtml(block.text)}</p>`
    case 'bullet':
      return `<p style="${WORD_STYLES.bullet}">${renderInlineMarkdownToHtml(block.text)}</p>`
    case 'blank':
      return '<p style="margin:0">&nbsp;</p>'
    default:
      return `<p style="${WORD_STYLES.paragraph}">${renderInlineMarkdownToHtml(block.text)}</p>`
  }
}

export function cvProjectMarkdownToWordHtml(markdown) {
  const body = String(markdown ?? '')
    .split('\n')
    .map((line) => lineToWordHtml(line))
    .join('')

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>SWINLEARN CV</title></head><body>${body}</body></html>`
}
