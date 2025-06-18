import express from 'express';
import cors from 'cors';
import https from 'https';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载.env文件 - 修复：从当前目录加载
dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// CORS配置 - 支持生产环境
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://method-mate.vercel.app', 'https://methodmate.vercel.app'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// API配置
const SEMANTIC_API_BASE = 'https://api.semanticscholar.org/graph/v1';
const CORE_API_BASE = 'https://api.core.ac.uk/v3';
const CORE_API_KEY = process.env.CORE_API_KEY;
const SEMANTIC_API_KEY = process.env.SEMANTIC_API_KEY || '';

// Coze API配置 - 从cozeApi.js获取
const COZE_API_KEY = process.env.COZE_API_KEY || 'pat_xdxRBDKN85QE746XMRQ0hGgKJsVQSrH8VCIvUzlRkW62OTBqZ88ti1eIkTvHbU18';
const COZE_API_URL = process.env.COZE_API_URL || 'https://api.coze.com';
const COZE_BOT_ID = process.env.COZE_BOT_ID || '7513529977745915905';
const COZE_BOT_ID_Reference = process.env.COZE_BOT_ID_Reference || '7511024998740754448';  
const COZE_USER_ID = process.env.COZE_USER_ID || '7505301221562023954';
  
// 设置环境变量，确保其他模块可以访问
process.env.COZE_API_KEY = COZE_API_KEY;
process.env.COZE_API_URL = COZE_API_URL;
process.env.COZE_BOT_ID = COZE_BOT_ID;
process.env.COZE_USER_ID = COZE_USER_ID;

// 导入翻译服务
import translate, { translateWithGoogleUnofficial } from './translate-service.js';
import { translateWithCoze, translateWithSilentCoze } from './coze-translate-service.js';

// 翻译函数 - 使用Coze API进行中文到英文的翻译
const translateToEnglish = async (text, retries = 3) => {
  try {
    // 检测是否包含中文字符
    if (!/[\u4e00-\u9fa5]/.test(text)) {
      console.log('文本不包含中文，无需翻译:', text);
      return text;
    }

    // 清理和预处理文本
    const cleanedText = text
      .replace(/[\r\n]+/g, ' ') // 将换行替换为空格
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();

    console.log('准备翻译文本:', cleanedText);

    try {
      console.log('使用Coze API翻译...');
      const translatedText = await translateWithCoze(cleanedText, 'zh-CN', 'en');
      
      if (!translatedText || translatedText.length < 5) {
        throw new Error('Coze返回的翻译结果为空或过短');
      }
      
      // 清理翻译结果，移除可能的提示词或额外说明
      const cleanedTranslation = translatedText
        .replace(/^translation[：:]?\s*/i, '')
        .replace(/^translated text[：:]?\s*/i, '')
        .replace(/^english translation[：:]?\s*/i, '')
        .trim();
      
      console.log('翻译成功:', {
        original: cleanedText.substring(0, 50) + (cleanedText.length > 50 ? '...' : ''),
        translated: cleanedTranslation.substring(0, 50) + (cleanedTranslation.length > 50 ? '...' : '')
      });
      
      return cleanedTranslation;
    } catch (error) {
      if (retries > 0) {
        console.log(`翻译失败，${error.message}，剩余重试次数: ${retries - 1}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return translateToEnglish(text, retries - 1);
      }
      console.warn('翻译失败，使用原文:', text);
      return text;
    }
  } catch (error) {
    console.error('翻译过程中发生未处理的错误:', error);
    return text;
  }
};

// 论文研究方法提取函数 - 改进版，处理长文本
const extractResearchMethod = async (fullText, retries = 3) => {
  try {
    if (!fullText || typeof fullText !== 'string') {
      console.log('无效的论文全文');
      return null;
    }

    // 计算文本长度，用于判断是否需要分段处理
    const textLength = fullText.length;
    console.log(`论文全文长度: ${textLength} 字符`);

    // 定义最大段落长度（约8000个字符，大约是GPT模型处理能力的1/3）
    const MAX_CHUNK_LENGTH = 8000;
    
    // 如果文本较短，直接处理
    if (textLength <= MAX_CHUNK_LENGTH) {
      console.log('论文长度适中，直接处理全文');
      return await processFullText(fullText, retries);
    }
    
    // 如果文本较长，先尝试定位方法部分
    console.log('论文较长，尝试定位研究方法部分');
    
    // 1. 首先尝试定位可能包含研究方法的部分
    const methodSection = locateMethodSection(fullText);
    
    if (methodSection) {
      console.log('找到可能的方法部分，长度:', methodSection.length);
      // 如果找到的方法部分仍然太长，进行分段处理
      if (methodSection.length > MAX_CHUNK_LENGTH) {
        console.log('找到的方法部分仍然较长，进行分段处理');
        return await processTextInChunks(methodSection, retries);
      } else {
        // 如果方法部分长度适中，直接处理
        console.log('找到的方法部分长度适中，直接处理');
        return await processFullText(methodSection, retries);
      }
    }
    
    // 2. 如果没有找到明确的方法部分，将全文分段处理
    console.log('未找到明确的方法部分，对全文进行分段处理');
    return await processTextInChunks(fullText, retries);
    
  } catch (error) {
    console.error('提取研究方法过程中发生未处理的错误:', error);
    return null;
  }
};

// 处理完整文本块
const processFullText = async (text, retries = 3) => {
  try {
    const prompt = `You are a research methodology expert. Your task is to identify and extract the methodology section from this academic paper.

Look for sections that describe:
1. Research design or methodology
2. Data collection methods
3. Analysis procedures
4. Experimental setup

Simply locate and extract these sections from the text. If you find them, return the relevant text passages. If you don't find explicit methodology sections, return null.

Paper text:
${text}

Remember: Just extract and return the relevant text. No need to analyze, summarize, or modify it.`;

    console.log('使用Coze API提取研究方法...');
    const response = await fetch(`${COZE_API_URL}/open_api/v2/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user: COZE_USER_ID,
        query: prompt,
        stream: false,
        conversation_id: `extract_method_${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`Coze API responded with status: ${response.status}`);
    }

    const result = await response.json();
    let methodText = '';
    
    if (result.messages && Array.isArray(result.messages)) {
      const answerMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (answerMessages.length > 0) {
        methodText = answerMessages[0].content;
      }
    } else if (result.answer) {
      methodText = result.answer;
    }

    if (methodText.toLowerCase().includes("i'm sorry") || 
        methodText.toLowerCase().includes("cannot assist") ||
        methodText.toLowerCase().includes("can't assist")) {
      console.log('Coze拒绝响应，尝试使用备用方法');
      return await generateMethodSummary(text);
    }

    if (!methodText) {
      throw new Error('未能从Coze响应中提取研究方法');
    }

    methodText = methodText
      .replace(/^(Here is the research methodology section:|I've extracted the research methodology section:|The research methodology section is as follows:)/i, '')
      .trim();

    return methodText;
  } catch (error) {
    if (retries > 0) {
      console.log(`处理文本块失败，${error.message}，剩余重试次数: ${retries - 1}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return processFullText(text, retries - 1);
    }
    console.warn('处理文本块失败，尝试使用备用方法');
    return await generateMethodSummary(text);
  }
};

// 分段处理长文本
const processTextInChunks = async (text, retries = 3) => {
  try {
    // 将文本分成较小的块
    const MAX_CHUNK_LENGTH = 8000;
    const chunks = [];
    let currentChunk = '';
    
    // 按段落分割文本
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length + 2 <= MAX_CHUNK_LENGTH) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    console.log(`将文本分成 ${chunks.length} 个块进行处理`);
    
    // 处理每个块并收集结果
    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`处理第 ${i + 1}/${chunks.length} 个文本块`);
      const result = await processFullText(chunks[i], retries);
      if (result) {
        results.push(result);
      }
      
      // 在处理块之间添加延迟，避免API限制
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 如果没有找到任何方法相关内容，返回null
    if (results.length === 0) {
      console.log('未从任何文本块中找到研究方法');
      return null;
    }
    
    // 合并所有结果
    const combinedResult = results.join('\n\n');
    console.log(`成功从 ${results.length} 个文本块中提取研究方法`);
    
    // 如果合并后的结果过长，可能需要进行总结
    if (combinedResult.length > MAX_CHUNK_LENGTH) {
      console.log('合并结果过长，尝试生成摘要');
      return await generateMethodSummary(combinedResult);
    }
    
    return combinedResult;
  } catch (error) {
    console.error('分段处理文本时出错:', error);
    return null;
  }
};

