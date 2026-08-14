import { App, MarkdownRenderChild, Notice, setIcon } from 'obsidian';
import { MermaidFullscreenModal } from './fullscreen-modal';
import { MermaidViewer } from './viewer';

export class MermaidViewerRenderChild extends MarkdownRenderChild {
	private fullscreenModal: MermaidFullscreenModal | undefined;
	private observer: MutationObserver | undefined;
	private viewer: MermaidViewer | undefined;

	constructor(
		private readonly app: App,
		containerEl: HTMLElement,
		private readonly source: string | undefined,
	) {
		super(containerEl);
		containerEl.dataset.mermaidViewerEnhanced = 'pending';
	}

	onload(): void {
		if (this.attachViewer()) return;

		const window = this.containerEl.ownerDocument.defaultView;
		if (!window) return;

		this.observer = new window.MutationObserver(() => {
			if (!this.attachViewer()) return;
			this.observer?.disconnect();
			this.observer = undefined;
		});
		this.observer.observe(this.containerEl, { childList: true, subtree: true });
	}

	onunload(): void {
		this.observer?.disconnect();
		this.fullscreenModal?.close();
		this.viewer?.destroy();
		if (this.containerEl.dataset.mermaidViewerEnhanced === 'pending') {
			delete this.containerEl.dataset.mermaidViewerEnhanced;
		}
		this.observer = undefined;
		this.fullscreenModal = undefined;
		this.viewer = undefined;
	}

	private attachViewer(): boolean {
		if (this.viewer) return true;
		if (!this.containerEl.querySelector('svg')) return false;

		this.viewer = new MermaidViewer(this.containerEl, this.source, {
			copyText: async (text) => {
				const clipboard = this.containerEl.ownerDocument.defaultView?.navigator.clipboard;
				if (!clipboard) throw new Error('Clipboard API is unavailable');
				await clipboard.writeText(text);
			},
			notify: (message) => new Notice(message),
			onFullscreen: (viewer) => this.openFullscreen(viewer),
			setIcon: (element, icon) => setIcon(element, icon),
		});
		return true;
	}

	private openFullscreen(viewer: MermaidViewer): void {
		if (this.fullscreenModal) return;

		const modal = new MermaidFullscreenModal(this.app, viewer, () => {
			if (this.fullscreenModal === modal) this.fullscreenModal = undefined;
		});
		this.fullscreenModal = modal;
		modal.open();
	}
}
