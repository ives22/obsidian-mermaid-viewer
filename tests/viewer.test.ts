import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MermaidViewer } from '../src/viewer';

function createDiagram(renderedSize?: { width: number; height: number }): HTMLElement {
	const root = document.createElement('div');
	root.className = 'mermaid';
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 800 400');
	if (renderedSize) {
		vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 0, renderedSize.width, renderedSize.height),
		);
	}
	const diagram = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	diagram.id = 'diagram';
	svg.appendChild(diagram);
	root.appendChild(svg);
	document.body.appendChild(root);
	return root;
}

function setViewportSize(root: HTMLElement, width: number, height: number): void {
	const viewport = root.querySelector<HTMLElement>('.mermaid-viewer-viewport');
	if (!viewport) throw new Error('Viewer viewport was not created');

	Object.defineProperties(viewport, {
		clientWidth: { configurable: true, value: width },
		clientHeight: { configurable: true, value: height },
	});
}

describe('MermaidViewer', () => {
	beforeEach(() => {
		document.body.replaceChildren();
	});

	it('preserves the SVG rendered size as the default view', () => {
		const root = createDiagram({ width: 1_000, height: 500 });
		const viewer = new MermaidViewer(root, 'flowchart LR\nA --> B', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: (element, icon) => element.setAttribute('data-icon', icon),
		});
		setViewportSize(root, 1_000, 516);
		viewer.reset();

		const stage = root.querySelector<HTMLElement>('.mermaid-viewer-stage');
		expect(stage?.style.width).toBe('1000px');
		expect(stage?.style.height).toBe('500px');
		expect(stage?.style.transform).toContain('translate3d(0px, 8px, 0) scale(1)');

		root.querySelector<HTMLButtonElement>('[aria-label="放大"]')?.click();
		expect(stage?.style.transform).toContain('scale(1.1)');

		root.querySelector<HTMLButtonElement>('[aria-label="向右平移"]')?.click();
		expect(stage?.style.transform).toContain('translate3d(-150px, -17px, 0)');

		root.querySelector<HTMLButtonElement>('[aria-label="重置视图"]')?.click();
		expect(stage?.style.transform).toContain('translate3d(0px, 8px, 0) scale(1)');
	});

	it('keeps a small rendered diagram at its original size and centers it', () => {
		const root = createDiagram({ width: 600, height: 300 });
		const viewer = new MermaidViewer(root, 'flowchart LR\nA --> B', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});
		setViewportSize(root, 1_000, 316);
		viewer.reset();

		const stage = root.querySelector<HTMLElement>('.mermaid-viewer-stage');
		expect(stage?.style.width).toBe('600px');
		expect(stage?.style.transform).toContain('translate3d(200px, 8px, 0) scale(1)');
	});

	it('fits the diagram to fullscreen and restores its reading-mode size on exit', () => {
		const root = createDiagram({ width: 600, height: 300 });
		const fullscreenHost = document.createElement('div');
		document.body.appendChild(fullscreenHost);
		const viewer = new MermaidViewer(root, 'flowchart LR\nA --> B', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});
		setViewportSize(root, 600, 316);
		viewer.reset();

		const stage = root.querySelector<HTMLElement>('.mermaid-viewer-stage');
		expect(stage?.style.transform).toContain('translate3d(0px, 8px, 0) scale(1)');

		viewer.enterFullscreen(fullscreenHost);
		const fullscreenViewport = fullscreenHost.querySelector<HTMLElement>(
			'.mermaid-viewer-viewport',
		);
		if (!fullscreenViewport) throw new Error('Fullscreen viewport was not created');
		Object.defineProperties(fullscreenViewport, {
			clientWidth: { configurable: true, value: 1_200 },
			clientHeight: { configurable: true, value: 800 },
		});
		viewer.reset();

		expect(stage?.style.transform).toContain('translate3d(0px, 100px, 0) scale(2)');
		fullscreenHost.querySelector<HTMLButtonElement>('[aria-label="放大"]')?.click();
		expect(stage?.style.transform).toContain('translate3d(-30px, 85px, 0) scale(2.1)');
		fullscreenHost.querySelector<HTMLButtonElement>('[aria-label="重置视图"]')?.click();
		expect(stage?.style.transform).toContain('translate3d(0px, 100px, 0) scale(2)');

		viewer.exitFullscreen();
		setViewportSize(root, 600, 316);
		viewer.reset();

		expect(stage?.style.transform).toContain('translate3d(0px, 8px, 0) scale(1)');
	});

	it('does not jump up to 50% when fit-to-view needs a smaller scale', () => {
		const root = createDiagram({ width: 800, height: 400 });
		const viewer = new MermaidViewer(root, 'flowchart LR\nA --> B', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});
		setViewportSize(root, 320, 240);
		viewer.reset();

		const stage = root.querySelector<HTMLElement>('.mermaid-viewer-stage');
		expect(stage?.style.transform).toContain('scale(0.4)');
		root.querySelector<HTMLButtonElement>('[aria-label="缩小"]')?.click();
		expect(stage?.style.transform).toContain('scale(0.4)');
	});

	it('falls back to the SVG viewBox when rendered bounds are unavailable', () => {
		const root = createDiagram();
		const viewer = new MermaidViewer(root, 'flowchart LR\nA --> B', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});
		setViewportSize(root, 1_000, 416);
		viewer.reset();

		const stage = root.querySelector<HTMLElement>('.mermaid-viewer-stage');
		expect(stage?.style.width).toBe('800px');
		expect(stage?.style.height).toBe('400px');
		expect(stage?.style.transform).toContain('translate3d(100px, 8px, 0) scale(1)');
	});

	it('copies Mermaid source and opens fullscreen through injected services', async () => {
		const root = createDiagram();
		const copyText = vi.fn().mockResolvedValue(undefined);
		const notify = vi.fn();
		const onFullscreen = vi.fn();
		new MermaidViewer(root, 'sequenceDiagram\nA->>B: hello', {
			copyText,
			notify,
			onFullscreen,
			setIcon: vi.fn(),
		});

		root.querySelector<HTMLButtonElement>('[aria-label="复制 Mermaid 源码"]')?.click();
		await vi.waitFor(() => {
			expect(copyText).toHaveBeenCalledWith('sequenceDiagram\nA->>B: hello');
			expect(notify).toHaveBeenCalledWith('已复制 Mermaid 源码');
		});

		root.querySelector<HTMLButtonElement>('[aria-label="全屏查看"]')?.click();
		expect(onFullscreen).toHaveBeenCalledOnce();
	});

	it('disables source copy when the Markdown source is unavailable', () => {
		const root = createDiagram();
		new MermaidViewer(root, undefined, {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});

		expect(
			root.querySelector<HTMLButtonElement>('[aria-label="复制 Mermaid 源码"]')?.disabled,
		).toBe(true);
	});

	it('restores the original diagram DOM when destroyed', () => {
		const root = createDiagram();
		const viewer = new MermaidViewer(root, 'graph TD', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});

		viewer.destroy();

		expect(root.classList.contains('mermaid-viewer')).toBe(false);
		expect(root.dataset.mermaidViewerEnhanced).toBeUndefined();
		expect(root.children).toHaveLength(1);
		expect(root.firstElementChild?.tagName.toLowerCase()).toBe('svg');
	});

	it('restores the diagram when destroyed while fullscreen', () => {
		const root = createDiagram();
		const fullscreenHost = document.createElement('div');
		document.body.appendChild(fullscreenHost);
		const viewer = new MermaidViewer(root, 'graph TD', {
			copyText: vi.fn(),
			notify: vi.fn(),
			onFullscreen: vi.fn(),
			setIcon: vi.fn(),
		});

		viewer.enterFullscreen(fullscreenHost);
		expect(fullscreenHost.querySelector('.mermaid-viewer-viewport')).not.toBeNull();
		viewer.destroy();

		expect(root.querySelector('svg')).not.toBeNull();
		expect(fullscreenHost.childElementCount).toBe(0);
	});
});
