import {
	fitTransform,
	panBy,
	type Size,
	type TransformState,
	zoomAtPoint,
} from './transform';

const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.1;
const PAN_STEP = 100;
const FIT_PADDING = 0;

export interface MermaidViewerServices {
	copyText: (text: string) => Promise<void>;
	notify: (message: string) => void;
	onFullscreen: (viewer: MermaidViewer) => void;
	setIcon: (element: HTMLElement, icon: string) => void;
}

interface DragState {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startTransform: TransformState;
}

export class MermaidViewer {
	private readonly abortController: AbortController;
	private readonly contentSize: Size;
	private readonly originalNodes: Node[];
	private readonly root: HTMLElement;
	private readonly services: MermaidViewerServices;
	private readonly source: string | undefined;
	private readonly stage: HTMLElement;
	private readonly viewport: HTMLElement;
	private animationFrame: number | undefined;
	private destroyed = false;
	private dragState: DragState | undefined;
	private fullscreenPlaceholder: Comment | undefined;
	private minimumScale = MIN_SCALE;
	private resizeObserver: ResizeObserver | undefined;
	private state: TransformState = { x: 0, y: 0, scale: 1 };
	private fitted = true;

	constructor(
		root: HTMLElement,
		source: string | undefined,
		services: MermaidViewerServices,
	) {
		const window = root.ownerDocument.defaultView;
		if (!window) throw new Error('The Mermaid diagram must belong to a window');
		this.abortController = new window.AbortController();

		const svg = root.querySelector<SVGSVGElement>('svg');
		if (!svg) throw new Error('A rendered Mermaid SVG is required');
		if (root.dataset.mermaidViewerEnhanced === 'true') {
			throw new Error('The Mermaid diagram is already enhanced');
		}

		this.root = root;
		this.source = source;
		this.services = services;
		this.contentSize = measureSvg(svg);
		this.originalNodes = Array.from(root.childNodes);

		root.dataset.mermaidViewerEnhanced = 'true';
		root.classList.add('mermaid-viewer');
		root.style.setProperty(
			'--mermaid-viewer-height',
			`${calculateViewportHeight(svg, this.contentSize)}px`,
		);

		this.viewport = root.ownerDocument.createElement('div');
		this.viewport.className = 'mermaid-viewer-viewport';
		this.stage = root.ownerDocument.createElement('div');
		this.stage.className = 'mermaid-viewer-stage';
		this.stage.style.width = `${this.contentSize.width}px`;
		this.stage.style.height = `${this.contentSize.height}px`;

		for (const node of this.originalNodes) this.stage.appendChild(node);
		this.viewport.append(this.stage, this.createToolbar());
		root.appendChild(this.viewport);

		this.registerViewportEvents();
		this.registerResizeObserver();
		this.reset();
	}

	reset(): void {
		const maxScale = this.viewport.classList.contains('is-fullscreen')
			? MAX_SCALE
			: 1;
		this.state = fitTransform(
			{ width: this.viewport.clientWidth, height: this.viewport.clientHeight },
			this.contentSize,
			FIT_PADDING,
			maxScale,
		);
		this.minimumScale = Math.min(MIN_SCALE, this.state.scale);
		this.fitted = true;
		this.applyTransform();
	}

	enterFullscreen(host: HTMLElement): void {
		if (this.fullscreenPlaceholder) return;

		this.fullscreenPlaceholder = this.root.ownerDocument.createComment(
			'mermaid-viewer-viewport',
		);
		this.viewport.before(this.fullscreenPlaceholder);
		host.appendChild(this.viewport);
		this.viewport.classList.add('is-fullscreen');
		this.scheduleReset();
	}

	exitFullscreen(): void {
		if (!this.fullscreenPlaceholder) return;

		const placeholderParent = this.fullscreenPlaceholder.parentNode;
		if (placeholderParent) {
			placeholderParent.insertBefore(this.viewport, this.fullscreenPlaceholder);
		} else {
			this.root.appendChild(this.viewport);
		}
		this.fullscreenPlaceholder.remove();
		this.fullscreenPlaceholder = undefined;
		this.viewport.classList.remove('is-fullscreen');
		this.scheduleReset();
	}