// 定位可能包含研究方法的部分
const locateMethodSection = (fullText) => {
  try {
    // 转换为小写以进行不区分大小写的搜索
    const lowerText = fullText.toLowerCase();
    
    // 定义可能表示方法部分的标题关键词
    const methodTitles = [
      'method', 'methodology', 'research design', 'experimental design',
      'research methodology', 'data collection', 'procedure', 'experimental setup',
      'research approach', 'study design', 'research procedure', 'materials and methods',
      '方法', '研究方法', '实验方法', '实验设计', '研究设计', '数据收集', '实验程序'
    ];
    
    // 查找可能的方法部分标题
    let bestMatch = null;
    let bestPosition = -1;
    
    for (const title of methodTitles) {
      // 查找可能的标题格式（如 "3. Method" 或 "Method" 或 "III. Method"）
      const patterns = [
        new RegExp(`\\b\\d+\\.?\\s+${title}\\b`, 'i'),  // 数字编号格式
        new RegExp(`\\b${title}\\b`, 'i'),              // 普通单词格式
        new RegExp(`\\b[ivxlcdm]+\\.?\\s+${title}\\b`, 'i'), // 罗马数字格式
      ];
      
      for (const pattern of patterns) {
        const match = lowerText.match(pattern);
        if (match && (bestPosition === -1 || match.index < bestPosition)) {
          bestMatch = match[0];
          bestPosition = match.index;
        }
      }
    }
    
    // 如果找到方法部分标题
    if (bestPosition !== -1) {
      console.log(`找到可能的方法部分标题: "${bestMatch}" 在位置 ${bestPosition}`);
      
      // 查找下一个可能的章节标题，作为方法部分的结束
      const nextSectionPattern = /\b(\d+\.\s+|\b[IVX]+\.\s+|Chapter\s+\d+\s*[:\.]\s*|\d+\s*[:\.]\s*)[A-Z]/;
      const nextSection = lowerText.substring(bestPosition + bestMatch.length).match(nextSectionPattern);
      
      let endPosition;
      if (nextSection) {
        endPosition = bestPosition + bestMatch.length + nextSection.index;
        console.log(`找到下一个章节标题，方法部分结束于位置 ${endPosition}`);
      } else {
        // 如果找不到下一个章节标题，取后续的一部分文本（最多10000字符）
        endPosition = Math.min(bestPosition + bestMatch.length + 10000, fullText.length);
        console.log(`未找到下一个章节标题，取后续 10000 字符作为方法部分`);
      }
      
      // 提取方法部分文本
      return fullText.substring(bestPosition, endPosition);
    }
    
    // 如果没有找到明确的方法部分标题，尝试查找包含方法关键词的段落
    console.log('未找到明确的方法部分标题，尝试查找包含方法关键词的段落');
    
    // 将文本分割成段落
    const paragraphs = fullText.split(/\n\s*\n/);
    
    // 定义方法相关的关键词
    const methodKeywords = [
      'participant', 'procedure', 'measure', 'analysis', 'collect data', 'sample',
      'experiment', 'survey', 'interview', 'questionnaire', 'observation',
      'statistical analysis', 'research design', 'study design', 'method',
      '参与者', '程序', '测量', '分析', '收集数据', '样本', '实验', '调查', '访谈',
      '问卷', '观察', '统计分析', '研究设计', '研究方法'
    ];
    
    // 查找包含多个方法关键词的段落
    const methodParagraphs = paragraphs.filter(para => {
      const lowerPara = para.toLowerCase();
      // 计算段落中包含的方法关键词数量
      const keywordCount = methodKeywords.filter(keyword => 
        lowerPara.includes(keyword.toLowerCase())
      ).length;
      
      // 如果包含至少3个关键词，认为是方法相关段落
      return keywordCount >= 3;
    });
    
    if (methodParagraphs.length > 0) {
      console.log(`找到 ${methodParagraphs.length} 个可能包含方法的段落`);
      // 合并这些段落
      return methodParagraphs.join('\n\n');
    }
    
    // 如果仍然找不到，返回null
    console.log('未能定位到明确的方法部分');
    return null;
    
  } catch (error) {
    console.error('定位方法部分时出错:', error);
    return null;
  }
};

