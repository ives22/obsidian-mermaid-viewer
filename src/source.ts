const OPENING_FENCE = /^ {0,3}(`{3,}|~{3,})[\t ]*mermaid(?:[\t ]+.*)?$/i;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[\t ]*$/;

export function extractMermaidBlocks(markdown: string): string[] {
	const lines = markdown.split(/\r?\n/);
	const blocks: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const opening = lines[index]?.match(OPENING_FENCE);
		if (!opening?.[1]) continue;

		const fence = opening[1];
		const body: string[] = [];
		let closed = false;

		for (index += 1; index < lines.length; index += 1) {
			const line = lines[index] ?? '';
			const closing = line.match(CLOSING_FENCE)?.[1];
			const matchesFence =
				closing !== undefined &&
				closing[0] === fence[0] &&
				closing.length >= fence.length;

			if (matchesFence) {
				closed = true;
				break;
			}

			body.push(line);
		}

		if (closed) blocks.push(body.join('\n'));
	}

	return blocks;
}