	destroy(): void {
		this.destroyed = true;
		this.cancelScheduledReset();
		if (this.fullscreenPlaceholder) {
			const placeholderParent = this.fullscreenPlaceholder.parentNode;
			if (placeholderParent) {
				placeholderParent.insertBefore(this.viewport, this.fullscreenPlaceholder);
			} else {
				this.root.appendChild(this.viewport);
			}
			this.fullscreenPlaceholder.remove();
			this.fullscreenPlaceholder = undefined;
		}
		this.abortController.abort();
		this.resizeObserver?.disconnect();

		for (const node of this.originalNodes) this.root.insertBefore(node, this.viewport);
		this.viewport.remove();
		this.root.classList.remove('mermaid-viewer');
		this.root.style.removeProperty('--mermaid-viewer-height');
		delete this.root.dataset.mermaidViewerEnhanced;
	}

	private createToolbar(): HTMLElement {
		const toolbar = this.root.ownerDocument.createElement('div');
		toolbar.className = 'mermaid-viewer-toolbar';
		toolbar.setAttribute('role', 'toolbar');
		toolbar.setAttribute('aria-label', 'Mermaid 图表工具');

		toolbar.append(
			this.createButtonGroup([
				this.createButton('放大', 'plus', () => this.zoomBy(ZOOM_STEP)),
				this.createButton('重置视图', 'rotate-cw', () => this.reset()),
				this.createButton('缩小', 'minus', () => this.zoomBy(-ZOOM_STEP)),
			]),
			this.createButtonGroup([
				this.createButton('向左平移', 'arrow-left', () => this.pan(PAN_STEP, 0)),
				this.createButton('向上平移', 'arrow-up', () => this.pan(0, PAN_STEP)),
				this.createButton('向下平移', 'arrow-down', () => this.pan(0, -PAN_STEP)),
				this.createButton('向右平移', 'arrow-right', () => this.pan(-PAN_STEP, 0)),
			]),
			this.createButtonGroup([
				this.createButton(
					'复制 Mermaid 源码',
					'copy',
					() => void this.copySource(),
					this.source === undefined,
				),
				this.createButton('全屏查看', 'maximize', () => {
					this.services.onFullscreen(this);
				}),
			]),
		);

		return toolbar;
	}

	private createButtonGroup(buttons: HTMLButtonElement[]): HTMLElement {
		const group = this.root.ownerDocument.createElement('div');
		group.className = 'mermaid-viewer-toolbar-group';
		group.append(...buttons);
		return group;
	}

