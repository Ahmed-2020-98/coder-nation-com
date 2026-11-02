/** Plain text -> paragraphs and bullet lists ("- " at the start of a line). Everything is escaped by React. */
export function PlainText({ text }: { text: string }) {
  const blocks: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.startsWith("- ");
    const last = blocks[blocks.length - 1];
    if (last && last.bullets === bullet) last.lines.push(bullet ? line.slice(2) : line);
    else blocks.push({ bullets: bullet, lines: [bullet ? line.slice(2) : line] });
  }
  return (
    <>
      {blocks.map((block, index) =>
        block.bullets ? (
          <ul key={index} className="my-2 list-disc ps-6 leading-8">
            {block.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          block.lines.map((line, i) => (
            <p key={`${index}-${i}`} className="my-2 leading-8">
              {line}
            </p>
          ))
        ),
      )}
    </>
  );
}
