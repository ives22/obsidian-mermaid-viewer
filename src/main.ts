import { MarkdownView, Plugin } from 'obsidian';
import { MermaidSectionRenderChild } from './mermaid-section-render-child';

export default class MermaidViewerPlugin extends Plugin {
	onload(): void {
		this.registerMarkdownPostProcessor((element, context) => {
			const markdown = context.getSectionInfo(element)?.text;
			context.addChild(new MermaidSectionRenderChild(this.app, element, markdown));
		}, 100);

		this.app.workspace.onLayoutReady(() => {
			this.app.workspace.iterateAllLeaves((leaf) => {
				if (!(leaf.view instanceof MarkdownView)) return;
				if (leaf.view.getMode() !== 'preview') return;
				leaf.view.previewMode.rerender(true);
			});
		});
	}
}
