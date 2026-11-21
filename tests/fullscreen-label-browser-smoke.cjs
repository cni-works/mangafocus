const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { harness } = require('./inspector-groups-smoke.cjs');
const root = path.resolve(__dirname, '..');

for (const locale of ['en', 'ja']) {
    const editor = harness(locale);
    let tree = editor.render();
    let field = editor.findLabel(tree, 'Fullscreen button label');
    assert.ok(field, 'The fullscreen settings contain a label field.');
    if (locale === 'ja') assert.notEqual(field.props.label, 'Fullscreen button label');
    field.props.onChange('Open my comic');
    tree = editor.render();
    assert.equal(editor.findLabel(tree, 'Fullscreen button label').props.value, 'Open my comic');
    const reloaded = harness(locale);
    Object.assign(reloaded.attrs, JSON.parse(JSON.stringify(editor.attrs)));
    tree = reloaded.render();
    assert.equal(reloaded.findLabel(tree, 'Fullscreen button label').props.value, 'Open my comic');
    reloaded.findLabel(tree, 'Enable fullscreen mode').props.onChange(false);
    tree = reloaded.render();
    assert.equal(reloaded.findLabel(tree, 'Fullscreen button label'), null);
    assert.equal(reloaded.attrs.fullscreenButtonLabel, 'Open my comic');
}

(async () => {
    const markup = execFileSync(process.env.MANGAFOCUS_PHP || 'php',
        [path.join(__dirname, 'fullscreen-label-smoke.php'), '--fixture'], { encoding: 'utf8' });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://example.test/**', route => route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"/>',
        }));
        await page.setContent(markup);
        await page.evaluate(() => {
            window.wp = { i18n: { __: value => value } };
            let active = null;
            Object.defineProperty(document, 'fullscreenElement', { get: () => active });
            HTMLElement.prototype.requestFullscreen = function () {
                active = this;
                document.dispatchEvent(new Event('fullscreenchange'));
                return Promise.resolve();
            };
            document.exitFullscreen = () => {
                active = null;
                document.dispatchEvent(new Event('fullscreenchange'));
                return Promise.resolve();
            };
        });
        for (const source of ['blocks/viewer/layout.js', 'blocks/viewer/view.js']) {
            await page.addScriptTag({ path: path.join(root, source) });
        }
        const readers = page.locator('.amv-reader');
        assert.equal(await readers.count(), 2);
        for (const [index, label] of ['Start fullscreen', 'Open this comic'].entries()) {
            const reader = readers.nth(index);
            const launch = reader.locator(index ? '.amv-reader__cover-launcher-button' : '.amv-reader__fullscreen');
            assert.equal(await launch.textContent(), label);
            if (index) assert.equal(await launch.getAttribute('aria-label'), label);
            for (let cycle = 0; cycle < 2; cycle++) {
                await launch.click();
                await page.waitForFunction(() => !!document.fullscreenElement);
                assert.equal(await reader.locator('.amv-reader__fullscreen').textContent(), 'Exit fullscreen');
                await reader.locator('.amv-reader__fullscreen').click();
                await page.waitForFunction(() => !document.fullscreenElement);
                assert.equal(await launch.textContent(), label);
            }
        }
        assert.deepEqual(errors, []);
        console.log('PASS fullscreen labels: English/Japanese editor save/reload, independent viewers, cover and inline launch, repeated fullscreen enter/exit.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
