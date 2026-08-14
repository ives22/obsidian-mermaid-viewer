import { afterEach, describe, expect, it, vi } from 'vitest';

const { renderChildConstructor } = vi.hoisted(() => ({
	renderChildConstructor: vi.fn(),
}));

vi.mock('../src/mermaid-render-child', () => ({
	MermaidViewerRenderChild: class {
		constructor(app: unknown, element: HTMLElement, source: string | undefined) {
			element.dataset.mermaidViewerEnhanced = 'pending';
			renderChildConstructor(app, element, source);
		}
	},
}));

import { MermaidSectionRenderChild } from '../src/mermaid-section-render-child';

describe('MermaidSectionRenderChild', () => {
	afterEach(() => {
		renderChildConstructor.mockReset();
	});

	it('enhances Mermaid containers inserted asynchronously', async () => {
		const app = {};
		const section = document.createElement('section');
		const child = new MermaidSectionRenderChild(
			app as never,
			section,
			['```mermaid', 'flowchart LR', 'A --> B', '```'].join('\n'),
		);
		child.onload();

		const diagram = document.createElement('div');
		diagram.className = 'mermaid';
		section.appendChild(diagram);

		await vi.waitFor(() => {
			expect(renderChildConstructor).toHaveBeenCalledWith(
				app,
				diagram,
				'flowchart LR\nA --> B',
			);
		});

		child.onunload();
	});

	it('does not enhance the same diagram again after later mutations', async () => {
		const section = document.createElement('section');
		const diagram = document.createElement('div');
		diagram.className = 'mermaid';
		section.appendChild(diagram);
		const child = new MermaidSectionRenderChild({} as never, section, undefined);
		child.onload();

		diagram.appendChild(document.createElement('svg'));
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
		expect(renderChildConstructor).toHaveBeenCalledOnce();

		child.onunload();
	});
});
