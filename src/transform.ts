export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface ScaleRange {
	min: number;
	max: number;
}

export interface TransformState extends Point {
	scale: number;
}

export function zoomAtPoint(
	state: TransformState,
	requestedScale: number,
	anchor: Point,
	range: ScaleRange,
): TransformState {
	const scale = Math.min(range.max, Math.max(range.min, requestedScale));
	const ratio = scale / state.scale;

	return {
		x: anchor.x - (anchor.x - state.x) * ratio,
		y: anchor.y - (anchor.y - state.y) * ratio,
		scale,
	};
}

export function panBy(
	state: TransformState,
	deltaX: number,
	deltaY: number,
): TransformState {
	return {
		x: state.x + deltaX,
		y: state.y + deltaY,
		scale: state.scale,
	};
}

export function fitTransform(
	viewport: Size,
	content: Size,
	padding: number,
	maxScale = 1,
): TransformState {
	if (viewport.width <= 0 || viewport.height <= 0) {
		return { x: 0, y: 0, scale: 1 };
	}

	if (content.width <= 0 || content.height <= 0) {
		return { x: 0, y: 0, scale: 1 };
	}

	const safePadding = Math.max(0, padding);
	const safeMaxScale = Number.isFinite(maxScale) && maxScale > 0 ? maxScale : 1;
	const availableWidth = Math.max(1, viewport.width - safePadding * 2);
	const availableHeight = Math.max(1, viewport.height - safePadding * 2);
	const scale = Math.min(
		safeMaxScale,
		availableWidth / content.width,
		availableHeight / content.height,
	);

	return {
		x: (viewport.width - content.width * scale) / 2,
		y: (viewport.height - content.height * scale) / 2,
		scale,
	};
}
