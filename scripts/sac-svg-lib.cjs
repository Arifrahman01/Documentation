const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'static', 'img', 'sac');
fs.mkdirSync(OUT_DIR, { recursive: true });

function esc(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// ============================================================================
// REUSABLE SAC HORIZON SVG PRIMITIVES
// ============================================================================

function sacCanvas({
	width = 1200,
	height = 680,
	storyTitle,
	sheetTitle,
	connection = 'LIVE CDS: S4HANA_PROD (J000)',
	filters = ['Company Code: All (Jhonlin Group)', 'Fiscal Year: 2026', 'Month: Jan - Oct'],
	body
}) {
	let filterX = 24;
	const filterPills = filters
		.map((f) => {
			const [label, val] = f.includes(':') ? f.split(':') : ['Filter', f];
			const pillW = Math.max(150, f.length * 6.8 + 34);
			const pill = `
      <g transform="translate(${filterX}, 60)">
        <rect width="${pillW}" height="30" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>
        <text x="10" y="19" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#64748b" font-weight="500">${esc(label.trim())}:</text>
        <text x="${14 + label.trim().length * 6.3}" y="19" font-family="Inter, system-ui, sans-serif" font-size="11" fill="#0f172a" font-weight="700">${esc((val || '').trim())}</text>
        <path d="M${pillW - 18} 13 L${pillW - 14} 18 L${pillW - 10} 13" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
      </g>`;
			filterX += pillW + 10;
			return pill;
		})
		.join('');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
  <defs>
    <linearGradient id="sacHeaderGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="60%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="blueBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="tealBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="amberBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
    </linearGradient>
    <filter id="cardShadow" x="-2%" y="-2%" width="104%" height="108%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Canvas Background -->
  <rect width="${width}" height="${height}" rx="12" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- SAC Top Shell Bar -->
  <path d="M0 12 Q0 0 12 0 L${width - 12} 0 Q${width} 0 ${width} 12 L${width} 48 L0 48 Z" fill="url(#sacHeaderGrad)"/>
  <rect x="18" y="12" width="28" height="24" rx="5" fill="#0070f2"/>
  <text x="32" y="28" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="800" fill="#ffffff">SAC</text>
  <text x="56" y="23" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${esc(storyTitle)}</text>
  <text x="56" y="38" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="500" fill="#94a3b8">Active Sheet: ${esc(sheetTitle)}</text>

  <!-- Live CDS Badge -->
  <rect x="${width - 270}" y="12" width="252" height="24" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <circle cx="${width - 254}" cy="24" r="4" fill="#10b981"/>
  <text x="${width - 242}" y="28" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" fill="#e2e8f0">${esc(connection)}</text>

  <!-- Global Input Filter Bar -->
  <rect x="0" y="48" width="${width}" height="52" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
  ${filterPills}

  <!-- Active Sheet Tab Indicator on Right -->
  <rect x="${width - 195}" y="60" width="175" height="30" rx="6" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
  <text x="${width - 107}" y="79" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" fill="#1d4ed8">${esc(sheetTitle.slice(0, 24))}</text>

  <!-- Story Content Area -->
  ${body}
</svg>`;
}

function widgetFrame({ x, y, w, h, id, title, subtitle, rightBadge = '', inner = '' }) {
	const badgeW = id ? Math.max(28, id.length * 7 + 12) : 0;
	const titleX = id ? x + 14 + badgeW + 8 : x + 14;
	return `
  <g filter="url(#cardShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="${x}" y1="${y + 42}" x2="${x + w}" y2="${y + 42}" stroke="#f1f5f9" stroke-width="1"/>
    ${
			id
				? `<rect x="${x + 14}" y="${y + 11}" width="${badgeW}" height="20" rx="4" fill="#eff6ff" stroke="#bfdbfe" stroke-width="1"/>
           <text x="${x + 14 + badgeW / 2}" y="${y + 25}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#1d4ed8">${esc(id)}</text>`
				: ''
		}
    <text x="${titleX}" y="${y + 21}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700" fill="#0f172a">${esc(title)}</text>
    <text x="${titleX}" y="${y + 35}" font-family="Inter, system-ui, sans-serif" font-size="10" fill="#64748b">${esc(subtitle || '')}</text>
    ${
			rightBadge
				? `<rect x="${x + w - Math.max(76, rightBadge.length * 6.2 + 16) - 12}" y="${y + 12}" width="${Math.max(76, rightBadge.length * 6.2 + 16)}" height="19" rx="4" fill="#f8fafc" stroke="#e2e8f0"/>
           <text x="${x + w - 12 - Math.max(76, rightBadge.length * 6.2 + 16) / 2}" y="${y + 25}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="600" fill="#475569">${esc(rightBadge)}</text>`
				: ''
		}
    ${inner}
  </g>`;
}

function kpiTile({
	x,
	y,
	w,
	h,
	id,
	title,
	value,
	unit = '',
	subtext = '',
	delta = '',
	positive = true,
	accent = '#0070f2',
	spark = [40, 52, 48, 65, 60, 78, 85]
}) {
	const deltaColor = positive ? '#059669' : '#dc2626';
	const deltaBg = positive ? '#ecfdf5' : '#fef2f2';
	const sparkW = Math.min(80, w * 0.34);
	const sparkH = 24;
	const sx = x + w - sparkW - 12;
	const sy = y + h - sparkH - 12;
	const pts = spark
		.map((v, i) => {
			const px = sx + (i / (spark.length - 1)) * sparkW;
			const py = sy + sparkH - (v / 100) * sparkH;
			return `${px.toFixed(1)},${py.toFixed(1)}`;
		})
		.join(' ');

	return `
  <g filter="url(#cardShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="${x}" y="${y}" width="4" height="${h}" rx="2" fill="${accent}"/>
    ${
			id
				? `<rect x="${x + 12}" y="${y + 10}" width="${Math.max(26, id.length * 6.5 + 8)}" height="16" rx="3" fill="#eff6ff"/>
           <text x="${x + 12 + Math.max(26, id.length * 6.5 + 8) / 2}" y="${y + 21}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#1d4ed8">${esc(id)}</text>`
				: ''
		}
    <text x="${id ? x + 46 : x + 14}" y="${y + 22}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600" fill="#475569">${esc(title)}</text>
    <text x="${x + 14}" y="${y + 52}" font-family="Inter, system-ui, sans-serif" font-size="21" font-weight="800" fill="#0f172a">${esc(value)} <tspan font-size="11" font-weight="600" fill="#64748b">${esc(unit)}</tspan></text>
    ${
			delta
				? `<rect x="${x + 14}" y="${y + h - 28}" width="${Math.max(66, delta.length * 6 + 12)}" height="18" rx="4" fill="${deltaBg}"/>
           <text x="${x + 20}" y="${y + h - 16}" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="700" fill="${deltaColor}">${esc(delta)}</text>`
				: ''
		}
    ${
			subtext && !delta
				? `<text x="${x + 14}" y="${y + h - 14}" font-family="Inter, system-ui, sans-serif" font-size="10" fill="#64748b">${esc(subtext)}</text>`
				: ''
		}
    <polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
}

function comboChartWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	categories,
	bars1,
	bars2,
	lineVals,
	bar1Label = 'Actual Current',
	bar2Label = 'Target / Prev',
	lineLabel = 'Margin / Benchmark %',
	unitLeft = 'IDR Bn',
	unitRight = '%'
}) {
	const padL = 48;
	const padR = 44;
	const padT = 68;
	const padB = 34;
	const plotW = w - padL - padR;
	const plotH = h - padT - padB;
	const gx = x + padL;
	const gy = y + padT;
	const maxBar = Math.max(...bars1, ...(bars2 || [0]), 1) * 1.15;
	const maxLine = Math.max(...(lineVals || [100]), 1) * 1.2;

	let grid = '';
	for (let i = 0; i <= 4; i++) {
		const ly = gy + plotH - (i / 4) * plotH;
		const lv = Math.round((i / 4) * maxBar);
		const rv = Math.round((i / 4) * maxLine);
		grid += `<line x1="${gx}" y1="${ly}" x2="${gx + plotW}" y2="${ly}" stroke="#e2e8f0" stroke-dasharray="3,3"/>`;
		grid += `<text x="${gx - 6}" y="${ly + 3}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#64748b">${lv}</text>`;
		if (lineVals) {
			grid += `<text x="${gx + plotW + 6}" y="${ly + 3}" font-family="JetBrains Mono, monospace" font-size="9" fill="#d97706">${rv}${esc(unitRight)}</text>`;
		}
	}

	const step = plotW / categories.length;
	let barsSvg = '';
	let linePts = [];

	categories.forEach((cat, idx) => {
		const cx = gx + idx * step + step / 2;
		const bw = bars2 ? Math.min(18, step * 0.32) : Math.min(26, step * 0.48);
		const h1 = (bars1[idx] / maxBar) * plotH;
		const bx1 = bars2 ? cx - bw - 1 : cx - bw / 2;
		barsSvg += `<rect x="${bx1}" y="${gy + plotH - h1}" width="${bw}" height="${h1}" rx="3" fill="url(#blueBar)"/>`;

		if (bars2) {
			const h2 = (bars2[idx] / maxBar) * plotH;
			barsSvg += `<rect x="${cx + 1}" y="${gy + plotH - h2}" width="${bw}" height="${h2}" rx="3" fill="#94a3b8"/>`;
		}
		barsSvg += `<text x="${cx}" y="${gy + plotH + 16}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9.5" fill="#475569" font-weight="500">${esc(cat)}</text>`;

		if (lineVals && lineVals[idx] !== undefined) {
			const ly = gy + plotH - (lineVals[idx] / maxLine) * plotH;
			linePts.push({ x: cx, y: ly, v: lineVals[idx] });
		}
	});

	let lineSvg = '';
	if (linePts.length > 0) {
		const ptsStr = linePts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
		lineSvg += `<polyline points="${ptsStr}" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
		linePts.forEach((p) => {
			lineSvg += `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#ffffff" stroke="#d97706" stroke-width="2"/>`;
			lineSvg += `<text x="${p.x}" y="${p.y - 7}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="#b45309">${p.v}${esc(unitRight)}</text>`;
		});
	}

	const legend = `
    <g transform="translate(${x + w - 310}, ${y + 47})">
      <rect x="0" y="2" width="10" height="10" rx="2" fill="#2563eb"/>
      <text x="14" y="10" font-family="Inter, system-ui, sans-serif" font-size="9.5" fill="#334155">${esc(bar1Label)}</text>
      ${
				bars2
					? `<rect x="105" y="2" width="10" height="10" rx="2" fill="#94a3b8"/>
             <text x="119" y="10" font-family="Inter, system-ui, sans-serif" font-size="9.5" fill="#334155">${esc(bar2Label)}</text>`
					: ''
			}
      ${
				lineVals
					? `<line x1="200" y1="7" x2="214" y2="7" stroke="#f59e0b" stroke-width="2.5"/>
             <circle cx="207" cy="7" r="3" fill="#ffffff" stroke="#d97706" stroke-width="1.5"/>
             <text x="218" y="10" font-family="Inter, system-ui, sans-serif" font-size="9.5" fill="#334155">${esc(lineLabel)}</text>`
					: ''
			}
    </g>`;

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge: unitLeft,
		inner: `${legend}${grid}${barsSvg}${lineSvg}`
	});
}

function horizontalBarWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	items,
	unit = '',
	color = '#0070f2'
}) {
	const padT = 54;
	const rowH = Math.min(34, (h - padT - 14) / items.length);
	const maxVal = Math.max(...items.map((i) => i.val), 1) * 1.12;
	const barStartX = x + 135;
	const maxBarW = w - 215;

	let rowsSvg = '';
	items.forEach((it, idx) => {
		const ry = y + padT + idx * rowH;
		const bw = Math.max(8, (it.val / maxVal) * maxBarW);
		const barFill = it.color || color;
		rowsSvg += `
      <text x="${x + 14}" y="${ry + 15}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600" fill="#334155">${esc(it.label)}</text>
      <rect x="${barStartX}" y="${ry + 4}" width="${maxBarW}" height="14" rx="3" fill="#f1f5f9"/>
      <rect x="${barStartX}" y="${ry + 4}" width="${bw}" height="14" rx="3" fill="${barFill}"/>
      <text x="${barStartX + bw + 6}" y="${ry + 15}" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#0f172a">${esc(it.display || it.val + ' ' + unit)}</text>
    `;
	});

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge: unit,
		inner: rowsSvg
	});
}

function multiLineWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	categories,
	series,
	unit = 'USD/MT'
}) {
	const padL = 48;
	const padR = 24;
	const padT = 66;
	const padB = 32;
	const plotW = w - padL - padR;
	const plotH = h - padT - padB;
	const gx = x + padL;
	const gy = y + padT;
	const allVals = series.flatMap((s) => s.data);
	const minVal = Math.floor(Math.min(...allVals) * 0.9);
	const maxVal = Math.ceil(Math.max(...allVals) * 1.08);
	const range = Math.max(maxVal - minVal, 1);

	let grid = '';
	for (let i = 0; i <= 4; i++) {
		const ly = gy + plotH - (i / 4) * plotH;
		const lv = Math.round(minVal + (i / 4) * range);
		grid += `<line x1="${gx}" y1="${ly}" x2="${gx + plotW}" y2="${ly}" stroke="#e2e8f0" stroke-dasharray="3,3"/>`;
		grid += `<text x="${gx - 6}" y="${ly + 3}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="9" fill="#64748b">${lv}</text>`;
	}

	categories.forEach((cat, idx) => {
		const cx = gx + (idx / Math.max(categories.length - 1, 1)) * plotW;
		grid += `<text x="${cx}" y="${gy + plotH + 16}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9.5" fill="#475569">${esc(cat)}</text>`;
	});

	let linesSvg = '';
	let legendSvg = '';
	series.forEach((s, sIdx) => {
		const pts = s.data.map((v, idx) => {
			const px = gx + (idx / Math.max(categories.length - 1, 1)) * plotW;
			const py = gy + plotH - ((v - minVal) / range) * plotH;
			return { x: px, y: py, v };
		});
		const ptsStr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
		if (sIdx === 0 && series.length === 1) {
			const areaPts = `${gx},${gy + plotH} ${ptsStr} ${gx + plotW},${gy + plotH}`;
			linesSvg += `<polygon points="${areaPts}" fill="url(#areaBlue)"/>`;
		}
		linesSvg += `<polyline points="${ptsStr}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
		pts.forEach((p, idx) => {
			linesSvg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#ffffff" stroke="${s.color}" stroke-width="2"/>`;
			if (idx === pts.length - 1 || idx === 0 || idx === Math.floor(pts.length / 2)) {
				linesSvg += `<text x="${p.x}" y="${p.y - 7}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" font-weight="700" fill="${s.color}">${p.v}</text>`;
			}
		});
		const lx = x + 16 + sIdx * 125;
		legendSvg += `
      <line x1="${lx}" y1="${y + 51}" x2="${lx + 14}" y2="${y + 51}" stroke="${s.color}" stroke-width="2.5"/>
      <circle cx="${lx + 7}" cy="${y + 51}" r="3" fill="#ffffff" stroke="${s.color}" stroke-width="1.5"/>
      <text x="${lx + 20}" y="${y + 54}" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="600" fill="#334155">${esc(s.name)}</text>
    `;
	});

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge: unit,
		inner: `${legendSvg}${grid}${linesSvg}`
	});
}

function tableWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	columns,
	rows,
	formula = '',
	rightBadge = 'SAC Table'
}) {
	const startY = formula ? y + 66 : y + 44;
	const rowH = Math.min(26, (h - (startY - y) - 28) / Math.max(rows.length, 1));
	const colW = (w - 24) / columns.length;

	let formulaSvg = '';
	if (formula) {
		formulaSvg = `
      <rect x="${x + 12}" y="${y + 44}" width="${w - 24}" height="18" rx="4" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
      <text x="${x + 18}" y="${y + 56}" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="#2563eb">fx</text>
      <text x="${x + 36}" y="${y + 56}" font-family="JetBrains Mono, monospace" font-size="9.5" fill="#0f172a">${esc(formula)}</text>
    `;
	}

	let headerSvg = `<rect x="${x + 12}" y="${startY}" width="${w - 24}" height="22" rx="4" fill="#f1f5f9"/>`;
	columns.forEach((col, cIdx) => {
		const cx = x + 18 + cIdx * colW;
		headerSvg += `<text x="${cx}" y="${startY + 15}" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="700" fill="#334155">${esc(col)}</text>`;
	});

	let rowsSvg = '';
	rows.forEach((r, rIdx) => {
		const ry = startY + 22 + rIdx * rowH;
		const isBold = r.bold;
		if (isBold) {
			rowsSvg += `<rect x="${x + 12}" y="${ry}" width="${w - 24}" height="${rowH}" fill="#eff6ff"/>`;
		} else if (rIdx % 2 === 1) {
			rowsSvg += `<rect x="${x + 12}" y="${ry}" width="${w - 24}" height="${rowH}" fill="#f8fafc"/>`;
		}
		rowsSvg += `<line x1="${x + 12}" y1="${ry + rowH}" x2="${x + w - 12}" y2="${ry + rowH}" stroke="#e2e8f0" stroke-width="0.7"/>`;

		r.cells.forEach((cell, cIdx) => {
			const cx = x + 18 + cIdx * colW;
			const textStr = String(cell);
			let fill = isBold ? '#0f172a' : '#334155';
			if (textStr.startsWith('+') || textStr.includes('▲') || textStr.includes('PASS') || textStr.includes('ACTIVE')) {
				fill = '#059669';
			} else if (textStr.startsWith('-') || textStr.includes('▼') || textStr.includes('CRITICAL') || textStr.includes('BREAKDOWN')) {
				fill = '#dc2626';
			}
			rowsSvg += `<text x="${cx}" y="${ry + rowH * 0.68}" font-family="${cIdx === 0 ? 'Inter, system-ui, sans-serif' : 'JetBrains Mono, monospace'}" font-size="9.5" font-weight="${isBold || cIdx === 0 ? '700' : '500'}" fill="${fill}">${esc(textStr)}</text>`;
		});
	});

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge,
		inner: `${formulaSvg}${headerSvg}${rowsSvg}`
	});
}

function donutWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	centerTitle,
	centerVal,
	slices
}) {
	const cx = x + Math.min(115, w * 0.34);
	const cy = y + 42 + (h - 42) / 2;
	const r = Math.min(62, (h - 70) / 2);
	const circum = 2 * Math.PI * r;
	let offset = 0;

	let arcs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="20"/>`;
	let legend = '';

	slices.forEach((s, idx) => {
		const dash = (s.pct / 100) * circum;
		arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="20" stroke-dasharray="${dash.toFixed(1)} ${circum.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
		offset += dash;

		const ly = y + 64 + idx * 28;
		const lx = x + Math.min(205, w * 0.56);
		legend += `
      <rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${s.color}"/>
      <text x="${lx + 16}" y="${ly}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="600" fill="#334155">${esc(s.label)}</text>
      <text x="${x + w - 16}" y="${ly}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#0f172a">${esc(s.val)} (${s.pct}%)</text>
    `;
	});

	const centerText = `
    <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="600" fill="#64748b">${esc(centerTitle)}</text>
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" font-weight="800" fill="#0f172a">${esc(centerVal)}</text>
  `;

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge: 'Donut Chart',
		inner: `${arcs}${centerText}${legend}`
	});
}

function waterfallWidget({
	x,
	y,
	w,
	h,
	id,
	title,
	subtitle,
	steps,
	unit = 'USD/MT'
}) {
	const padL = 46;
	const padR = 20;
	const padT = 62;
	const padB = 34;
	const plotW = w - padL - padR;
	const plotH = h - padT - padB;
	const gx = x + padL;
	const gy = y + padT;

	const maxVal = Math.max(...steps.map((s) => Math.max(s.start || 0, s.end || 0, Math.abs(s.val)))) * 1.18;
	const stepW = plotW / steps.length;

	let svg = '';
	for (let i = 0; i <= 4; i++) {
		const ly = gy + plotH - (i / 4) * plotH;
		svg += `<line x1="${gx}" y1="${ly}" x2="${gx + plotW}" y2="${ly}" stroke="#e2e8f0" stroke-dasharray="3,3"/>`;
	}

	steps.forEach((st, idx) => {
		const cx = gx + idx * stepW + stepW / 2;
		const bw = Math.min(36, stepW * 0.56);
		const topVal = Math.max(st.start, st.end);
		const botVal = Math.min(st.start, st.end);
		const yTop = gy + plotH - (topVal / maxVal) * plotH;
		const yBot = gy + plotH - (botVal / maxVal) * plotH;
		const barH = Math.max(6, yBot - yTop);
		const fill = st.isTotal ? '#1d4ed8' : st.val >= 0 ? '#10b981' : '#ef4444';

		svg += `<rect x="${cx - bw / 2}" y="${yTop}" width="${bw}" height="${barH}" rx="3" fill="${fill}"/>`;
		svg += `<text x="${cx}" y="${yTop - 6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="${fill}">${st.val >= 0 && !st.isTotal ? '+' : ''}${st.val}</text>`;
		svg += `<text x="${cx}" y="${gy + plotH + 16}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="600" fill="#334155">${esc(st.label)}</text>`;
	});

	return widgetFrame({
		x,
		y,
		w,
		h,
		id,
		title,
		subtitle,
		rightBadge: unit,
		inner: svg
	});
}

function saveSvg(filename, content) {
	const fullPath = path.join(OUT_DIR, filename);
	fs.writeFileSync(fullPath, content, 'utf8');
	console.log('Generated:', filename);
}

module.exports = {
	sacCanvas,
	widgetFrame,
	kpiTile,
	comboChartWidget,
	horizontalBarWidget,
	multiLineWidget,
	tableWidget,
	donutWidget,
	waterfallWidget,
	saveSvg,
	esc
};
