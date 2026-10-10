import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('browser asset build succeeds when optional local images are absent', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'workout-build-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, 'src/web'), { recursive: true });
	await writeFile(join(root, 'src/web/index.html'), '<main>workout</main>');
	await writeFile(join(root, 'src/web/styles.css'), 'body {}');
	const script = new URL('../scripts/build.mjs', import.meta.url).pathname;
	const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(await readFile(join(root, 'dist/web/index.html'), 'utf8'), '<main>workout</main>');
});
