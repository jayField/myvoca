// 회화 노트 as a PDF to keep or print. The page is drawn in the browser (so Japanese and Korean use the fonts
// already loaded) and cut into A4 pages between entries, never through one.
import type { Phrase } from '../types';
import { dayLabel, localDate } from './dates';
import { phraseSound } from './phrases';

const WIDTH = 720; // px of the drawn sheet; maps onto the A4 width inside the margins
const PAGE_MM = { w: 210, h: 297, margin: 12 };
const INK = '#161a24';
const MUTED = '#5b6273';
const ACCENT = '#3550c7';
const LINE = '#dde1ea';
const FONT = "'IBM Plex Sans KR', 'Noto Sans JP', system-ui, sans-serif";
const FONT_JA = "'Noto Sans JP', 'IBM Plex Sans KR', sans-serif";

function el(tag: string, style: string, text?: string, ja = false): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = style + (ja ? `font-family:${FONT_JA};` : '');
  if (ja) node.lang = 'ja';
  if (text) node.textContent = text;
  return node;
}

function entry(p: Phrase): HTMLElement {
  const box = el('div', `padding:14px 0;border-bottom:1px solid ${LINE};display:flex;flex-direction:column;gap:5px;`);
  box.append(el('div', 'font-size:20px;font-weight:700;', p.japanese, true));
  const reading = el('div', `font-size:13px;color:${MUTED};`);
  reading.append(el('span', '', p.reading, true), el('span', `color:${ACCENT};margin-left:10px;`, phraseSound(p)));
  box.append(reading, el('div', 'font-size:15px;font-weight:600;', p.meaning));
  return box;
}

/** The sheet as one tall element; its direct children are the blocks pages may break between. */
function sheet(phrases: Phrase[]): HTMLElement {
  const root = el(
    'div',
    `position:fixed;left:-10000px;top:0;width:${WIDTH}px;background:#fff;color:${INK};font-family:${FONT};line-height:1.5;`,
  );
  const head = el('div', `padding-bottom:12px;border-bottom:2px solid ${INK};`);
  head.append(
    el('div', 'font-size:26px;font-weight:700;', '회화 노트'),
    el('div', `font-size:13px;color:${MUTED};`, `${dayLabel(localDate())} 기준 · 표현 ${phrases.length}개`),
  );
  root.append(head);
  for (const p of phrases) root.append(entry(p));
  return root;
}

/** Where to cut a sheet of `total` px into pages of `pageHeight` px, given the bottoms of its blocks. */
export function pageBreaks(bottoms: number[], total: number, pageHeight: number): number[] {
  const cuts = [0];
  while (total - cuts[cuts.length - 1] > pageHeight) {
    const start = cuts[cuts.length - 1];
    const fit = bottoms.filter((b) => b > start && b <= start + pageHeight);
    // A single block taller than a page has to be cut through.
    cuts.push(fit.length ? Math.max(...fit) : start + pageHeight);
  }
  return [...cuts, total];
}

export async function downloadPhrasesPdf(phrases: Phrase[]): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  await document.fonts.ready;
  const root = sheet(phrases);
  document.body.append(root);
  try {
    const scale = 2;
    const canvas = await html2canvas(root, { scale, backgroundColor: '#ffffff' });
    const top = root.getBoundingClientRect().top;
    const bottoms = [...root.children].map((c) => (c.getBoundingClientRect().bottom - top) * scale);
    const contentW = PAGE_MM.w - PAGE_MM.margin * 2;
    const pxPerMm = canvas.width / contentW;
    const pageHeight = Math.floor((PAGE_MM.h - PAGE_MM.margin * 2) * pxPerMm);
    const cuts = pageBreaks(bottoms, canvas.height, pageHeight);

    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    for (let i = 0; i < cuts.length - 1; i++) {
      const h = cuts[i + 1] - cuts[i];
      const page = document.createElement('canvas');
      page.width = canvas.width;
      page.height = h;
      const ctx = page.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, page.width, h);
      ctx.drawImage(canvas, 0, cuts[i], canvas.width, h, 0, 0, canvas.width, h);
      if (i > 0) pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', PAGE_MM.margin, PAGE_MM.margin, contentW, h / pxPerMm);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`${i + 1} / ${cuts.length - 1}`, PAGE_MM.w / 2, PAGE_MM.h - 5, { align: 'center' });
    }
    pdf.save(`회화노트-${localDate()}.pdf`);
  } finally {
    root.remove();
  }
}
