import { describe, expect, it } from 'vitest';
import { extractMermaidBlocks } from '../src/source';

describe('extractMermaidBlocks', () => {
	it('extracts multiple backtick and tilde fenced diagrams', () => {
		const markdown = [
			'# Architecture',
			'',
			'```mermaid',
			'flowchart LR',
			'  A --> B',
			'```',
			'',
			'~~~ Mermaid title="sequence"',
			'sequenceDiagram',
			'  A->>B: hello',
			'~~~~',
		].join('\n');

		expect(extractMermaidBlocks(markdown)).toEqual([
			'flowchart LR\n  A --> B',
			'sequenceDiagram\n  A->>B: hello',
		]);
	});

	it('ignores other fenced code and unterminated Mermaid blocks', () => {
		const markdown = [
			'```typescript',
			'const value = "mermaid";',
			'```',
			'```mermaid-js',
			'graph LR',
			'```',
			'```mermaid',
			'graph TD',
		].join('\n');

		expect(extractMermaidBlocks(markdown)).toEqual([]);
	});

	it('requires a closing fence at least as long as the opening fence', () => {
		const markdown = ['````mermaid', 'graph TD', '```', '````'].join('\n');

		expect(extractMermaidBlocks(markdown)).toEqual(['graph TD\n```']);
	});
});
