import fetch from 'node-fetch';

/**
 * 有道翻译API服务
 * 文档: https://ai.youdao.com/DOCSIRMA/html/trans/api/wbfy/index.html
 */
export const translateWithYoudao = async (text, from = 'zh-CHS', to = 'en', appKey, appSecret) => {
  try {
    // 检查必要参数
    if (!text) return '';
    if (!appKey || !appSecret) {
      throw new Error('缺少有道翻译API密钥');
    }

    const salt = new Date().getTime();
    const curtime = Math.round(new Date().getTime() / 1000);
    
    // 根据有道API文档计算签名
    const crypto = await import('crypto');
    const sign = crypto.default.createHash('sha256').update(appKey + truncate(text) + salt + curtime + appSecret).digest('hex');
    
    const url = 'https://openapi.youdao.com/api';
    const params = new URLSearchParams({
      q: text,
      appKey: appKey,
      salt: salt,
      from: from,
      to: to,
      sign: sign,
      signType: 'v3',
      curtime: curtime
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      throw new Error(`有道翻译API响应错误: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errorCode !== '0') {
      throw new Error(`有道翻译API错误: ${result.errorCode}`);
    }

    return result.translation[0];
  } catch (error) {
    console.error('有道翻译出错:', error);
    throw error;
  }
};

/**
 * LibreTranslate API - 开源免费翻译API
 * 可以自行部署或使用公共实例
 */
export const translateWithLibre = async (text, source = 'zh', target = 'en', apiUrl = 'https://libretranslate.de/translate') => {
  try {
    if (!text) return '';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: text,
        source: source,
        target: target,
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate API响应错误: ${response.status}`);
    }

    const result = await response.json();
    return result.translatedText;
  } catch (error) {
    console.error('LibreTranslate翻译出错:', error);
    throw error;
  }
};

/**
 * Lingva Translate API - 另一个免费翻译API
 * 基于Google翻译但不需要API密钥
 */
export const translateWithLingva = async (text, from = 'zh', to = 'en', apiUrl = 'https://lingva.ml/api/v1') => {
  try {
    if (!text) return '';
    
    const url = `${apiUrl}/${from}/${to}/${encodeURIComponent(text)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Lingva API响应错误: ${response.status}`);
    }

    const result = await response.json();
    return result.translation;
  } catch (error) {
    console.error('Lingva翻译出错:', error);
    throw error;
  }
};

/**
 * 使用非官方Google翻译API
 * 不需要API密钥，但可能有请求限制
 */
export const translateWithGoogleUnofficial = async (text, from = 'zh-CN', to = 'en') => {
  try {
    if (!text) return '';
    
    // 清理和预处理文本
    const cleanedText = text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 构建翻译API URL
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.append('client', 'gtx');
    url.searchParams.append('sl', from);
    url.searchParams.append('tl', to);
    url.searchParams.append('dt', 't');
    url.searchParams.append('q', cleanedText);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Google翻译API响应错误: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data[0])) {
      throw new Error('无效的翻译响应格式');
    }

    // 合并所有翻译片段
    const translatedText = data[0]
      .filter(item => item && item[0])
      .map(item => item[0].trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return translatedText;
  } catch (error) {
    console.error('Google非官方翻译出错:', error);
    throw error;
  }
};

// 辅助函数：截取文本用于签名
function truncate(q) {
  const len = q.length;
  return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
}

// 默认导出一个通用翻译函数，可以根据配置选择不同的翻译服务
export default async function translate(text, options = {}) {
  const {
    from = 'zh-CHS',
    to = 'en',
    service = 'google', // 'youdao', 'libre', 'lingva', 'google'
    youdaoAppKey,
    youdaoAppSecret,
    libreApiUrl,
    lingvaApiUrl,
    retries = 2
  } = options;

  let lastError;
  
  for (let i = 0; i <= retries; i++) {
    try {
      switch (service) {
        case 'youdao':
          return await translateWithYoudao(text, from, to, youdaoAppKey, youdaoAppSecret);
        case 'libre':
          return await translateWithLibre(text, from, to, libreApiUrl);
        case 'lingva':
          return await translateWithLingva(text, from, to, lingvaApiUrl);
        case 'google':
        default:
          return await translateWithGoogleUnofficial(text, from, to);
      }
    } catch (error) {
      lastError = error;
      console.log(`翻译重试 (${i+1}/${retries+1})...`);
      // 等待一段时间后重试
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  // 所有重试都失败了
  throw lastError || new Error('翻译失败');
}