import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyCvProjectMarkdownLine,
  cvProjectMarkdownToWordHtml,
  renderInlineMarkdownToHtml,
} from './cvProjectMarkdown.mjs'

test('classifyCvProjectMarkdownLine detects headings, bullets, and titles', () => {
  assert.deepEqual(classifyCvProjectMarkdownLine('# Included projects'), {
    type: 'h1',
    text: 'Included projects',
  })
  assert.deepEqual(classifyCvProjectMarkdownLine('## Section'), {
    type: 'h2',
    text: 'Section',
  })
  assert.deepEqual(classifyCvProjectMarkdownLine('### Project A'), {
    type: 'h3',
    text: 'Project A',
  })
  assert.deepEqual(classifyCvProjectMarkdownLine('**E-Commerce App**'), {
    type: 'title',
    text: 'E-Commerce App',
  })
  assert.deepEqual(classifyCvProjectMarkdownLine('• Built checkout flow'), {
    type: 'bullet',
    text: '• Built checkout flow',
  })
  assert.deepEqual(classifyCvProjectMarkdownLine(''), { type: 'blank' })
})

test('renderInlineMarkdownToHtml converts bold markers', () => {
  const html = renderInlineMarkdownToHtml('Role: **Frontend** | Technologies: React')

  assert.match(html, /Role: <strong>Frontend<\/strong> \| Technologies: React/)
})

test('cvProjectMarkdownToWordHtml renders headings and bullets instead of raw markdown', () => {
  const markdown = `# Included projects

**E-Commerce App**
Role: Frontend | Technologies: React
• Built checkout flow
### Skipped
- Not submitted`

  const html = cvProjectMarkdownToWordHtml(markdown)

  assert.match(html, /<h1[^>]*>Included projects<\/h1>/)
  assert.match(html, /<p[^>]*font-weight:bold[^>]*>E-Commerce App<\/p>/)
  assert.match(html, /Role: Frontend/)
  assert.match(html, /• Built checkout flow/)
  assert.match(html, /<h3[^>]*>Skipped<\/h3>/)
  assert.doesNotMatch(html, /### Skipped/)
  assert.doesNotMatch(html, /\*\*E-Commerce App\*\*/)
})