// 备用的研究方法生成函数
const generateMethodSummary = async (fullText) => {
  try {
    if (!fullText || typeof fullText !== 'string') {
      return null;
    }

    const prompt = `As a research assistant, help me understand the methodology used in this paper. 
Please read the text and create a brief summary of the research methods used.
Focus on identifying:
- The type of research (e.g., experimental, survey, case study)
- Data collection methods
- Analysis approaches
- Key methodological steps

Text:
${fullText}

Please provide a concise summary of the methodology.`;

    console.log('使用备用方法生成研究方法概要...');
    const response = await fetch(`${COZE_API_URL}/open_api/v2/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user: COZE_USER_ID,
        query: prompt,
        stream: false,
        conversation_id: `generate_summary_${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`Coze API responded with status: ${response.status}`);
    }

    const result = await response.json();
    let summaryText = '';
    
    if (result.messages && Array.isArray(result.messages)) {
      const answerMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (answerMessages.length > 0) {
        summaryText = answerMessages[0].content;
      }
    } else if (result.answer) {
      summaryText = result.answer;
    }

    if (!summaryText || 
        summaryText.toLowerCase().includes("i'm sorry") || 
        summaryText.toLowerCase().includes("cannot assist") ||
        summaryText.toLowerCase().includes("can't assist")) {
      return null;
    }

    return summaryText.trim();
  } catch (error) {
    console.error('生成研究方法概要失败:', error);
    return null;
  }
};

// 从对话历史中提取关键词
const extractKeywords = (messages) => {
  // 优先从用户最后一条消息中提取关键词
  const userMessages = messages.filter(msg => msg.type === 'user');
  if (userMessages.length > 0) {
    const lastUserMessage = userMessages[userMessages.length - 1].content;
    
    // 移除常见的无意义词和应用名称
    const cleanedMessage = lastUserMessage
      .replace(/methodmate|ai|assistant|我想|请问|如何|什么是/gi, '')
      .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // 保留中文字符和英文单词
      .trim();

    if (cleanedMessage.length >= 5) {
      return cleanedMessage;
    }
  }
  
  // 如果最后一条消息提取失败，从所有消息中提取
  const recentMessages = messages.slice(-4); // 只取最近4条消息
  const combinedContent = recentMessages
    .map(msg => msg.content)
    .join(' ')
    .replace(/methodmate|ai|assistant|我想|请问|如何|什么是/gi, '')
    .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ');
  
  // 提取更有意义的关键词
  const keywords = combinedContent
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !/^(the|and|or|in|on|at|to|from|with|by|for|about|that|this|these|those|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could)$/i.test(word)
    )
    .slice(0, 15); // 取前15个关键词
  
  return keywords.join(' ');
};

// 简单的重试函数
const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= 1) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1, delay * 2);
  }
};

if (!CORE_API_KEY) {
  console.warn('CORE_API_KEY not found in environment variables');
  console.log('Available environment variables:', Object.keys(process.env).filter(key => !key.includes('SECRET')));
} else {
  console.log('CORE_API_KEY found:', CORE_API_KEY.substring(0, 4) + '...');
}

// 中间件
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// 添加根路由重定向到测试页面
app.get('/', (req, res) => {
  res.redirect('/test-core-api.html');
});

// 从CORE API获取论文全文，添加重试机制和请求间隔
const getFullTextFromCore = async (title, doi = null, retries = 3, delay = 1000) => {
  try {
    console.log(`正在从CORE API获取论文全文，标题: "${title}"${doi ? `，DOI: "${doi}"` : ''}，剩余重试次数: ${retries}`);
    
    // 添加请求间隔，避免API限流
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // 首先使用标题搜索论文
    const titleResult = await searchCoreByTitle(title);
    if (titleResult) {
      console.log('通过标题找到论文全文');
      return titleResult;
    }
    
    // 如果标题搜索失败且有DOI，尝试使用DOI搜索
    if (doi) {
      console.log(`标题搜索未找到结果，尝试使用DOI搜索: "${doi}"`);
      const doiResult = await searchCoreByDOI(doi);
      if (doiResult) {
        console.log('通过DOI找到论文全文');
        return doiResult;
      }
    }
    
    console.log('未找到相关论文信息');
    return null;
  } catch (error) {
    console.error('从CORE获取全文时出错:', error);
    
    // 如果是超时或网络错误，并且还有重试次数，则重试
    if ((error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') && retries > 0) {
      console.log(`CORE API请求超时或网络错误，${delay/1000}秒后重试，剩余重试次数: ${retries - 1}`);
      return getFullTextFromCore(title, doi, retries - 1, delay * 2); // 指数退避策略
    }
    
    console.error('错误堆栈:', error.stack);
    return null;
  }
};

// 使用标题搜索CORE API的辅助函数
const searchCoreByTitle = async (title) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  try {
    const searchResponse = await fetch(`${CORE_API_BASE}/search/works`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CORE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: title,
        limit: 1,
        fields: ['title', 'fullText', 'abstract']
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`CORE API标题搜索错误响应 (${searchResponse.status}):`, errorText);
      return null;
    }

    const result = await searchResponse.json();
    console.log('CORE API标题搜索结果:', JSON.stringify(result, null, 2));
    
    if (result.results && result.results.length > 0) {
      const paper = result.results[0];
      if (paper.fullText) {
        return paper.fullText;
      } else if (paper.abstract) {
        console.log('标题搜索未找到全文，使用摘要代替');
        return paper.abstract;
      }
    }
    
    return null;
  } catch (fetchError) {
    clearTimeout(timeout);
    console.error('标题搜索出错:', fetchError);
    return null;
  }
};

// 使用DOI搜索CORE API的辅助函数
const searchCoreByDOI = async (doi) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  try {
    // 清理DOI格式，移除可能的前缀
    const cleanDOI = doi.replace(/^(doi:|DOI:)/i, '').trim();
    
    const searchResponse = await fetch(`${CORE_API_BASE}/search/works`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CORE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: `doi:"${cleanDOI}"`,
        limit: 1,
        fields: ['title', 'fullText', 'abstract', 'doi']
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`CORE API DOI搜索错误响应 (${searchResponse.status}):`, errorText);
      return null;
    }

    const result = await searchResponse.json();
    console.log('CORE API DOI搜索结果:', JSON.stringify(result, null, 2));
    
    if (result.results && result.results.length > 0) {
      const paper = result.results[0];
      if (paper.fullText) {
        return paper.fullText;
      } else if (paper.abstract) {
        console.log('DOI搜索未找到全文，使用摘要代替');
        return paper.abstract;
      }
    }
    
    return null;
  } catch (fetchError) {
    clearTimeout(timeout);
    console.error('DOI搜索出错:', fetchError);
    return null;
  }
};

