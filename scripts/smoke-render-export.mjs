import fs from 'fs';
import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import {
  Document,
  Paragraph,
  Packer,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

const htmlSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const forbiddenRemoteAssets = [
  'https://cdnjs',
  'https://cdn.jsdelivr',
  'https://unpkg',
  'script src="https',
  'link rel="stylesheet" href="https',
];

for (const pattern of forbiddenRemoteAssets) {
  if (htmlSource.includes(pattern)) {
    throw new Error(`Runtime CDN reference remains in index.html: ${pattern}`);
  }
}

marked.use(markedKatex({
  throwOnError: false,
  nonStandard: true,
  output: 'html',
}));

function looksLikeMathBlock(text) {
  const value = String(text || '').trim();
  return /\\[a-zA-Z]+|[_^]\{|[_^][A-Za-z0-9]|[A-Za-z0-9}]\s*=\s*\\?[A-Za-z{]|\\times|\\frac|\\sum|\\int/.test(value);
}

function normalizeBracketMathBlocks(text) {
  const lines = String(text || '').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].trim();
    if (open !== '[' && open !== '.[') {
      out.push(lines[i]);
      continue;
    }
    const body = [];
    let closeIndex = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const close = lines[j].trim();
      if (close === ']' || close === '].') {
        closeIndex = j;
        break;
      }
      body.push(lines[j]);
    }
    if (closeIndex !== -1 && looksLikeMathBlock(body.join('\n'))) {
      out.push('$$', body.join('\n').trim(), '$$');
      i = closeIndex;
    } else {
      out.push(lines[i]);
    }
  }
  return out.join('\n');
}

function normalizeMathMarkdown(markdown) {
  return String(markdown || '')
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map(part => {
      if (/^(```|~~~)/.test(part)) return part;
      return normalizeBracketMathBlocks(part)
        .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, body) => `\n$$\n${body.trim()}\n$$\n`)
        .replace(/\\\((.+?)\\\)/g, (_, body) => `$${body}$`);
    })
    .join('');
}

const markdown = `# Smoke Test

Inline math \\(E=mc^2\\) and **bold** text.

[ 
Precision_{delete} = \\frac{TP_{delete}}{TP_{delete}+FP_{delete}}
]

\\[
\\int_0^1 x^2 dx
\\]

- [ ] task
- item

| A | B |
|---|---|
| 1 | 2 |

\`\`\`js
const x = 1;
\`\`\`
`;

const rendered = marked.parse(normalizeMathMarkdown(markdown));
const katexCount = (rendered.match(/class="katex/g) || []).length;
if (katexCount < 3) {
  throw new Error('KaTeX markup was not rendered by marked.');
}

const doc = new Document({
  sections: [{
    children: [
      new Paragraph({ text: 'Smoke Test' }),
      new Paragraph({ children: [new TextRun('Inline math and Markdown export smoke.')] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [new TableCell({ children: [new Paragraph('A')] }), new TableCell({ children: [new Paragraph('B')] })] }),
          new TableRow({ children: [new TableCell({ children: [new Paragraph('1')] }), new TableCell({ children: [new Paragraph('2')] })] }),
        ],
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
if (!buffer || buffer.length < 1000) {
  throw new Error('DOCX smoke export produced an unexpectedly small buffer.');
}

console.log('smoke render/export ok');
