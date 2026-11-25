/* 酒店小二 · 静态页面直连大模型（可选） */
(function () {
  'use strict';

  const STORAGE_KEY = 'hotel-xiaoer-config-v1';

  const PRESETS = {
    offline: {
      label: '离线检索（不用 Key）',
      protocol: 'none',
      baseUrl: '',
      model: ''
    },
    deepseek: {
      label: 'DeepSeek',
      protocol: 'openai',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat'
    },
    qwen: {
      label: '通义千问（兼容模式）',
      protocol: 'openai',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus'
    },
    ark: {
      label: '豆包 / 火山方舟',
      protocol: 'openai',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      model: '（填方舟推理接入点 ID）'
    },
    anthropic: {
      label: 'Claude（Anthropic）',
      protocol: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-opus-5-5'
    },
    custom: {
      label: '自定义 OpenAI 兼容接口',
      protocol: 'openai',
      baseUrl: '',
      model: ''
    }
  };

  function readStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (error) {
      return null;
    }
  }

  function loadConfig() {
    const injected = window.HOTEL_XIAOER_CONFIG || {};
    const stored = readStored() || {};
    const merged = { ...PRESETS.offline, ...injected, ...stored };
    if (!merged.provider || !PRESETS[merged.provider]) merged.provider = 'offline';
    return merged;
  }

  function saveConfig(config) {
    const safe = {
      provider: config.provider || 'offline',
      baseUrl: String(config.baseUrl || '').trim(),
      model: String(config.model || '').trim(),
      apiKey: String(config.apiKey || '').trim()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  }

  function isOnline(config) {
    return config.provider !== 'offline' && Boolean(config.apiKey && config.baseUrl && config.model);
  }

  function endpointFor(config) {
    const base = String(config.baseUrl || '').replace(/\/+$/, '');
    if (config.protocol === 'anthropic') {
      if (/\/v1\/messages$/.test(base)) return base;
      if (/\/v1$/.test(base)) return `${base}/messages`;
      return `${base}/v1/messages`;
    }
    if (/\/chat\/completions$/.test(base)) return base;
    return `${base}/chat/completions`;
  }

  async function postJSON(url, headers, body, timeoutMs = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (error) {
        data = null;
      }
      if (!response.ok) {
        const message = data?.error?.message || data?.message || raw.slice(0, 300) || `HTTP ${response.status}`;
        throw new Error(`接口返回 ${response.status}：${message}`);
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求超时，请检查网络或换一个接口地址。');
      if (error instanceof TypeError) {
        throw new Error('浏览器直连被拦截（通常是 CORS）。可换支持浏览器直连的服务，或临时加一个 Worker 代理。');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function chat({ system, messages, config }) {
    if (!isOnline(config)) throw new Error('当前是离线检索模式，请先在「配置」里填入接口和 Key。');
    const protocol = config.protocol === 'anthropic' ? 'anthropic' : 'openai';
    const url = endpointFor({ ...config, protocol });

    if (protocol === 'anthropic') {
      const body = {
        model: config.model,
        max_tokens: 1024,
        system,
        messages: messages.map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }))
      };
      const data = await postJSON(
        url,
        {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body
      );
      const text = (data?.content || [])
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n')
        .trim();
      if (!text) throw new Error('接口没有返回文本内容。');
      return text;
    }

    const body = {
      model: config.model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.3,
      max_tokens: 1024
    };
    const data = await postJSON(
      url,
      {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`
      },
      body
    );
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('接口没有返回文本内容。');
    return String(text).trim();
  }

  async function testConnection(config) {
    return chat({
      system: '你是连接测试助手。只回复四个字：连接成功。',
      messages: [{ role: 'user', content: '请回复：连接成功' }],
      config
    });
  }

  window.HotelLLM = { PRESETS, loadConfig, saveConfig, isOnline, chat, testConnection };
})();
