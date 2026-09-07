import { Fragment } from 'react'

import { classifyCvProjectMarkdownLine } from '../../lib/cvProjectMarkdown.mjs'

type CvProjectPreviewProps = {
  content: string
}

function InlineMarkdown({ text }: { text: string }) {
  const parts = String(text ?? '').split(/(\*\*[^*]+\*\*)/g)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
        }

        return <Fragment key={`${index}-${part}`}>{part}</Fragment>
      })}
    </>
  )
}

export function CvProjectPreview({ content }: CvProjectPreviewProps) {
  const lines = String(content ?? '').split('\n')

  return (
    <article className="cv-project-preview" aria-label="CV project preview">
      {lines.map((line, index) => {
        const block = classifyCvProjectMarkdownLine(line)

        switch (block.type) {
          case 'blank':
            return <div className="cv-project-preview-spacer" key={`blank-${index}`} />
          case 'h1':
            return (
              <h1 className="cv-project-preview-h1" key={`h1-${index}`}>
                <InlineMarkdown text={block.text} />
              </h1>
            )
          case 'h2':
            return (
              <h2 className="cv-project-preview-h2" key={`h2-${index}`}>
                <InlineMarkdown text={block.text} />
              </h2>
            )
          case 'h3':
            return (
              <h3 className="cv-project-preview-h3" key={`h3-${index}`}>
                <InlineMarkdown text={block.text} />
              </h3>
            )
          case 'title':
            return (
              <p className="cv-project-preview-title" key={`title-${index}`}>
                <InlineMarkdown text={block.text} />
              </p>
            )
          case 'bullet':
            return (
              <p className="cv-project-preview-bullet" key={`bullet-${index}`}>
                <InlineMarkdown text={block.text} />
              </p>
            )
          default:
            return (
              <p className="cv-project-preview-paragraph" key={`paragraph-${index}`}>
                <InlineMarkdown text={block.text} />
              </p>
            )
        }
      })}
    </article>
  )
}
