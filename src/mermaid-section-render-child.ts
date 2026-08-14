import { App, MarkdownRenderChild } from 'obsidian';
import { collectMermaidTargets } from './markdown';
import { MermaidViewerRenderChild } from './mermaid-render-child';

export class MermaidSectionRenderChild extends MarkdownRenderChild {
	private observer: MutationObserver | undefined;

	constructor(
		private readonly app: App,
		containerEl: HTMLElement,
		private readonly markdown: string | undefined,
	) {
		super(containerEl);
	}

	onload(): void {
		const window = this.containerEl.ownerDocument.defaultView;
		if (window) {
			this.observer = new window.MutationObserver(() => this.enhanceDiagrams());
			this.observer.observe(this.containerEl, { childList: true, subtree: true });
		}

		this.enhanceDiagrams();
	}

	onunload(): void {
		this.observer?.disconnect();
		this.observer = undefined;
	}

	private enhanceDiagrams(): void {
		for (const target of collectMermaidTargets(this.containerEl, this.markdown)) {
			this.addChild(new MermaidViewerRenderChild(this.app, target.element, target.source));
		}
	}
}