// 解析语义学术API响应
const parseSemanticResponse = async (papers) => {
  // 定义允许的期刊/会议列表
  const allowedVenues = [
    // 顶会
    'Computer-Supported Cooperative Work', 'CSCW',
    'Human Factors in Computing Systems', 'CHI',
    'Pervasive and Ubiquitous Computing', 'UbiComp',
    'User Interface Software and Technology', 'UIST',
    
    // 顶刊
    'Computers in Human Behavior',
    'CoDesign',
    'Technovation',
    'Design Studies',
    'Journal of Mixed Methods Research',
    'ACM Transactions on Computer-Human Interaction', 'TOCHI',
    'International Journal of Human-Computer Studies',
    'Design Issues',
    'Human-Computer Interaction',
    'Computer-Aided Design',
    'Applied Ergonomics',
    'International Journal of Design',
    'Human Factors',
    'Leonardo',
    'The Design Journal'
  ];

  const parsedPapers = [];
  
  for (const paper of papers) {
    // 检查是否是顶会顶刊
    const venue = paper.venue || '';
    const venueLower = venue.toLowerCase();
    
    // 更精确的顶会顶刊判断逻辑
    const isTopVenue = allowedVenues.some(allowedVenue => {
      const allowedLower = allowedVenue.toLowerCase();
      
      // 完全匹配
      if (venueLower === allowedLower) return true;
      
      // 处理简写形式的精确匹配
      if (allowedLower === 'cscw' && (venueLower === 'cscw' || venueLower.includes('computer-supported cooperative work'))) return true;
      if (allowedLower === 'chi' && (venueLower === 'chi' || venueLower.includes('human factors in computing systems'))) return true;
      if (allowedLower === 'ubicomp' && (venueLower === 'ubicomp' || venueLower.includes('pervasive and ubiquitous computing'))) return true;
      if (allowedLower === 'uist' && (venueLower === 'uist' || venueLower.includes('user interface software and technology'))) return true;
      if (allowedLower === 'tochi' && (venueLower === 'tochi' || venueLower.includes('transactions on computer-human interaction'))) return true;
      
      // 对于其他期刊，使用更严格的匹配规则
      // 检查是否是完整的子字符串，而不是部分匹配
      const words = allowedLower.split(' ');
      if (words.length > 1) {
        // 对于多词名称，要求完整匹配或作为独立短语出现
        return venueLower === allowedLower || 
               venueLower.includes(` ${allowedLower} `) || 
               venueLower.startsWith(`${allowedLower} `) || 
               venueLower.endsWith(` ${allowedLower}`);
      }
      
      // 对于单词名称，要求是完整的单词匹配
      return venueLower === allowedLower || 
             venueLower.includes(` ${allowedLower} `) || 
             venueLower.startsWith(`${allowedLower} `) || 
             venueLower.endsWith(` ${allowedLower}`);
    });
    
    console.log(`Venue: "${venue}", isTopVenue: ${isTopVenue}`);
    
    // 生成唯一ID，用于后续异步获取全文和研究方法
    const paperId = `paper_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    parsedPapers.push({
      id: paperId,
      title: paper.title,
      abstract: paper.abstract || '暂无摘要',
      downloadUrl: (paper.openAccessPdf && paper.openAccessPdf.url) || paper.url || null,
      // 添加额外的语义学术特有信息
      year: paper.year,
      citationCount: paper.citationCount,
      authors: (paper.authors && paper.authors.map(author => author.name).join(', ')) || '未知作者',
      venue: venue,
      // 不再同步获取全文，初始化为null
      fullText: null,
      researchMethod: null,
      isLoadingFullText: false,
      // 添加是否是顶会顶刊的标记
      isTopVenue: isTopVenue
    });
    
    // 异步获取全文和研究方法，不阻塞主流程
    (async () => {
      try {
        const paperIndex = parsedPapers.length - 1;
        console.log(`开始异步获取论文全文: "${paper.title}"`);
        
        // 标记为正在加载
        parsedPapers[paperIndex].isLoadingFullText = true;
        
        // 异步获取全文，传递DOI信息
        const doi = paper.externalIds?.DOI || null;
        const fullText = await getFullTextFromCore(paper.title, doi, 3, 1000);
        
        if (fullText) {
          console.log(`成功获取论文全文，开始提取研究方法: "${paper.title}"`);
          parsedPapers[paperIndex].fullText = fullText;
          
          // 提取研究方法
          const researchMethod = await extractResearchMethod(fullText);
          if (researchMethod) {
            console.log(`成功提取研究方法: "${paper.title}"`);
            parsedPapers[paperIndex].researchMethod = researchMethod;
          }
        }
      } catch (error) {
        console.error(`异步获取论文全文或研究方法失败: "${paper.title}"`, error);
      } finally {
        // 无论成功失败，都标记为加载完成
        const paperIndex = parsedPapers.findIndex(p => p.title === paper.title);
        if (paperIndex !== -1) {
          parsedPapers[paperIndex].isLoadingFullText = false;
        }
      }
    })();
  }
  
  return parsedPapers;
};

// Scholar Search API路由
app.post('/api/scholar-search', async (req, res) => {
  console.log('Scholar Search API被调用');
  
  try {
    const { query, num_results = 10, lang = 'zh-CN', filter_venues = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false,
        error: 'Query parameter is required' 
      });
    }

    console.log(`执行学术搜索，查询: "${query}", 结果数: ${num_results}, 语言: ${lang}`);
    
    // 检测是否包含中文，如果包含则翻译
    let searchQuery = query;
    if (/[\u4e00-\u9fa5]/.test(query)) {
      try {
        console.log('检测到中文查询，进行翻译');
        searchQuery = await translateToEnglish(query);
        console.log(`查询已翻译: "${query}" => "${searchQuery}"`);
      } catch (error) {
        console.error('翻译查询失败:', error);
        // 翻译失败时继续使用原始查询
        searchQuery = query;
      }
    }
    
    // 定义允许的期刊/会议列表
    const allowedVenues = [
      // 顶会
      'Computer-Supported Cooperative Work', 'CSCW',
      'Human Factors in Computing Systems', 'CHI',
      'Pervasive and Ubiquitous Computing', 'UbiComp',
      'User Interface Software and Technology', 'UIST',
      
      // 顶刊
      'Computers in Human Behavior',
      'CoDesign',
      'Technovation',
      'Design Studies',
      'Journal of Mixed Methods Research',
      'ACM Transactions on Computer-Human Interaction', 'TOCHI',
      'International Journal of Human-Computer Studies',
      'Design Issues',
      'Human-Computer Interaction',
      'Computer-Aided Design',
      'Applied Ergonomics',
      'International Journal of Design',
      'Human Factors',
      'Leonardo',
      'The Design Journal'
    ];
    
    // 构建 Semantic Scholar API 请求
    // 根据最新的API文档调整字段，移除不支持的doi字段
    const fields = 'title,authors,abstract,year,citationCount,venue,url,openAccessPdf,externalIds';
    
    // 构建基本查询参数，使用翻译后的查询但不进行URL编码
    let searchUrl = `${SEMANTIC_API_BASE}/paper/search?query=${searchQuery}&limit=${num_results}&fields=${fields}`;
    
    // 如果需要过滤期刊/会议，使用venue参数
    if (filter_venues) {
      // 直接使用原始venue名称，用逗号连接
      const venueParam = allowedVenues.join(',');
      // 直接添加到URL中，不进行编码
      searchUrl += `&venue=${venueParam}`;
    }
    
    console.log('请求URL:', searchUrl);
    
    // 准备请求头
    const headers = {
      'Accept': 'application/json',
    };
    
    
    
    // 使用重试机制发送请求
    const response = await fetchWithRetry(searchUrl, {
      headers: headers
    }, 3, 1000); // 最多重试3次，初始延迟1秒

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Semantic Scholar API错误响应 (${response.status}):`, errorText);
      throw new Error(`Semantic Scholar API responded with status: ${response.status}`);
    }

    const searchData = await response.json();
    console.log('Semantic Scholar API响应:', JSON.stringify(searchData, null, 2));
    
    // 检查是否有搜索结果
    if (!searchData.data || searchData.data.length === 0) {
      console.log('没有找到匹配的论文');
      return res.json({
        success: true,
        query: query,
        results: [],
        total_results: 0
      });
    }
    
    // 转换结果
    const results = searchData.data.map(paper => {
      const venue = paper.venue || '';
      
      // 更精确的顶会顶刊判断逻辑
      const isTopVenue = allowedVenues.some(allowedVenue => {
        const allowedLower = allowedVenue.toLowerCase();
        const venueLower = venue.toLowerCase();
        
        // 完全匹配
        if (venueLower === allowedLower) return true;
        
        // 处理简写形式的精确匹配
        if (allowedLower === 'cscw' && (venueLower === 'cscw' || venueLower.includes('computer-supported cooperative work'))) return true;
        if (allowedLower === 'chi' && (venueLower === 'chi' || venueLower.includes('human factors in computing systems'))) return true;
        if (allowedLower === 'ubicomp' && (venueLower === 'ubicomp' || venueLower.includes('pervasive and ubiquitous computing'))) return true;
        if (allowedLower === 'uist' && (venueLower === 'uist' || venueLower.includes('user interface software and technology'))) return true;
        if (allowedLower === 'tochi' && (venueLower === 'tochi' || venueLower.includes('transactions on computer-human interaction'))) return true;
        
        // 对于其他期刊，使用更严格的匹配规则
        // 检查是否是完整的子字符串，而不是部分匹配
        // 例如，"design studies"应该匹配"design studies"，但不应该匹配"design studies in earth science"
        const words = allowedLower.split(' ');
        if (words.length > 1) {
          // 对于多词名称，要求完整匹配或作为独立短语出现
          return venueLower === allowedLower || 
                 venueLower.includes(` ${allowedLower} `) || 
                 venueLower.startsWith(`${allowedLower} `) || 
                 venueLower.endsWith(` ${allowedLower}`);
        }
        
        // 对于单词名称，要求是完整的单词匹配
        return venueLower === allowedLower || 
               venueLower.includes(` ${allowedLower} `) || 
               venueLower.startsWith(`${allowedLower} `) || 
               venueLower.endsWith(` ${allowedLower}`);
      });
      
      console.log(`Scholar Search - Venue: "${venue}", isTopVenue: ${isTopVenue}`);
      
      return {
        title: paper.title || '',
        authors: paper.authors?.map(author => author.name) || [],
        journal: venue,
        year: paper.year?.toString() || '',
        citations: paper.citationCount || 0,
        summary: paper.abstract || '',
        pdf_url: paper.openAccessPdf?.url || null,
        scholar_url: paper.url || '',
        doi: paper.externalIds?.DOI || '',
        relevance_score: 0.9, // Semantic Scholar API 目前不返回相关性分数
        isTopVenue: isTopVenue // 标记是否来自顶会顶刊
      };
    });

    res.json({
      success: true,
      query: query,
      results: results,
      total_results: results.length
    });
  } catch (error) {
    console.error('Scholar Search Error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// 解析Coze API响应，提取关键词
const parseKeywordsFromCozeResponse = (reply) => {
  try {
    console.log('开始解析关键词，原始回复:', reply);
    
    // 检查reply是否是对象或字符串
    if (typeof reply === 'object' && reply !== null) {
      // 如果reply是对象，尝试直接从中提取关键词
      if (reply.content && typeof reply.content === 'string') {
        // 如果是消息对象，使用content字段
        reply = reply.content;
      } else {
        // 转换为字符串以便后续处理
        reply = JSON.stringify(reply);
      }
    }
    
    // 尝试解析JSON格式
    const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/i) || reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      console.log('找到JSON格式:', jsonStr);
      try {
        const jsonData = JSON.parse(jsonStr);
        if (jsonData.keywords && Array.isArray(jsonData.keywords)) {
          // 使用逗号分隔关键词，保留短语结构
          const keywords = jsonData.keywords
            .filter(kw => kw && typeof kw === 'string' && kw.trim().length > 0)
            .join(','); // 使用逗号而不是空格
          console.log('从JSON中提取的关键词(逗号分隔):', keywords);
          return keywords;
        }
      } catch (jsonError) {
        console.error('JSON解析错误:', jsonError);
      }
    }
    
    // 如果没有找到JSON格式的关键词，尝试从文本中提取
    const keywordsMatch = reply.match(/关键词[:：]\s*([^\n]+)/i) || 
                          reply.match(/keywords[:：]\s*([^\n]+)/i) ||
                          reply.match(/key\s*words[:：]\s*([^\n]+)/i);
    if (keywordsMatch && keywordsMatch[1]) {
      const textKeywords = keywordsMatch[1].trim();
      console.log('从文本中提取的关键词:', textKeywords);
      return textKeywords;
    }
    
    // 尝试查找列表格式的关键词
    const listMatches = reply.match(/\d+\.\s*([^\n,]+)(?:,|\n|$)/g);
    if (listMatches && listMatches.length > 0) {
      const listKeywords = listMatches
        .map(item => item.replace(/^\d+\.\s*/, '').trim())
        .filter(kw => kw.length > 0)
        .join(' ');
      console.log('从列表中提取的关键词:', listKeywords);
      return listKeywords;
    }
    
    // 如果以上都失败，尝试提取英文单词作为关键词
    const words = reply
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word)) // 只保留纯英文且长度>3的词
      .slice(0, 10)
      .join(' ');
    
    if (words.length > 0) {
      console.log('从文本中提取的英文单词作为关键词:', words);
      return words;
    }
    
    // 最后的备用方案
    console.log('无法提取关键词，使用默认关键词');
    return 'research methodology quantitative analysis experimental design';
  } catch (err) {
    console.error('解析关键词错误:', err);
    return 'research methodology quantitative analysis experimental design';
  }
};

