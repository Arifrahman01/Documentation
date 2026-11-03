import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderMarkdown, sanitizeRenderedHtml } from '../src/lib/utils/markdown.ts';

/** Returns every attribute name that ended up on real elements after sanitizing. */
function attrNames(html) {
	const doc = new JSDOM(`<body>${html}</body>`).window.document;
	const names = new Set();
	doc.querySelectorAll('*').forEach((el) => [...el.attributes].forEach((a) => names.add(a.name)));
	return names;
}
function tagNames(html) {
	const doc = new JSDOM(`<body>${html}</body>`).window.document;
	return new Set([...doc.querySelectorAll('*')].map((el) => el.localName));
}

const XSS_PAYLOADS = {
	'script tag': '<p>a</p><script>alert(1)</script>',
	'svg onload': '<svg onload=alert(1)>',
	'svg nested script': '<svg><script>alert(1)</script></svg>',
	'img onerror': '<img src=x onerror=alert(1)>',
	'img onerror no space': '<img/src=x/onerror=alert(1)>',
	'unquoted onclick': '<a href=# onclick=alert(1)>x</a>',
	'javascript href': '<a href="javascript:alert(1)">x</a>',
	'entity-obfuscated javascript href': '<a href="jav&#x09;ascript:alert(1)">x</a>',
	'data:text/html href': '<a href="data:text/html,<script>alert(1)</script>">x</a>',
	'iframe srcdoc': '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
	'math mXSS': '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
	'details ontoggle': '<details open ontoggle=alert(1)>',
	'body onload': '<body onload=alert(1)>',
	'form action': '<form action="//evil"><button>x</button></form>',
	'style tag': '<style>body{display:none}</style>'
};

for (const [name, payload] of Object.entries(XSS_PAYLOADS)) {
	test(`sanitizeRenderedHtml neutralises: ${name}`, () => {
		const out = sanitizeRenderedHtml(payload);
		const attrs = attrNames(out);
		const tags = tagNames(out);
		for (const a of attrs) assert.ok(!a.startsWith('on'), `event handler attribute survived: ${a}`);
		for (const t of ['script', 'iframe', 'object', 'embed', 'style', 'form', 'meta', 'link', 'base']) {
			assert.ok(!tags.has(t), `<${t}> survived`);
		}
		assert.doesNotMatch(out, /href="\s*(javascript|data:text\/html)/i);
	});
}

test('renderMarkdown neutralises javascript: markdown links', () => {
	assert.doesNotMatch(renderMarkdown('[x](javascript:alert(1))'), /href="javascript:/i);
});

test('renderMarkdown escapes raw HTML-looking text (no live svg/onload)', () => {
	const out = renderMarkdown('hi\n\n<svg/onload=alert(1)>');
	for (const a of attrNames(out)) assert.ok(!a.startsWith('on'), `event handler survived: ${a}`);
});

test('renderMarkdown keeps legitimate features intact', () => {
	const out = renderMarkdown(
		[
			'# Title',
			'',
			'## Location',
			'',
			'## Normal heading',
			'',
			'| a | b |',
			'|---|---|',
			'| 1 | 2 |',
			'',
			'```sql',
			'SELECT * FROM t WHERE a < 5;',
			'```',
			'',
			'![gambar](/uploads/a.png)',
			'',
			'> [!WARNING] hati-hati',
			'',
			'[link](https://example.com)'
		].join('\n')
	);
	const doc = new JSDOM(`<body>${out}</body>`).window.document;

	// Outline navigation relies on these ids, even for names DOMPurify would treat as DOM-clobbering.
	assert.ok(doc.querySelector('h1#title'), 'h1#title missing');
	assert.ok(doc.querySelector('h2#location'), 'h2#location missing');
	assert.ok(doc.querySelector('h2#normal-heading'), 'h2#normal-heading missing');

	assert.ok(doc.querySelector('table'), 'table missing');
	assert.ok(doc.querySelector('button[data-copy-code].copy-code-btn'), 'copy-code button missing');
	assert.ok(doc.querySelector('.tok-keyword'), 'syntax highlighting missing');

	const img = doc.querySelector('img');
	assert.equal(img?.getAttribute('data-zoomable'), 'true');
	assert.equal(img?.getAttribute('loading'), 'lazy');
	assert.equal(img?.getAttribute('src'), '/uploads/a.png');

	assert.ok(doc.querySelector('[role="alert"]'), 'alert block missing');
	assert.equal(doc.querySelector('a[href^="https://example.com"]')?.getAttribute('href'), 'https://example.com');
});

test('heading ids that are not safe slugs are still dropped', () => {
	const out = sanitizeRenderedHtml('<h2 id="x&quot; onmouseover=&quot;alert(1)">t</h2>');
	for (const a of attrNames(out)) assert.ok(!a.startsWith('on'), `event handler survived: ${a}`);
});

test('links with target get rel=noopener noreferrer', () => {
	const out = sanitizeRenderedHtml('<a href="https://example.com" target="_blank">x</a>');
	const a = new JSDOM(`<body>${out}</body>`).window.document.querySelector('a');
	assert.equal(a?.getAttribute('rel'), 'noopener noreferrer');
});
