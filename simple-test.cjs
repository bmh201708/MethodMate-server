const https = require('https');
const http = require('http');
const { URL } = require('url');

// 测试配置
const BASE_URL = 'http://118.195.129.161:3002';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 简单的HTTP请求函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      timeout: 15000
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 测试单个接口
async function testAPI(name, endpoint, method = 'GET', body = null) {
  try {
    log(`\n🧪 测试: ${name}`, 'blue');
    log(`   URL: ${BASE_URL}${endpoint}`, 'cyan');
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const startTime = Date.now();
    const response = await makeRequest(`${BASE_URL}${endpoint}`, options);
    const duration = Date.now() - startTime;
    
    if (response.status >= 200 && response.status < 400) {
      log(`   ✅ 成功 (${response.status}) - ${duration}ms`, 'green');
      
      // 尝试解析JSON响应
      try {
        const data = JSON.parse(response.data);
        if (data && typeof data === 'object') {
          log(`   📝 响应字段: ${Object.keys(data).join(', ')}`, 'green');
        }
      } catch (e) {
        log(`   📝 响应长度: ${response.data.length} 字符`, 'green');
      }
      
      return { success: true, status: response.status, duration, data: response.data };
    } else {
      log(`   ❌ 失败 (${response.status}) - ${duration}ms`, 'red');
      log(`   错误: ${response.data.substring(0, 150)}${response.data.length > 150 ? '...' : ''}`, 'red');
      return { success: false, status: response.status, duration, error: response.data };
    }
  } catch (error) {
    log(`   ❌ 连接错误: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runTests() {
  log('🚀 MethodMate API 测试工具', 'bold');
  log(`📡 服务器: ${BASE_URL}`, 'cyan');
  log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  
  const results = [];
  
  // 基础连通性测试
  log('\n' + '='.repeat(50), 'yellow');
  log('📡 基础连通性测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  const basicTests = [
    {
      name: '服务器根路径',
      endpoint: '/',
      method: 'GET'
    }
  ];
  
  for (const test of basicTests) {
    const result = await testAPI(test.name, test.endpoint, test.method);
    results.push({ name: test.name, ...result });
  }
  
  // API功能测试
  log('\n' + '='.repeat(50), 'yellow');
  log('🔍 完整API功能测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  const apiTests = [
    {
      name: '语义推荐API - 英文查询',
      endpoint: '/api/semantic-recommend',
      method: 'POST',
      body: {
        chatHistory: [{ type: 'user', content: 'machine learning research methods' }],
        filter_venues: false,
        session_id: 'test_001'
      }
    },
    {
      name: '语义推荐API - 中文查询',
      endpoint: '/api/semantic-recommend',
      method: 'POST',
      body: {
        chatHistory: [{ type: 'user', content: '机器学习研究方法' }],
        filter_venues: true,
        session_id: 'test_002'
      }
    },
    {
      name: '论文全文获取API',
      endpoint: '/api/paper/get-full-content',
      method: 'POST',
      body: {
        title: 'Machine Learning in Healthcare: A Review',
        doi: null
      }
    },
    {
      name: '研究方法概要生成API',
      endpoint: '/api/paper/generate-method-summary',
      method: 'POST',
      body: {
        title: 'A Study of Machine Learning Methods',
        fullText: 'This research paper investigates various machine learning algorithms and their applications in data analysis. The methodology involves experimental design, data collection, and statistical analysis using quantitative methods.'
      }
    },
    {
      name: 'CORE API测试',
      endpoint: '/api/test-core',
      method: 'POST',
      body: {
        title: 'Research Methods in AI',
        doi: null
      }
    },
    {
      name: '统计方法查询API',
      endpoint: '/api/query-statistical-method',
      method: 'POST',
      body: { method: 't-test' }
    },
    {
      name: 'Coze聊天API',
      endpoint: '/api/coze-chat',
      method: 'POST',
      body: { 
        message: 'What is quantitative research?',
        conversation_id: 'test_chat_001' 
      }
    },
    {
      name: '缓存研究方法API',
      endpoint: '/api/paper/get-cached-method',
      method: 'POST',
      body: {
        title: 'Data Mining Techniques',
        doi: null
      }
    }
  ];
  
  for (const test of apiTests) {
    const result = await testAPI(test.name, test.endpoint, test.method, test.body);
    results.push({ name: test.name, ...result });
    
    // 避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 生成测试报告
  log('\n' + '='.repeat(60), 'bold');
  log('📊 测试结果汇总', 'bold');
  log('='.repeat(60), 'bold');
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  log(`\n📈 统计信息:`, 'cyan');
  log(`   总测试数: ${results.length}`, 'cyan');
  log(`   成功数量: ${successCount}`, 'green');
  log(`   失败数量: ${failureCount}`, failureCount > 0 ? 'red' : 'green');
  log(`   成功率: ${((successCount / results.length) * 100).toFixed(1)}%`, 'cyan');
  log(`   总耗时: ${totalTime}ms`, 'cyan');
  
  log(`\n📋 详细结果:`, 'cyan');
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const time = result.duration ? ` (${result.duration}ms)` : '';
    const color = result.success ? 'green' : 'red';
    log(`   ${index + 1}. ${icon} ${result.name}${time}`, color);
    
    if (!result.success && result.error) {
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      log(`      💥 错误: ${errorMsg.substring(0, 80)}${errorMsg.length > 80 ? '...' : ''}`, 'red');
    }
  });
  
  // 健康状况评估
  log(`\n🏥 服务健康状况评估:`, 'yellow');
  const successRate = (successCount / results.length) * 100;
  if (successRate >= 90) {
    log(`   🟢 优秀 - 所有API均正常工作 (${successRate.toFixed(1)}%)`, 'green');
  } else if (successRate >= 70) {
    log(`   🟡 良好 - 大部分API正常工作 (${successRate.toFixed(1)}%)`, 'yellow');
  } else if (successRate >= 50) {
    log(`   🟠 一般 - 约一半API正常，需要检查 (${successRate.toFixed(1)}%)`, 'yellow');
  } else if (successRate > 0) {
    log(`   🔴 较差 - 多数API异常，需要排查 (${successRate.toFixed(1)}%)`, 'red');
  } else {
    log(`   💀 严重 - 所有API均异常 (${successRate.toFixed(1)}%)`, 'red');
  }

  // 诊断建议
  log(`\n🔧 详细诊断结果:`, 'yellow');
  
  const serverErrors = results.filter(r => !r.success && r.status >= 500).length;
  const clientErrors = results.filter(r => !r.success && r.status >= 400 && r.status < 500).length;
  const connectionErrors = results.filter(r => !r.success && !r.status).length;
  
  if (connectionErrors > 0) {
    log(`   🌐 网络连接问题 (${connectionErrors}个):`, 'red');
    log(`      - 检查服务器是否运行在端口3002`, 'red');
    log(`      - 检查防火墙设置是否开放端口`, 'red');
    log(`      - 验证网络连通性`, 'red');
  }
  
  if (serverErrors > 0) {
    log(`   ⚙️ 服务器内部错误 (${serverErrors}个):`, 'red');
    log(`      - 检查API密钥配置 (Coze API, CORE API, Semantic Scholar)`, 'red');
    log(`      - 查看服务器错误日志`, 'red');
    log(`      - 检查外部API服务可用性`, 'red');
    log(`      - 验证环境变量配置`, 'red');
  }
  
  if (clientErrors > 0) {
    log(`   📝 客户端请求问题 (${clientErrors}个):`, 'red');
    log(`      - 检查API参数格式`, 'red');
    log(`      - 验证请求头设置`, 'red');
  }
  
  if (successCount > 0) {
    log(`   ✅ 正常工作的功能:`, 'green');
    results.filter(r => r.success).forEach(r => {
      log(`      - ${r.name}`, 'green');
    });
  }
  
  if (failureCount > 0) {
    log(`   ❌ 需要修复的功能:`, 'red');
    results.filter(r => !r.success).forEach(r => {
      log(`      - ${r.name}`, 'red');
    });
  }
  
  log(`\n⏰ 测试完成: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  return results;
}

// 运行测试
if (require.main === module) {
  runTests()
    .then(results => {
      const successCount = results.filter(r => r.success).length;
      log(`\n🎯 测试完成！成功: ${successCount}/${results.length}`, 'bold');
      process.exit(0);
    })
    .catch(error => {
      log(`\n💥 测试出错: ${error.message}`, 'red');
      process.exit(1);
    });
} 