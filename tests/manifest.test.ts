import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Manifest {
	id: string;
	version: string;
	minAppVersion: string;
	isDesktopOnly: boolean;
}

describe('plugin manifest', () => {
	it('uses matching package and compatibility versions', () => {
		const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')) as Manifest;
		const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
			version: string;
		};
		const versions = JSON.parse(readFileSync('versions.json', 'utf8')) as Record<
			string,
			string
		>;

		expect(manifest.id).toBe('mermaid-viewer');
		expect(manifest.version).toBe(packageJson.version);
		expect(versions[manifest.version]).toBe(manifest.minAppVersion);
		expect(manifest.isDesktopOnly).toBe(false);
	});
});
