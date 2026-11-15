const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Sliders vertical centering and styling integrity', async (t) => {
  const stylesPath = path.join(__dirname, '..', 'src', 'styles.css');
  const dotifyStylesPath = path.join(__dirname, '..', 'src', 'styles', 'dotify-23-theme.css');

  const styles = fs.readFileSync(stylesPath, 'utf8');
  const dotifyStyles = fs.readFileSync(dotifyStylesPath, 'utf8');

  await t.test('1. Volume slider (#volume-slider) has properly centered thumb and no hardcoded 3px dark ring', () => {
    // Check volume slider thumb has margin-top for centered thumb (now modern slim thumb -6px)
    assert.match(styles, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*margin-top:\s*-(?:3|4|6)px/);
    assert.match(styles, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*height:\s*(?:12|16|20)px/);
    // Ensure no ugly box-shadow: 0 0 0 3px ... #1E1F22
    assert.doesNotMatch(styles, /#volume-slider::-webkit-slider-thumb\s*\{[^}]*box-shadow:\s*0\s+0\s+0\s+3px/);
  });

  await t.test('2. Settings slider (.sl) has clean fill and vertically centered thumb', () => {
    // Check .sl input[type="range"]::-webkit-slider-thumb has height for centering
    assert.match(styles, /\.sl\s+input\[type="range"\]::-webkit-slider-thumb\s*\{[^}]*height:\s*(?:20|28)px/);
    // Check .sl-active fills smoothly with var(--v)
    assert.match(styles, /\.sl-active\s*\{[^}]*width:\s*(?:calc\(var\(--v,\s*0\)\s*\*\s*100%\)|max\(0px,\s*calc\()/);
  });

  await t.test('3. .pill-range has centered thumb with proper margin-top', () => {
    assert.match(styles, /\.pill-range::-webkit-slider-thumb[^{]*\{[^}]*margin-top:\s*-4px/);
    assert.match(styles, /\.settings-view\s+\.pill-range::-webkit-slider-thumb\s*\{[^}]*margin-top:\s*-5px/);
  });

  await t.test('4. dotify-23-theme.css range thumbs have proper vertical centering', () => {
    assert.match(dotifyStyles, /\.dotify-red-range::-webkit-slider-thumb[^{]*\{[^}]*margin-top:\s*-6px/);
  });
});
