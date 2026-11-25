// Parser check against trimmed real Hypixel forum markup. Run: npm test
const assert = require("node:assert");
const { parseThreads } = require("./index.js");

const html = `
<div class="structItem structItem--thread js-inlineModContainer js-threadListItem-6172091 structItem--thread-discussion structItem--thread-is-staff" data-author="Hypixel Team">
  <div class="structItem-title">
    <a href="/forums/skyblock-alpha/?prefix_id=5" class="labelLink"><span class="label">Alpha</span></a>
    <a href="/threads/sven-alpha-testing.6172091/" class="" data-tp-primary="on" data-xf-init="preview-tooltip"
      >
      [November 18] Sven Packmaster &amp; Fishing Alpha Testing
    </a>
  </div>
</div>
<div class="structItem structItem--thread js-inlineModContainer js-threadListItem-6174157 structItem--thread-discussion" data-author="Joshua">
  <div class="structItem-title"><a href="/threads/how-id-rework.6174157/" data-tp-primary="on">How I&#039;d rework it</a></div>
</div>`;

assert.deepStrictEqual(parseThreads(html), [
  { id: "6172091", title: "[November 18] Sven Packmaster & Fishing Alpha Testing", url: "https://hypixel.net/threads/sven-alpha-testing.6172091/", author: "Hypixel Team", staff: true },
  { id: "6174157", title: "How I'd rework it", url: "https://hypixel.net/threads/how-id-rework.6174157/", author: "Joshua", staff: false },
]);
console.log("parseThreads ok");
