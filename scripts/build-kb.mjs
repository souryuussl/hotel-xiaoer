#!/usr/bin/env node
/**
 * 把知识库切成适合检索的知识块，输出 assets/kb.json。
 *
 * 分区：
 * - assistant：knowledge/source/（知识助手：课程、微信生态、AI 合规）
 * - service：knowledge/service/（酒店客服体验：客服问答、回答模板）
 *
 * 排除思考练习、参考答案、评分要点、附录、目录、思维导图等。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = path.join(ROOT, 'assets', 'kb.json');

const PARTITIONS = [
  {
    key: 'assistant',
    label: '知识助手',
    dir: path.join(ROOT, 'knowledge', 'source'),
    manifestPath: path.join(ROOT, 'knowledge', 'manifest.json')
  },
  {
    key: 'service',
    label: '酒店客服体验',
    dir: path.join(ROOT, 'knowledge', 'service'),
    manifestPath: path.join(ROOT, 'knowledge', 'service', 'manifest.json')
  }
];

const MAX_CHARS = 620;
const MIN_CHARS = 80;

const BLOCK_HEADING = /(参考答案|评分要点|附录|思考练习|单项选择题|判断题|简答题|案例分析题|知识总览|思维导图|封面字段|课程基本信息|学分及参考学时|教学实施与保障|授课进程|字段来源|学时校验|教学计划任务名|体例与阅读顺序|总目录|目录|情境示例与数据声明)/;

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
  if (/标准回答|话术|转人工|禁答/.test(joined)) return '客服话术';
  if (/知识主干/.test(joined)) return '知识主干';
  if (/专业词汇/.test(joined)) return '专业词汇';
  if (/任务实训|实训/.test(joined)) return '任务实训';
  if (/课程标准/.test(joined)) return '课程标准';
  return '导读';
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function stripFrontMatter(raw) {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function main() {
  const chunks = [];
  const manifests = {};
  const stats = {};

  for (const partition of PARTITIONS) {
    if (!fs.existsSync(partition.dir)) {
      console.warn(`跳过不存在的分区：${path.relative(ROOT, partition.dir)}`);
      continue;
    }
    if (!fs.existsSync(partition.manifestPath)) {
      console.error(`缺少分区清单：${path.relative(ROOT, partition.manifestPath)}`);
      process.exit(1);
    }
    manifests[partition.key] = JSON.parse(fs.readFileSync(partition.manifestPath, 'utf8'));

    const files = walk(partition.dir)
      .filter((filePath) => filePath.toLowerCase().endsWith('.md'))
      .filter((filePath) => {
        const base = path.basename(filePath);
        return !/^README\.md$/i.test(base) && !base.startsWith('_');
      })
      .sort();

    let partitionChunks = 0;
    let partitionChars = 0;
    let fileNo = 0;

    for (const filePath of files) {
      fileNo += 1;
      const relative = path.relative(partition.dir, filePath);
      const raw = stripFrontMatter(fs.readFileSync(filePath, 'utf8'));
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
        const project = headings[0] || relative.replace(/\.md$/, '');
        const taskHeading = headings.find((h) => /任务\s*[一二三四五六七八九十0-9]|项目\s*[一二三四五六七八九十0-9]/.test(h)) || project;
        parts.forEach((part, index) => {
          chunks.push({
            id: `${partition.key}-f${fileNo}-s${sectionNo}-c${index + 1}`,
            partition: partition.key,
            partitionLabel: partition.label,
            title: headings[headings.length - 1] || project,
            path: headings.join(' > '),
            source: relative.replace(/\.md$/, ''),
            project,
            task: taskHeading,
            type: sectionType(headings),
            text: part
          });
          partitionChunks += 1;
          partitionChars += part.length;
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

    stats[partition.key] = {
      label: partition.label,
      files: files.length,
      chunks: partitionChunks,
      chars: partitionChars
    };
    console.log(`${partition.label}：${files.length} 份资料，${partitionChunks} 块，${partitionChars} 字`);
  }

  const total = {
    files: Object.values(stats).reduce((sum, item) => sum + item.files, 0),
    chunks: Object.values(stats).reduce((sum, item) => sum + item.chunks, 0),
    chars: Object.values(stats).reduce((sum, item) => sum + item.chars, 0)
  };

  const payload = {
    manifests,
    builtAt: new Date().toISOString(),
    stats: { ...stats, total },
    chunks
  };
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
  const size = (fs.statSync(OUT_PATH).size / 1024 / 1024).toFixed(2);
  console.log(`已生成 ${path.relative(ROOT, OUT_PATH)}：合计 ${total.chunks} 块，${total.chars} 字，${size} MB`);
}

main();
