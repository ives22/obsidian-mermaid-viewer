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
		.map((element, index) => ({ element, source: sources[index] }))
		.filter((target) => target.element.dataset.mermaidViewerEnhanced === undefined);
}