// 语义推荐API路由
app.post('/api/semantic-recommend', async (req, res) => {
  console.log('语义推荐API被调用');
  
  try {
    const { chatHistory = [], filter_venues = false, session_id = Date.now().toString() } = req.body;
    console.log('接收到的数据:', JSON.stringify(req.body, null, 2));
    
    // 构建消息列表
    const messages = [];
    
    // 添加聊天历史消息（如果有）
    const validHistory = chatHistory.filter(msg => 
      msg.type === 'user' || (msg.type === 'assistant' && !msg.isError)
    );
    
    // 首先检查是否需要翻译
    let translatedQuery = '';
    let needsTranslation = false;
    
    // 检查最后一条用户消息是否包含中文字符
    const lastUserMessage = validHistory.length > 0 ? 
      validHistory.find(msg => msg.type === 'user') : null;
    
    if (lastUserMessage) {
      const hasChinese = /[\u4e00-\u9fa5]/.test(lastUserMessage.content);
      if (hasChinese) {
        needsTranslation = true;
        console.log('检测到中文查询，进行翻译:', lastUserMessage.content);
        
        try {
          translatedQuery = await translateToEnglish(lastUserMessage.content);
          console.log('翻译成功:', {
            original: lastUserMessage.content,
            translated: translatedQuery
          });
        } catch (translationError) {
          console.error('翻译失败:', translationError);
        }
      }
    }

    // 构建关键词提取消息
    let messageContent = `Please analyze the following text and extract 2-3 key academic search terms. 
Focus on specific technical terms, methodologies, and core concepts.

Please respond in the following JSON format:
\`\`\`json
{
  "keywords": ["keyword1", "keyword2", "keyword3"]
}
\`\`\`

Text to analyze: "${needsTranslation && translatedQuery ? translatedQuery : ''}"

`;
    
    // 如果有有效的聊天历史，将其添加到消息中
    if (needsTranslation && translatedQuery) {
      // 如果已经翻译了查询，直接使用翻译后的文本
      console.log('使用翻译后的查询进行关键词提取:', translatedQuery);
    } else if (validHistory.length > 1) { // 超过1条消息才算有效对话
      messageContent += '\nConversation history:\n';
      
      // 只取最近的几条对话（避免消息过长）
      const recentHistory = validHistory.slice(-8); // 取最近8条消息
      
      recentHistory.forEach((msg, index) => {
        if (msg.type === 'user') {
          messageContent += `User ${index + 1}: ${msg.content}\n`;
        } else if (msg.type === 'assistant' && !msg.isError) {
          messageContent += `Assistant ${index + 1}: ${msg.content}\n`;
        }
      });
      
      messageContent += '\nBased on the above conversation, extract the most relevant academic search keywords.';
    } else {
      messageContent += 'Please provide some general academic research method keywords, especially in quantitative research methods, experimental design, data analysis, and related fields.';
    }
    
    console.log('发送给Coze API的消息:', messageContent);

    // 调用 Coze API 获取关键词
    let searchQuery = 'research methodology quantitative analysis experimental design'; // 默认关键词
    
    try {
      const keywordResponse = await fetch(`${COZE_API_URL}/open_api/v2/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${COZE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          bot_id: COZE_BOT_ID,
          user: COZE_USER_ID,
          query: messageContent,
          stream: false,
          conversation_id: `${session_id}_keywords`
        })
      });

      console.log('Coze API关键词提取响应状态:', keywordResponse.status, keywordResponse.statusText);

      if (keywordResponse.ok) {
        const result = await keywordResponse.json();
        console.log('Coze API关键词提取响应:', JSON.stringify(result));

        // 提取机器人回复
        let botReply = '';
        
        // v2 API 响应格式
        if (result.messages && Array.isArray(result.messages)) {
          // 过滤出type为answer的助手消息，这通常包含实际回复
          const answerMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
          if (answerMessages.length > 0) {
            botReply = answerMessages[0].content;
          } else {
            // 如果没有answer类型，则使用第一个助手消息
            const assistantMessages = result.messages.filter(m => m.role === 'assistant');
            if (assistantMessages.length > 0) {
              botReply = assistantMessages[0].content;
            }
          }
        }
        // v3 API 响应格式
        else if (result.data && result.data.messages) {
          const assistantMessages = result.data.messages.filter(m => m.role === 'assistant');
          if (assistantMessages.length > 0) {
            botReply = assistantMessages[0].content;
          }
        }
        // 直接响应格式
        else if (result.answer) {
          botReply = result.answer;
        }
        
        console.log('提取的机器人回复:', botReply);
        
        if (botReply) {
          // 从回复中提取关键词
          const extractedKeywords = parseKeywordsFromCozeResponse(botReply);
          if (extractedKeywords && extractedKeywords.length > 0) {
            searchQuery = extractedKeywords;
            console.log('从Coze API提取的关键词:', searchQuery);
          } else {
            console.log('未能从Coze API响应中提取到有效关键词，使用默认关键词');
          }
        }
      } else {
        console.error('Coze API关键词提取错误:', await keywordResponse.text());
      }
    } catch (cozeError) {
      console.error('调用Coze API关键词提取错误:', cozeError);
      // 如果Coze API调用失败，使用备用方法提取关键词
      if (validHistory.length > 1) {
        const recentHistory = validHistory.slice(-4); // 只取最近4条消息
        const backupKeywords = recentHistory
          .map(msg => msg.content)
          .join(' ')
          .replace(/[^\w\s]/g, ' ') // 移除标点符号
          .split(/\s+/)
          .filter(word => word.length > 2) // 过滤掉太短的词
          .slice(0, 10) // 只取前10个关键词
          .join(' ');
        searchQuery = backupKeywords;
        console.log('使用备用方法提取的关键词:', searchQuery);
      }
    }

    console.log('最终构建的搜索查询:', searchQuery);

    // 定义允许的期刊/会议列表
    const allowedVenues = [
      // 顶会
      'Computer-Supported Cooperative Work', 'CSCW',
      'Human Factors in Computing Systems', 'CHI',
      'Pervasive and Ubiquitous Computing', 'UbiComp',
      'User Interface Software and Technology', 'UIST',
      
      // 顶刊
      'Computers in Human Behavior',
      'CoDesign',
      'Technovation',
      'Design Studies',
      'Journal of Mixed Methods Research',
      'ACM Transactions on Computer-Human Interaction', 'TOCHI',
      'International Journal of Human-Computer Studies',
      'Design Issues',
      'Human-Computer Interaction',
      'Computer-Aided Design',
      'Applied Ergonomics',
      'International Journal of Design',
      'Human Factors',
      'Leonardo',
      'The Design Journal'
    ];

    // 修复关键词处理问题：保留短语结构，只在关键词之间添加逗号
    let formattedSearchQuery = searchQuery;
    
    try {
      // 首先检查searchQuery是否已经是逗号分隔的格式
      if (searchQuery.includes(',')) {
        console.log('检测到已经是逗号分隔的关键词，保持原样');
        formattedSearchQuery = searchQuery; // 保持原样
      }
      // 检查是否是从JSON中提取的关键词列表（包含引号）
      else if (searchQuery.includes('"') || searchQuery.includes("'")) {
        console.log('检测到包含引号的关键词，尝试保留短语结构');
        
        // 尝试将字符串转回数组
        const keywordArray = searchQuery.match(/"([^"]+)"|'([^']+)'|([^\s,]+)/g)
          .map(kw => kw.replace(/^["']|["']$/g, '').trim())
          .filter(kw => kw.length > 0);
          
        console.log('解析后的关键词数组:', keywordArray);
        
        // 使用逗号连接，但不替换短语内的空格
        formattedSearchQuery = keywordArray.join(',');
      } 
      // 处理普通空格分隔的关键词
      else {
        console.log('处理空格分隔的关键词');
        // 尝试识别短语（连续的多个单词）
        const phrases = [];
        const words = searchQuery.split(/\s+/);
        let currentPhrase = [];
        
        for (const word of words) {
          if (word.length <= 2 || /^(and|or|the|in|on|at|to|of|for|with)$/i.test(word)) {
            // 如果是短词或常见连接词，将其添加到当前短语
            if (currentPhrase.length > 0) {
              currentPhrase.push(word);
            }
          } else if (currentPhrase.length === 0) {
            // 开始新短语
            currentPhrase.push(word);
          } else if (currentPhrase[currentPhrase.length - 1].endsWith(',') || 
                    currentPhrase[currentPhrase.length - 1].endsWith('.')) {
            // 如果前一个词以逗号或句号结尾，开始新短语
            phrases.push(currentPhrase.join(' '));
            currentPhrase = [word];
          } else {
            // 继续当前短语
            currentPhrase.push(word);
          }
        }
        
        // 添加最后一个短语
        if (currentPhrase.length > 0) {
          phrases.push(currentPhrase.join(' '));
        }
        
        // 使用逗号连接短语
        formattedSearchQuery = phrases.join(',');
      }
    } catch (parseError) {
      console.error('解析关键词时出错:', parseError);
      // 出错时保持原样
      formattedSearchQuery = searchQuery;
    }
    
    console.log('格式化后的搜索查询:', formattedSearchQuery);
    
    // 构建基本查询参数 - 不对查询进行编码，保持原始格式
    let searchUrl = `${SEMANTIC_API_BASE}/paper/search?query=${formattedSearchQuery}&limit=5&fields=title,abstract,url,openAccessPdf,year,citationCount,authors,venue`;
    
    // 如果需要过滤期刊/会议，使用venue参数
    if (filter_venues) {
      // 使用原始venue名称，用逗号连接但不进行URL编码
      const venueParam = allowedVenues.join(',');
      searchUrl += `&venue=${venueParam}`;
    }
    
    // 输出最终请求URL用于调试
    console.log('最终Semantic Scholar API请求URL:', searchUrl);

    // 准备请求头 - 只使用基本的Accept头，避免API密钥问题
    const headers = {
      'Accept': 'application/json'
    };
    
    // 输出请求信息用于调试
    console.log('请求头:', JSON.stringify(headers));
    console.log('SEMANTIC_API_KEY是否存在:', !!SEMANTIC_API_KEY);

    // 调用Semantic Scholar API搜索相关论文 - 不使用API密钥
    console.log('开始调用Semantic Scholar API...');
    let searchResponse;
    try {
      searchResponse = await fetchWithRetry(searchUrl, {
        headers: headers
      }, 3, 1000); // 最多重试3次，初始延迟1秒
      
      console.log('Semantic Scholar API响应状态:', searchResponse.status, searchResponse.statusText);
      
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error('Semantic Scholar API错误响应:', errorText);
        throw new Error(`Semantic Scholar API responded with status: ${searchResponse.status}`);
      }
    } catch (fetchError) {
      console.error('Semantic Scholar API请求失败:', fetchError);
      throw fetchError;
    }

    // 解析响应
    let result;
    try {
      result = await searchResponse.json();
      console.log('Semantic Scholar API响应数据结构:', 
        Object.keys(result), 
        '数据项数量:', result.data ? result.data.length : 0
      );
    } catch (jsonError) {
      console.error('解析Semantic Scholar API响应失败:', jsonError);
      throw jsonError;
    }

    // 检查是否有搜索结果
    if (!result.data || result.data.length === 0) {
      console.log('没有找到匹配的论文');
      return res.json({
        success: true,
        papers: [],
        rawResponse: JSON.stringify(result),
        session_id: session_id || 'default'
      });
    }

    // 解析返回的论文数据
    const papers = await parseSemanticResponse(result.data || []);

    res.json({
      success: true,
      papers: papers,
      rawResponse: JSON.stringify(result.data),
      session_id: session_id || 'default'
    });
  } catch (error) {
    console.error('推荐API错误:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      papers: [],
      rawResponse: `错误：${error.message}`,
      session_id: (req.body && req.body.session_id) || 'default'
    });
  }
});

// 获取论文全文和研究方法的API端点
app.post('/api/paper/get-full-content', async (req, res) => {
  try {
    const { title, doi } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '需要提供论文标题' });
    }

    console.log('开始获取论文全文和研究方法，标题:', title, doi ? `，DOI: ${doi}` : '');
    
    // 获取全文，传递DOI参数
    const fullText = await getFullTextFromCore(title, doi, 3, 1000);
    let researchMethod = null;
    
    if (fullText) {
      // 如果成功获取全文，尝试提取研究方法
      researchMethod = await extractResearchMethod(fullText);
    }
    
    res.json({
      success: true,
      title: title,
      doi: doi,
      fullText: fullText,
      researchMethod: researchMethod,
      hasContent: !!fullText
    });
  } catch (error) {
    console.error('获取论文内容错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// 生成研究方法概要的API端点（备用方法）
app.post('/api/paper/generate-method-summary', async (req, res) => {
  try {
    const { title, fullText } = req.body;
    
    if (!title || !fullText) {
      return res.status(400).json({ 
        success: false,
        error: '需要提供论文标题和全文' 
      });
    }

    console.log('开始生成研究方法概要，标题:', title);
    
    // 使用备用方法生成研究方法概要
    const methodSummary = await generateMethodSummary(fullText);
    
    if (!methodSummary) {
      return res.json({
        success: false,
        error: '无法生成研究方法概要',
        title: title
      });
    }
    
    res.json({
      success: true,
      title: title,
      methodSummary: methodSummary
    });
  } catch (error) {
    console.error('生成研究方法概要错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// 测试CORE API路由
app.post('/api/test-core', async (req, res) => {
  try {
    const { title, doi } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '需要提供论文标题' });
    }

    console.log('测试CORE API，搜索标题:', title, doi ? `，DOI: ${doi}` : '');
    const fullText = await getFullTextFromCore(title, doi);
    
    res.json({
      success: true,
      title: title,
      doi: doi,
      fullText: fullText,
      hasContent: !!fullText
    });
  } catch (error) {
    console.error('CORE API测试错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// 查询统计方法的API端点
app.post('/api/query-statistical-method', async (req, res) => {
  try {
    const { method } = req.body;
    
    if (!method) {
      return res.status(400).json({ 
        success: false,
        error: '需要提供统计方法名称' 
      });
    }

    console.log('开始查询统计方法:', method);
    
    const prompt = `作为一个统计学专家，请详细解释以下统计方法：${method}
    
请包含以下内容：
1. 方法定义和用途
2. 适用场景
3. 基本假设
4. 计算步骤
5. 结果解释
6. 注意事项

请用通俗易懂的语言解释，并尽可能提供具体的例子。`;

    const response = await fetch(`${COZE_API_URL}/open_api/v2/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID,
        user: COZE_USER_ID,
        query: prompt,
        stream: false,
        conversation_id: `query_method_${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`Coze API responded with status: ${response.status}`);
    }

    const result = await response.json();
    let explanation = '';
    
    if (result.messages && Array.isArray(result.messages)) {
      const answerMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (answerMessages.length > 0) {
        explanation = answerMessages[0].content;
      }
    } else if (result.answer) {
      explanation = result.answer;
    }

    if (!explanation) {
      throw new Error('未能获取统计方法解释');
    }

    res.json({
      success: true,
      method: method,
      explanation: explanation
    });
  } catch (error) {
    console.error('查询统计方法错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// Coze聊天API端点 - 用于生成来源介绍等
app.post('/api/coze-chat', async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false,
        error: '需要提供消息内容' 
      });
    }

    console.log('Coze聊天API被调用，消息长度:', message.length);
    console.log('对话ID:', conversation_id);
    
    const response = await fetch(`${COZE_API_URL}/open_api/v2/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COZE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        bot_id: COZE_BOT_ID_Reference,
        user: COZE_USER_ID,
        query: message,
        stream: false,
        conversation_id: conversation_id || `chat_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Coze API错误响应 (${response.status}):`, errorText);
      throw new Error(`Coze API responded with status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Coze API响应结构:', Object.keys(result));
    
    let reply = '';
    
    if (result.messages && Array.isArray(result.messages)) {
      const answerMessages = result.messages.filter(m => m.role === 'assistant' && m.type === 'answer');
      if (answerMessages.length > 0) {
        reply = answerMessages[0].content;
      }
    } else if (result.answer) {
      reply = result.answer;
    }

    if (!reply) {
      throw new Error('未能从Coze API获取有效回复');
    }

    console.log('成功获取Coze回复，长度:', reply.length);

    res.json({
      success: true,
      reply: reply,
      conversation_id: conversation_id
    });
  } catch (error) {
    console.error('Coze聊天API错误:', error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// 获取缓存的研究方法API端点
app.post('/api/paper/get-cached-method', async (req, res) => {
  try {
    const { title, doi } = req.body;
    
    if (!title) {
      return res.status(400).json({ 
        success: false,
        error: '需要提供论文标题' 
      });
    }

    console.log('获取缓存的研究方法，标题:', title);
    
    // 这里可以实现缓存逻辑，目前直接尝试获取
    const fullText = await getFullTextFromCore(title, doi, 1, 500); // 减少重试次数和延迟
    let methodSummary = null;
    
    if (fullText) {
      methodSummary = await extractResearchMethod(fullText);
    }
    
    res.json({
      success: !!methodSummary,
      title: title,
      methodSummary: methodSummary
    });
  } catch (error) {
    console.error('获取缓存研究方法错误:', error);
    res.json({ 
      success: false,
      error: error.message
    });
  }
});



// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 MethodMate API服务器运行在端口 ${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
}); 