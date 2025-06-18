import fetch from 'node-fetch';

// Coze API 配置
const COZE_API_URL = process.env.COZE_API_URL || 'https://api.coze.com/open_api/v2/chat';
const COZE_API_KEY = process.env.COZE_API_KEY || 'pat_xdxRBDKN85QE746XMRQ0hGgKJsVQSrH8VCIvUzlRkW62OTBqZ88ti1eIkTvHbU18';
const COZE_BOT_ID = process.env.COZE_BOT_ID || '7513529977745915905';
const COZE_USER_ID = process.env.COZE_USER_ID || '7505301221562023954';

// 检查API配置
if (!COZE_API_KEY) {
  console.warn('警告: COZE_API_KEY未设置，将使用默认值');
}

/**
 * 使用Coze API进行翻译
 * @param {string} text 要翻译的文本
 * @param {string} from 源语言代码
 * @param {string} to 目标语言代码
 * @returns {Promise<string>} 翻译后的文本
 */
export async function translateWithCoze(text, from = 'zh-CN', to = 'en') {
  try {
    if (!text || !text.trim()) {
      console.log('翻译文本为空');
      return '';
    }

    console.log(`开始翻译文本 (${from} => ${to})`, text.length > 50 ? text.substring(0, 50) + '...' : text);

    // 构建翻译提示，使用更明确的指令
    const prompt = `请将以下${from === 'zh-CN' ? '中文' : '英文'}文本翻译成${to === 'en' ? '英文' : '中文'}，保持学术性和准确性，只返回翻译结果，不要添加任何其他内容：\n\n${text}`;

    // 发送请求到Coze API
    const response = await fetch(COZE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user: COZE_USER_ID,
        query: prompt,
        stream: false,
        conversation_id: Date.now().toString()
      })
    });

    if (!response.ok) {
      throw new Error(`Coze API responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Coze API响应:', typeof result === 'object' ? JSON.stringify(result).substring(0, 100) + '...' : result);
    
    // 检查API错误响应
    if (result.code && result.code !== 0) {
      if (result.code === 700012006) {
        throw new Error('Coze API认证失败，请检查API密钥是否正确设置');
      } else {
        throw new Error(`Coze API错误: ${result.msg || '未知错误'} (code: ${result.code})`);
      }
    }
    
    // 提取翻译结果
    let translatedText = '';
    
    // v2 API 响应格式
    if (result.messages && Array.isArray(result.messages)) {
      // 筛选出type为"answer"的assistant消息
      const assistantMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (assistantMessages.length > 0) {
        translatedText = assistantMessages[assistantMessages.length - 1].content;
      }
    }
    // v3 API 响应格式
    else if (result.data && result.data.messages) {
      const assistantMessages = result.data.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (assistantMessages.length > 0) {
        translatedText = assistantMessages[assistantMessages.length - 1].content;
      }
    }
    // 直接响应格式
    else if (result.answer) {
      translatedText = result.answer;
    } else if (typeof result === 'string') {
      translatedText = result;
    }

    // 如果没有获取到有效的翻译结果
    if (!translatedText) {
      console.warn('未从Coze API响应中获取到翻译结果:', result);
      throw new Error('未能从Coze API响应中提取翻译结果');
    }

    // 尝试解析JSON格式的响应
    try {
      const jsonMatch = translatedText.match(/```json\s*([\s\S]*?)\s*```/i) || translatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];
        jsonStr = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/:\s*,/g, ': null,')
          .replace(/"\s*:\s*,/g, '": null,')
          .replace(/,\s*,/g, ',')
          .replace(/}\s*}+$/g, '}')
          .replace(/^{+/g, '{')
          .trim();
        
        const jsonData = JSON.parse(jsonStr);
        if (jsonData && typeof jsonData === 'object') {
          translatedText = jsonData.output || jsonData.translation || jsonData.result || translatedText;
        }
      }
    } catch (error) {
      console.log('JSON解析失败，使用原始结果:', error.message);
    }

    // 更全面的清理翻译结果
    translatedText = translatedText
      // 移除Markdown标记
      .replace(/^#\s+/gm, '')  // 移除标题标记
      .replace(/\*\*/g, '')    // 移除粗体标记
      .replace(/\*/g, '')      // 移除斜体标记
      .replace(/`/g, '')       // 移除代码标记
      // 移除翻译相关的前缀
      .replace(/^(Translation|翻译结果|翻译|译文|中文翻译|英文翻译)[:：]?\s*/i, '')
      .replace(/^以下是翻译[：:]?\s*/i, '')
      .replace(/^["']|["']$/g, '')
      .replace(/^translated text[:：]?\s*/i, '')
      .replace(/^english translation[:：]?\s*/i, '')
      .trim();

    if (!translatedText || translatedText.length < 5) {
      throw new Error('翻译结果为空或过短');
    }

    console.log('翻译成功:', {
      original: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      translated: translatedText.substring(0, 30) + (translatedText.length > 30 ? '...' : '')
    });

    return translatedText;

  } catch (error) {
    console.error('Coze translation error:', error);
    throw error;
  }
}

/**
 * 使用sendSilentMessageToCoze进行翻译
 * @param {Function} sendSilentMessageToCoze Coze消息发送函数
 * @param {string} text 要翻译的文本
 * @param {string} from 源语言代码
 * @param {string} to 目标语言代码
 * @returns {Promise<string>} 翻译后的文本
 */
export async function translateWithSilentCoze(text, from = 'zh-CN', to = 'en') {
  try {
    if (!text || !text.trim()) {
      console.log('翻译文本为空');
      return '';
    }

    console.log(`开始静默翻译文本 (${from} => ${to})`, text.length > 50 ? text.substring(0, 50) + '...' : text);

    // 构建翻译提示，使用更明确的指令
    const prompt = `请将以下${from === 'zh-CN' ? '中文' : '英文'}文本翻译成${to === 'en' ? '英文' : '中文'}，保持学术性和准确性，只返回翻译结果，不要添加任何其他内容：\n\n${text}`;

    // 检查是否提供了sendSilentMessageToCoze函数
    if (typeof sendSilentMessageToCoze !== 'function') {
      throw new Error('sendSilentMessageToCoze不是一个函数');
    }

    // 发送请求
    const translatedResult = await sendSilentMessageToCoze(prompt);
    console.log('翻译结果:', translatedResult.length > 100 ? translatedResult.substring(0, 100) + '...' : translatedResult);
    
    // 尝试提取翻译后的内容
    let translatedText = translatedResult;
    
    // 如果是JSON格式，尝试提取output字段
    try {
      const jsonMatch = translatedResult.match(/```json\s*([\s\S]*?)\s*```/i) || translatedResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[1] || jsonMatch[0];
        jsonStr = jsonStr
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/:\s*,/g, ': null,')
          .replace(/"\s*:\s*,/g, '": null,')
          .replace(/,\s*,/g, ',')
          .replace(/}\s*}+$/g, '}')
          .replace(/^{+/g, '{')
          .trim();
        
        const jsonData = JSON.parse(jsonStr);
        if (jsonData && typeof jsonData === 'object') {
          translatedText = jsonData.output || jsonData.translation || jsonData.result || translatedResult;
        }
      }
    } catch (error) {
      console.log('JSON解析失败，使用原始结果:', error.message);
    }
    
    // 更全面的清理翻译结果
    translatedText = translatedText
      // 移除Markdown标记
      .replace(/^#\s+/gm, '')  // 移除标题标记
      .replace(/\*\*/g, '')    // 移除粗体标记
      .replace(/\*/g, '')      // 移除斜体标记
      .replace(/`/g, '')       // 移除代码标记
      // 移除翻译相关的前缀
      .replace(/^(Translation|翻译结果|翻译|译文|中文翻译|英文翻译)[:：]?\s*/i, '')
      .replace(/^以下是翻译[：:]?\s*/i, '')
      .replace(/^["']|["']$/g, '')
      .replace(/^translated text[:：]?\s*/i, '')
      .replace(/^english translation[:：]?\s*/i, '')
      .trim();

    if (!translatedText || translatedText.length < 5) {
      throw new Error('翻译结果为空或过短');
    }

    console.log('翻译成功:', {
      original: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      translated: translatedText.substring(0, 30) + (translatedText.length > 30 ? '...' : '')
    });

    return translatedText;

  } catch (error) {
    console.error('Silent Coze translation error:', error);
    throw error;
  }
}

export default {
  translateWithCoze,
  translateWithSilentCoze
};