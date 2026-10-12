import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('workflow files are valid YAML (a broken file silently stops every scheduled post)', () => {
  for (const f of ['.github/workflows/daily.yml', '.github/workflows/fetch-media.yml', '.github/workflows/feeds.yml']) {
    const out = execFileSync('python3', ['-c', `import yaml,sys; d=yaml.safe_load(open(sys.argv[1])); print('ok' if d.get(True) or d.get('on') else 'no triggers')`, f]).toString().trim();
    assert.equal(out, 'ok', f);
  }
});