	private createButton(
		label: string,
		icon: string,
		onClick: () => void,
		disabled = false,
	): HTMLButtonElement {
		const button = this.root.ownerDocument.createElement('button');
		button.type = 'button';
		button.className = 'mermaid-viewer-toolbar-button';
		button.setAttribute('aria-label', label);
		button.disabled = disabled;
		this.services.setIcon(button, icon);
		button.addEventListener(
			'click',
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				onClick();
			},
			{ signal: this.abortController.signal },
		);
		return button;
	}

	private registerViewportEvents(): void {
		const signal = this.abortController.signal;
		this.viewport.addEventListener('pointerdown', (event) => this.startDrag(event), {
			signal,
		});
		this.viewport.addEventListener('pointermove', (event) => this.drag(event), { signal });
		this.viewport.addEventListener('pointerup', (event) => this.endDrag(event), { signal });
		this.viewport.addEventListener('pointercancel', (event) => this.endDrag(event), {
			signal,
		});
		this.viewport.addEventListener('wheel', (event) => this.onWheel(event), {
			passive: false,
			signal,
		});
	}

	private registerResizeObserver(): void {
		const ResizeObserverClass = this.root.ownerDocument.defaultView?.ResizeObserver;
		if (!ResizeObserverClass) return;

		this.resizeObserver = new ResizeObserverClass(() => {
			if (this.fitted) this.reset();
		});
		this.resizeObserver.observe(this.viewport);
	}

	private startDrag(event: PointerEvent): void {
		if (event.button !== 0 || (event.target as Element).closest('button')) return;

		this.dragState = {
			pointerId: event.pointerId,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startTransform: this.state,
		};
		this.fitted = false;
		this.viewport.classList.add('is-dragging');
		this.viewport.setPointerCapture(event.pointerId);
	}

	private drag(event: PointerEvent): void {
		if (event.pointerId !== this.dragState?.pointerId) return;

		event.preventDefault();
		this.state = panBy(
			this.dragState.startTransform,
			event.clientX - this.dragState.startClientX,
			event.clientY - this.dragState.startClientY,
		);
		this.applyTransform();
	}

	private endDrag(event: PointerEvent): void {
		if (event.pointerId !== this.dragState?.pointerId) return;

		this.dragState = undefined;
		this.viewport.classList.remove('is-dragging');
		if (this.viewport.hasPointerCapture(event.pointerId)) {
			this.viewport.releasePointerCapture(event.pointerId);
		}
	}

	private onWheel(event: WheelEvent): void {
		if (!event.ctrlKey && !event.metaKey) return;

		event.preventDefault();
		const rect = this.viewport.getBoundingClientRect();
		this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP, {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		});
	}

	private zoomBy(delta: number, anchor?: { x: number; y: number }): void {
		const zoomAnchor = anchor ?? {
			x: this.viewport.clientWidth / 2,
			y: this.viewport.clientHeight / 2,
		};
		this.state = zoomAtPoint(
			this.state,
			this.state.scale + delta,
			zoomAnchor,
			{ min: this.minimumScale, max: MAX_SCALE },
		);
		this.fitted = false;
		this.applyTransform();
	}

	private pan(deltaX: number, deltaY: number): void {
		this.state = panBy(this.state, deltaX, deltaY);
		this.fitted = false;
		this.applyTransform();
	}

	private async copySource(): Promise<void> {
		if (this.source === undefined) return;

		try {
			await this.services.copyText(this.source);
			this.services.notify('已复制 Mermaid 源码');
		} catch {
			this.services.notify('复制 Mermaid 源码失败');
		}
	}

	private applyTransform(): void {
		const x = roundTransformValue(this.state.x);
		const y = roundTransformValue(this.state.y);
		const scale = roundTransformValue(this.state.scale);
		this.stage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
	}

	private scheduleReset(): void {
		this.cancelScheduledReset();
		const window = this.root.ownerDocument.defaultView;
		if (!window?.requestAnimationFrame) {
			this.reset();
			return;
		}

		this.animationFrame = window.requestAnimationFrame(() => {
			this.animationFrame = undefined;
			if (!this.destroyed) this.reset();
		});
	}

	private cancelScheduledReset(): void {
		if (this.animationFrame === undefined) return;
		this.root.ownerDocument.defaultView?.cancelAnimationFrame(this.animationFrame);
		this.animationFrame = undefined;
	}
}

function measureSvg(svg: SVGSVGElement): Size {
	const bounds = svg.getBoundingClientRect();
	if (bounds.width > 0 && bounds.height > 0) {
		return { width: bounds.width, height: bounds.height };
	}

	const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
	const viewBoxWidth = viewBox?.[2];
	const viewBoxHeight = viewBox?.[3];
	if (
		viewBoxWidth !== undefined &&
		viewBoxHeight !== undefined &&
		viewBoxWidth > 0 &&
		viewBoxHeight > 0
	) {
		return { width: viewBoxWidth, height: viewBoxHeight };
	}

	return {
		width: Math.max(1, bounds.width),
		height: Math.max(1, bounds.height),
	};
}

function calculateViewportHeight(svg: SVGSVGElement, content: Size): number {
	const renderedHeight = svg.getBoundingClientRect().height;
	const preferredHeight = renderedHeight > 0 ? renderedHeight : content.height;
	return Math.ceil(Math.min(640, Math.max(180, preferredHeight + 16)));
}

function roundTransformValue(value: number): number {
	return Math.round(value * 1_000) / 1_000;
}
