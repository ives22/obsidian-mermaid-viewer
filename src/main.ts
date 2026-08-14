import { Plugin } from 'obsidian';
import { collectMermaidTargets } from './markdown';
import { MermaidViewerRenderChild } from './mermaid-render-child';

export default class MermaidViewerPlugin extends Plugin {
	onload(): void {
		this.registerMarkdownPostProcessor((element, context) => {
			const markdown = context.getSectionInfo(element)?.text;
			const targets = collectMermaidTargets(element, markdown);

			for (const target of targets) {
				context.addChild(
					new MermaidViewerRenderChild(this.app, target.element, target.source),
				);
			}
		}, 100);
	}
}
