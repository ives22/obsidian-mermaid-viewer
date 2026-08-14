import { extractMermaidBlocks } from './source';

export interface MermaidTarget {
	element: HTMLElement;
	source: string | undefined;
}

export function collectMermaidTargets(
	section: HTMLElement,
	markdown: string | undefined,
): MermaidTarget[] {
	const elements: HTMLElement[] = [];
	if (section.matches('.mermaid')) elements.push(section);
	elements.push(...Array.from(section.querySelectorAll<HTMLElement>('.mermaid')));

	const sources = markdown === undefined ? [] : extractMermaidBlocks(markdown);
	return elements
		.filter((element) => element.dataset.mermaidViewerEnhanced !== 'true')
		.map((element, index) => ({ element, source: sources[index] }));
}
