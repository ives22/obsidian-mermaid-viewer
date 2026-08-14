import { describe, expect, it } from 'vitest';
import { fitTransform, panBy, zoomAtPoint } from '../src/transform';

describe('diagram transforms', () => {
	it('keeps the selected viewport point fixed while zooming', () => {
		const result = zoomAtPoint(
			{ x: 0, y: 0, scale: 1 },
			1.1,
			{ x: 300, y: 200 },
			{ min: 0.5, max: 8 },
		);

		expect(result.x).toBeCloseTo(-30);
		expect(result.y).toBeCloseTo(-20);
		expect(result.scale).toBe(1.1);
	});

	it('clamps zoom to the configured range', () => {
		const maximum = zoomAtPoint(
			{ x: 10, y: 20, scale: 7.9 },
			10,
			{ x: 0, y: 0 },
			{ min: 0.5, max: 8 },
		);
		const minimum = zoomAtPoint(
			{ x: 10, y: 20, scale: 0.6 },
			0.01,
			{ x: 0, y: 0 },
			{ min: 0.5, max: 8 },
		);

		expect(maximum.scale).toBe(8);
		expect(minimum.scale).toBe(0.5);
	});

	it('pans without changing scale', () => {
		expect(panBy({ x: 10, y: 20, scale: 1.5 }, -100, 50)).toEqual({
			x: -90,
			y: 70,
			scale: 1.5,
		});
	});

	it('fits a large diagram inside the viewport and centers it', () => {
		const result = fitTransform(
			{ width: 1_000, height: 600 },
			{ width: 1_600, height: 800 },
			24,
		);

		expect(result.scale).toBeCloseTo(0.595);
		expect(result.x).toBeCloseTo(24);
		expect(result.y).toBeCloseTo(62);
	});

	it('does not enlarge a small diagram when fitting', () => {
		expect(
			fitTransform({ width: 1_000, height: 600 }, { width: 800, height: 400 }, 24),
		).toEqual({ x: 100, y: 100, scale: 1 });
	});

	it('enlarges a diagram when the fitting scale explicitly allows it', () => {
		expect(
			fitTransform(
				{ width: 1_200, height: 800 },
				{ width: 600, height: 300 },
				0,
				8,
			),
		).toEqual({ x: 0, y: 100, scale: 2 });
	});
});
