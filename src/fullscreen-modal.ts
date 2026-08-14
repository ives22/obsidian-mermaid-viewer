import { App, Modal } from 'obsidian';
import type { MermaidViewer } from './viewer';

export class MermaidFullscreenModal extends Modal {
	constructor(
		app: App,
		private readonly viewer: MermaidViewer,
		private readonly onClosed: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass('mermaid-viewer-modal');
		this.contentEl.addClass('mermaid-viewer-fullscreen-host');
		this.viewer.enterFullscreen(this.contentEl);
	}

	onClose(): void {
		this.viewer.exitFullscreen();
		this.contentEl.empty();
		this.onClosed();
	}
}
