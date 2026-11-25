/* 酒店小二 · 浏览器端中文检索（BM25 + 字符二元组） */
(function () {
  'use strict';

  const K1 = 1.2;
  const B = 0.75;

  // 只用于查询侧降噪，不影响文档索引。
  const STOP_TOKENS = new Set([
    '怎么', '什么', '哪些', '哪个', '如何', '为何', '为什', '么样', '怎样',
    '可以', '能否', '是否', '有哪', '有什', '么区', '一个', '这个', '那个',
    '我们', '你们', '他们', '今天', '现在', '天天', '就是', '还是', '以及', '或者',
    '应该', '需要', '请问', '一下', '帮我', '告诉', '介绍', '给我', '写一', '一段',
    '店有', '店离', '店在', '店是', '店可', '店能', '店怎', '店做', '店和', '店与',
    '些房', '些酒', '些服', '些规'
  ]);

  function tokenize(text) {
    const normalized = String(text || '').toLowerCase().replace(/\s+/g, ' ');
    const parts = normalized.match(/[一-鿿]+|[a-z0-9]+/g) || [];
    const tokens = [];
    for (const part of parts) {
      if (/^[a-z0-9]+$/.test(part)) {
        tokens.push(part);
        continue;
      }
      if (part.length === 1) {
        tokens.push(part);
        continue;
      }
      for (let i = 0; i < part.length - 1; i += 1) {
        tokens.push(part.slice(i, i + 2));
      }
    }
    return tokens;
  }

  function addToken(map, token, weight) {
    map.set(token, (map.get(token) || 0) + weight);
  }

  function createIndex(chunks) {
    const docs = [];
    const df = new Map();
    let totalLength = 0;

    for (const chunk of chunks) {
      const tf = new Map();
      const titleTokens = tokenize(`${chunk.title} ${chunk.path}`);
      const bodyTokens = tokenize(chunk.text);
      for (const token of titleTokens) addToken(tf, token, 2);
      for (const token of bodyTokens) addToken(tf, token, 1);
      let length = 0;
      for (const count of tf.values()) length += count;
      totalLength += length;
      for (const token of tf.keys()) df.set(token, (df.get(token) || 0) + 1);
      docs.push({ chunk, tf, length });
    }

    return {
      docs,
      df,
      avgLength: docs.length ? totalLength / docs.length : 0,
      total: docs.length
    };
  }

  function idf(index, token) {
    const df = index.df.get(token) || 0;
    return Math.log(1 + (index.total - df + 0.5) / (df + 0.5));
  }

  function queryTokens(text) {
    return Array.from(new Set(tokenize(text))).filter((token) => !STOP_TOKENS.has(token));
  }

  function search(index, query, topK = 5) {
    const queryText = String(query || '').trim();
    if (!queryText) return [];
    const tokens = queryTokens(queryText);
    if (!tokens.length) return [];

    const results = [];
    for (const doc of index.docs) {
      let score = 0;
      let matched = 0;
      for (const token of tokens) {
        const frequency = doc.tf.get(token);
        if (!frequency) continue;
        matched += 1;
        const denominator = frequency + K1 * (1 - B + (B * doc.length) / (index.avgLength || 1));
        score += idf(index, token) * ((frequency * (K1 + 1)) / denominator);
      }
      if (!matched) continue;
      const coverage = matched / tokens.length;
      if (coverage < 0.2) continue;
      if (queryText.length >= 2 && doc.chunk.text.includes(queryText)) score += 4;
      // 题干/首句命中加权：问答型知识块通常把关键词放在第一行。
      // 用 idf 加权，避免“酒店”这类高频词把真正的关键词淹掉。
      const lead = doc.chunk.text.slice(0, 120).toLowerCase();
      let leadBoost = 0;
      for (const token of tokens) {
        if (lead.includes(token)) leadBoost += Math.min(idf(index, token), 5) * 0.25;
      }
      score += leadBoost;
      results.push({ ...doc.chunk, score, matched, coverage });
    }

    results.sort((a, b) => {
      const rankA = a.score * (0.6 + a.coverage * 0.8);
      const rankB = b.score * (0.6 + b.coverage * 0.8);
      return rankB - rankA;
    });
    const deduped = [];
    const seen = new Set();
    for (const item of results) {
      const key = `${item.path}::${item.text.slice(0, 80)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= topK) break;
    }
    return deduped;
  }

  function plainText(text) {
    return String(text || '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/^\s*\|?[\s:|-]{3,}\|[\s:|-]*$/gm, '')
      .replace(/^\s*\|(.+)\|\s*$/gm, (_, cells) => {
        return cells.split('|').map((cell) => cell.trim()).filter(Boolean).join(' / ');
      })
      .replace(/^\s*[-*]\s+/gm, '· ')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function excerpt(text, maxLength = 220) {
    const value = plainText(text).replace(/[ \t]+/g, ' ').trim();
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}…`;
  }

  window.HotelRAG = { tokenize, queryTokens, createIndex, search, excerpt, plainText };
})();
