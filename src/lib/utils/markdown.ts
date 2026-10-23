import { marked } from 'marked';

export interface OutlineNode {
	id: string;
	text: string;
	level: number;
	children: OutlineNode[];
}

export function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

export function slugifyHeading(text: string): string {
	return decodeHtmlEntities(text.replace(/<[^>]+>/g, ''))
		.trim()
		.replace(/[*_`~]/g, '')
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-');
}

export function extractOutlineTree(markdownContent: string): OutlineNode[] {
	if (!markdownContent) return [];
	const lines = markdownContent.split('\n');
	const rawHeadings: { id: string; text: string; level: number }[] = [];
	const seenIds = new Map<string, number>();

	let insideCodeBlock = false;
	for (const line of lines) {
		if (line.trim().startsWith('```')) {
			insideCodeBlock = !insideCodeBlock;
			continue;
		}
		if (insideCodeBlock) continue;

		const m = line.match(/^(#{1,4})\s+(.+)$/);
		if (m) {
			const level = m[1].length;
			const cleanText = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, ''))
				.trim()
				.replace(/[*_`~]/g, '');
			const baseId = slugifyHeading(cleanText);
			if (baseId && cleanText) {
				const count = seenIds.get(baseId) || 0;
				seenIds.set(baseId, count + 1);
				const id = count === 0 ? baseId : `${baseId}-${count}`;
				rawHeadings.push({ id, text: cleanText, level });
			}
		}
	}

	if (rawHeadings.length === 0) return [];

	const rootNodes: OutlineNode[] = [];
	const stack: { node: OutlineNode; level: number }[] = [];

	for (const h of rawHeadings) {
		const node: OutlineNode = { id: h.id, text: h.text, level: h.level, children: [] };

		while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
			stack.pop();
		}

		if (stack.length === 0) {
			rootNodes.push(node);
		} else {
			stack[stack.length - 1].node.children.push(node);
		}

		stack.push({ node, level: h.level });
	}

	return rootNodes;
}

function highlightCodeSyntax(escapedCode: string): string {
	return escapedCode
		// Comments (// or # or -- or /* */)
		.replace(/(\/\/[^\n]*|--[^\n]*|#[^\n]*)/g, '<span class="tok-comment">$1</span>')
		// Strings ('...' or "...")
		.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|'[^'\n]*'|"[^"\n]*")/g, (match) => {
			if (match.includes('tok-')) return match;
			return `<span class="tok-string">${match}</span>`;
		})
		// Keywords (ABAP, SQL, JS/TS, SAC Formulas)
		.replace(
			/\b(SELECT|FROM|WHERE|INNER|LEFT|JOIN|ON|GROUP|BY|ORDER|AS|INTO|TABLE|DATA|TYPES|BEGIN|OF|END|FUNCTION|ENDFUNCTION|IF|ELSE|ELSEIF|ENDIF|CASE|WHEN|ENDCASE|LOOP|AT|ENDLOOP|RETURN|EXPORTING|IMPORTING|TABLES|EXCEPTIONS|CALL|READ|WRITE|APPEND|CLEAR|FREE|CONSTANTS|PARAMETERS|async|await|function|const|let|var|return|import|export|from|default|interface|type|class|extends|new|try|catch|finally|throw|true|false|null|undefined|SUM|AVG|COUNT|MIN|MAX|RESTRICT|LOOKUP)\b/g,
			'<span class="tok-keyword">$1</span>'
		)
		// Numbers
		.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
}

export function renderMarkdown(content: string): string {
	if (!content) return '';

	let raw = content;

	// Transform GitHub-style Alerts: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
	raw = raw.replace(
		/>\s*\[!NOTE\]\s*(.*?)(?=(\n\n|\n>|$))/gs,
		'<div class="my-4 rounded-xl border-l-4 border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground"><strong class="block mb-1 font-bold text-foreground">Catatan (Note)</strong>$1</div>'
	);
	raw = raw.replace(
		/>\s*\[!TIP\]\s*(.*?)(?=(\n\n|\n>|$))/gs,
		'<div class="my-4 rounded-xl border-l-4 border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground"><strong class="block mb-1 font-bold text-foreground">Tips Best Practice</strong>$1</div>'
	);
	raw = raw.replace(
		/>\s*\[!IMPORTANT\]\s*(.*?)(?=(\n\n|\n>|$))/gs,
		'<div class="my-4 rounded-xl border-l-4 border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground"><strong class="block mb-1 font-bold text-foreground">Penting (Important)</strong>$1</div>'
	);
	raw = raw.replace(
		/>\s*\[!WARNING\]\s*(.*?)(?=(\n\n|\n>|$))/gs,
		'<div class="my-4 rounded-xl border-l-4 border-border bg-muted/50 p-4 text-xs leading-relaxed text-foreground"><strong class="block mb-1 font-bold text-foreground">Perhatian (Warning)</strong>$1</div>'
	);
	raw = raw.replace(
		/>\s*\[!CAUTION\]\s*(.*?)(?=(\n\n|\n>|$))/gs,
		'<div class="my-4 rounded-xl border-l-4 border-destructive bg-destructive/10 p-4 text-xs leading-relaxed text-foreground"><strong class="block mb-1 font-bold text-destructive">Peringatan Kritis (Caution)</strong>$1</div>'
	);

	let parsed = marked.parse(raw) as string;

	// Wrap tables in responsive container
	parsed = parsed.replace(
		/<table>/g,
		'<div class="overflow-x-auto my-5 rounded-xl border border-border shadow-2xs"><table class="my-0">'
	);
	parsed = parsed.replace(/<\/table>/g, '</table></div>');

	// Add IDs to headings H1-H4 for Outline navigation (matching extractOutlineTree 100%)
	const seenIds = new Map<string, number>();
	parsed = parsed.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (_match, level, innerHtml) => {
		const baseId = slugifyHeading(innerHtml);
		const count = seenIds.get(baseId) || 0;
		seenIds.set(baseId, count + 1);
		const id = count === 0 ? baseId : `${baseId}-${count}`;
		return `<h${level} id="${id}" class="scroll-mt-24 group relative">${innerHtml}</h${level}>`;
	});

	// Enhance <pre><code class="language-xxx"> with Header Bar, Copy Button & Syntax Highlighting
	parsed = parsed.replace(
		/<pre><code(?:\s+class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g,
		(_match, lang, codeContent) => {
			const languageLabel = (lang || 'code').toUpperCase();
			const encodedRaw = encodeURIComponent(
				codeContent
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&amp;/g, '&')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
			);
			const highlighted = highlightCodeSyntax(codeContent);

			return `<div class="code-block-wrapper group/code relative my-5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-md">
				<div class="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 py-1.5 text-[11px] font-mono text-zinc-400">
					<span class="font-semibold tracking-wider text-zinc-300">${languageLabel}</span>
					<button type="button" data-copy-code="${encodedRaw}" class="copy-code-btn inline-flex items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-sans font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
						<span>Salin Kode</span>
					</button>
				</div>
				<pre class="!my-0 !rounded-none !border-0 !bg-transparent p-4 overflow-x-auto"><code class="language-${lang || 'text'}">${highlighted}</code></pre>
			</div>`;
		}
	);

	// Make images zoomable on click
	parsed = parsed.replace(
		/<img\s+([^>]*?)src="([^"]+)"([^>]*?)>/g,
		'<img $1src="$2"$3 data-zoomable="true" class="cursor-zoom-in" title="Klik untuk memperbesar gambar">'
	);

	return parsed;
}
