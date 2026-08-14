import { describe, expect, it } from 'vitest';
import { collectMermaidTargets } from '../src/markdown';

describe('collectMermaidTargets', () => {
	it('maps rendered diagrams to source blocks in document order', () => {
		const section = document.createElement('section');
		const first = document.createElement('div');
		first.className = 'mermaid';
		const second = document.createElement('div');
		second.className = 'mermaid';
		section.append(first, second);

		const markdown = [
			'```mermaid',
			'graph LR',
			'```',
			'```mermaid',
			'sequenceDiagram',
			'```',
		].join('\n');

		expect(collectMermaidTargets(section, markdown)).toEqual([
			{ element: first, source: 'graph LR' },
			{ element: second, source: 'sequenceDiagram' },
		]);
	});

	it('includes the section itself when it is a Mermaid container', () => {
		const diagram = document.createElement('div');
		diagram.className = 'mermaid';

		expect(
			collectMermaidTargets(diagram, ['```mermaid', 'graph TD', '```'].join('\n')),
		).toEqual([{ element: diagram, source: 'graph TD' }]);
	});

	it('leaves source undefined when section information is unavailable', () => {
		const section = document.createElement('section');
		const diagram = document.createElement('div');
		diagram.className = 'mermaid';
		section.appendChild(diagram);

		expect(collectMermaidTargets(section, undefined)).toEqual([
			{ element: diagram, source: undefined },
		]);
	});

	it('skips diagrams already enhanced by this plugin', () => {
		const section = document.createElement('section');
		const diagram = document.createElement('div');
		diagram.className = 'mermaid';
		diagram.dataset.mermaidViewerEnhanced = 'true';
		section.appendChild(diagram);

		expect(collectMermaidTargets(section, '')).toEqual([]);
	});

	it('preserves source indexes when an earlier diagram is pending', () => {
		const section = document.createElement('section');
		const first = document.createElement('div');
		first.className = 'mermaid';
		first.dataset.mermaidViewerEnhanced = 'pending';
		const second = document.createElement('div');
		second.className = 'mermaid';
		section.append(first, second);

		const markdown = [
			'```mermaid',
			'graph LR',
			'```',
			'```mermaid',
			'graph TD',
			'```',
		].join('\n');

		expect(collectMermaidTargets(section, markdown)).toEqual([
			{ element: second, source: 'graph TD' },
		]);
	});
});
