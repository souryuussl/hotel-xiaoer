#!/usr/bin/env node
/**
 * 把 knowledge/source/*.md 切成适合检索的知识块，输出 assets/kb.json。
 * 只保留“可讲”的内容：导读、知识主干、专业词汇、任务实训、泰安链接。
 * 排除思考练习、参考答案、评分要点、附录、思维导图等。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'knowledge', 'source');
const MANIFEST_PATH = path.join(ROOT, 'knowledge', 'manifest.json');
const OUT_PATH = path.join(ROOT, 'assets', 'kb.json');

const MAX_CHARS = 620;
const MIN_CHARS = 80;

const BLOCK_HEADING = /(参考答案|评分要点|附录|思考练习|单项选择题|判断题|简答题|案例分析题|知识总览|思维导图|封面字段|课程基本信息|学分及参考学时|教学实施与保障|授课进程|字段来源|学时校验|教学计划任务名|体例与阅读顺序|总目录|情境示例与数据声明)/;

function cleanHeading(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[一二三四五六七八九十]+、\s*/, '')
    .replace(/^（[一二三四五六七八九十]+）\s*/, '')
    .trim();
}

function cleanText(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^\s*>\s*\*\*(?:项目名称|所属课程|版本|日期)\*\*.*$/gm, '')
    .replace(/^\s*>\s*.*(?:教学情境示例|不指向任何特定企业).*$/gm, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitLongParagraph(paragraph, maxChars) {
  if (paragraph.length <= maxChars) return [paragraph];
  const pieces = [];
  const sentences = paragraph.split(/(?<=[。！？；])/);
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length <= maxChars) {
      current += sentence;
    } else {
      if (current) pieces.push(current);
      if (sentence.length > maxChars) {
        for (let i = 0; i < sentence.length; i += maxChars) {
          pieces.push(sentence.slice(i, i + maxChars));
        }
        current = '';
      } else {
        current = sentence;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function chunkSection(text, maxChars, minChars) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  const flush = () => {
    const value = current.trim();
    if (value.length >= minChars) chunks.push(value);
    current = '';
  };
  for (const paragraph of paragraphs) {
    for (const piece of splitLongParagraph(paragraph, maxChars)) {
      if (!current) {
        current = piece;
      } else if ((current + '\n\n' + piece).length <= maxChars) {
        current += '\n\n' + piece;
      } else {
        flush();
        current = piece;
      }
    }
  }
  flush();
  return chunks;
}

function sectionType(headings) {
  const joined = headings.join(' ');
  if (/知识主干/.test(joined)) return '知识主干';
  if (/专业词汇/.test(joined)) return '专业词汇';
  if (/任务实训|实训/.test(joined)) return '任务实训';
  if (/课程标准/.test(joined)) return '课程标准';
  return '导读';
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('缺少 knowledge/source 目录');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.toLowerCase().endsWith('.md')).sort();
  const chunks = [];
  let fileNo = 0;

  for (const file of files) {
    fileNo += 1;
    const raw = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
    const lines = raw.split(/\r?\n/);
    let stack = [];
    let buffer = [];
    let sectionNo = 0;

    const flush = () => {
      const headings = stack.map((item) => item.text);
      const body = cleanText(buffer.join('\n'));
      buffer = [];
      if (!body) return;
      if (headings.length === 0) return;
      if (BLOCK_HEADING.test(headings.join(' '))) return;
      const parts = chunkSection(body, MAX_CHARS, MIN_CHARS);
      if (!parts.length) return;
      sectionNo += 1;
      const project = headings[0] || file.replace(/\.md$/, '');
      const taskHeading = headings.find((h) => /任务\s*[一二三四五六七八九十0-9]|项目\s*[一二三四五六七八九十0-9]/.test(h)) || project;
      parts.forEach((part, index) => {
        chunks.push({
          id: `f${fileNo}-s${sectionNo}-c${index + 1}`,
          title: headings[headings.length - 1] || project,
          path: headings.join(' > '),
          source: file.replace(/\.md$/, ''),
          project,
          task: taskHeading,
          type: sectionType(headings),
          text: part
        });
      });
    };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        flush();
        const level = headingMatch[1].length;
        const text = cleanHeading(headingMatch[2]);
        stack = stack.filter((item) => item.level < level);
        stack.push({ level, text });
        continue;
      }
      buffer.push(line);
    }
    flush();
  }

  const payload = {
    manifest,
    builtAt: new Date().toISOString(),
    stats: {
      files: files.length,
      chunks: chunks.length,
      chars: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
    },
    chunks
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
  const size = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`已生成 ${path.relative(ROOT, OUT_PATH)}：${chunks.length} 块，${payload.stats.chars} 字，${size} MB`);
}

main();
