import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const translationDirectories = [
	['nodes/Manifest/translations', 'dist/nodes/Manifest/translations'],
	['credentials/translations', 'dist/credentials/translations'],
];

for (const [source, destination] of translationDirectories) {
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(source, destination, { recursive: true });
}
