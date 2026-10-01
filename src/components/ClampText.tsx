// Shows the start of a long text with "Read more". Works without JavaScript.
export default function ClampText({ text, limit = 160 }: { text: string; limit?: number }) {
  if (text.length <= limit) return <>{text}</>
  const cut = text.slice(0, limit).replace(/\s+\S*$/, '')
  return (
    <details className="clamp">
      <summary>
        <span className="clamp-short">{cut}…</span>
        <span className="clamp-full">{text}</span>
        <span className="clamp-toggle clamp-more">Read more</span>
        <span className="clamp-toggle clamp-less">Show less</span>
      </summary>
    </details>
  )
}
