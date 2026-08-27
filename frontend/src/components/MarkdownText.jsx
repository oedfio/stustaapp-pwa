import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

// Renders user-authored description text (event/org descriptions) as a
// restricted subset of Markdown — bold, italics, links, and lists.
// Headings, images, and raw HTML are disallowed since these are short
// descriptions, not full documents, and raw HTML must never be trusted
// from user input.
export default function MarkdownText({ children, style }) {
    if (!children) return null

    return (
        <div style={style}>
            <ReactMarkdown
                remarkPlugins={[remarkBreaks]}
                allowedElements={['p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br']}
                unwrapDisallowed
                components={{
                    a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" />
                    ),
                    p: ({ node, ...props }) => (
                        <p {...props} style={{ margin: '0 0 8px 0' }} />
                    ),
                    ul: ({ node, ...props }) => (
                        <ul {...props} style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol {...props} style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} />
                    ),
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    )
}