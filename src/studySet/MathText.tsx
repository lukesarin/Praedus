import katex from 'katex'
import 'katex/dist/katex.min.css'
import { mathParts, renderTex } from './mathParts'

// Full-size fractions and limits even inside a sentence: easier to read than KaTeX's small inline style.
const draw = (tex: string) => katex.renderToString(`\\displaystyle ${tex}`, { throwOnError: true, output: 'html' })

/** Text with `$…$` math drawn by KaTeX. Bad LaTeX shows as plain text instead of an error. */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {mathParts(text).map((p, i) => {
        if (!p.math) return <span key={i}>{p.text}</span>
        const html = renderTex(p.tex, draw)
        if (html === null) return <span key={i}>{p.tex}</span>
        // KaTeX escapes everything it draws, so its output is safe to insert.
        return <span key={i} className="math" dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </>
  )
}
