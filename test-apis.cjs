const fetch = require('node-fetch');

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
      },
      timeout: 15000
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const duration = Date.now() - startTime;
    
    const responseText = await response.text();
    
    if (response.ok) {
      log(`   ✅ 成功 (${response.status}) - ${duration}ms`, 'green');
      
      // 尝试解析JSON响应
      try {
        const data = JSON.parse(responseText);
        if (data && typeof data === 'object') {
          log(`   📝 响应字段: ${Object.keys(data).join(', ')}`, 'green');
        }
      } catch (e) {
        log(`   📝 响应长度: ${responseText.length} 字符`, 'green');
      }
      
      return { success: true, status: response.status, duration, data: responseText };
    } else {
      log(`   ❌ 失败 (${response.status}) - ${duration}ms`, 'red');
      log(`   错误: ${responseText.substring(0, 150)}${responseText.length > 150 ? '...' : ''}`, 'red');
      return { success: false, status: response.status, duration, error: responseText };
    }
  } catch (error) {
    log(`   ❌ 连接错误: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runAllTests() {
  log('🚀 MethodMate API 完整测试', 'bold');
  log(`📡 服务器: ${BASE_URL}`, 'cyan');
  log(`⏰ 开始时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  
  const results = [];
  
  // 测试列表
  const tests = [
    {
      name: '基础连通性测试',
      endpoint: '/',
      method: 'GET'
    },
    {
      name: '语义推荐API - 英文查询',
      endpoint: '/api/semantic-recommend',
      method: 'POST',
      body: {
        chatHistory: [
          { type: 'user', content: 'machine learning research methods' }
        ],
        filter_venues: false,
        session_id: 'test_001'
      }
    },
    {
      name: '语义推荐API - 中文查询',
      endpoint: '/api/semantic-recommend',
      method: 'POST',
      body: {
        chatHistory: [
          { type: 'user', content: '机器学习研究方法' }
        ],
        filter_venues: true,
        session_id: 'test_002'
      }
    },
    {
      name: '论文全文获取API',
      endpoint: '/api/paper/get-full-content',
      method: 'POST',
      body: {
        title: 'Machine Learning in Healthcare',
        doi: null
      }
    },
    {
      name: '统计方法查询API',
      endpoint: '/api/query-statistical-method',
      method: 'POST',
      body: {
        method: 't-test'
      }
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
      name: 'CORE API测试',
      endpoint: '/api/test-core',
      method: 'POST',
      body: {
        title: 'Research Methods in AI',
        doi: null
      }
    },
    {
      name: '缓存研究方法API',
      endpoint: '/api/paper/get-cached-method',
      method: 'POST',
      body: {
        title: 'Data Analysis Methods',
        doi: null
      }
    }
  ];
  
  // 执行所有测试
  log('\n' + '='.repeat(60), 'yellow');
  log('🔍 开始执行API测试', 'yellow');
  log('='.repeat(60), 'yellow');
  
  for (const test of tests) {
    const result = await testAPI(test.name, test.endpoint, test.method, test.body);
    results.push({
      name: test.name,
      ...result
    });
    
    // 在测试之间稍作延迟，避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 生成测试报告
  log('\n' + '='.repeat(60), 'bold');
  log('📊 测试结果汇总', 'bold');
  log('='.repeat(60), 'bold');
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const avgTime = totalTime / results.length;
  
  log(`\n📈 统计信息:`, 'cyan');
  log(`   总测试数: ${results.length}`, 'cyan');
  log(`   成功数量: ${successCount}`, 'green');
  log(`   失败数量: ${failureCount}`, failureCount > 0 ? 'red' : 'green');
  log(`   成功率: ${((successCount / results.length) * 100).toFixed(1)}%`, 'cyan');
  log(`   总耗时: ${totalTime}ms`, 'cyan');
  log(`   平均响应时间: ${avgTime.toFixed(0)}ms`, 'cyan');
  
  log(`\n📋 详细结果:`, 'cyan');
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌';
    const time = result.duration ? ` (${result.duration}ms)` : '';
    const color = result.success ? 'green' : 'red';
    log(`   ${index + 1}. ${icon} ${result.name}${time}`, color);
    
    if (!result.success && result.error) {
      const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      log(`      💥 错误: ${errorMsg.substring(0, 100)}${errorMsg.length > 100 ? '...' : ''}`, 'red');
    }
  });
  
  // 健康状况评估
  log(`\n🏥 服务健康状况评估:`, 'yellow');
  if (successCount === results.length) {
    log(`   🟢 优秀 - 所有API均正常工作`, 'green');
  } else if (successCount >= results.length * 0.8) {
    log(`   🟡 良好 - 大部分API正常，少数可能有问题`, 'yellow');
  } else if (successCount >= results.length * 0.5) {
    log(`   🟠 一般 - 约一半API正常，需要检查配置`, 'yellow');
  } else {
    log(`   🔴 差 - 大部分API异常，请检查服务器状态`, 'red');
  }
  
  // 问题诊断建议
  if (failureCount > 0) {
    log(`\n🔧 故障排除建议:`, 'yellow');
    
    const serverErrors = results.filter(r => !r.success && r.status >= 500).length;
    const clientErrors = results.filter(r => !r.success && r.status >= 400 && r.status < 500).length;
    const connectionErrors = results.filter(r => !r.success && !r.status).length;
    
    if (connectionErrors > 0) {
      log(`   🌐 网络连接问题 (${connectionErrors}个):`, 'red');
      log(`      - 检查服务器是否运行在端口3002`, 'red');
      log(`      - 检查防火墙设置`, 'red');
      log(`      - 验证网络连通性`, 'red');
    }
    
    if (serverErrors > 0) {
      log(`   ⚙️ 服务器内部错误 (${serverErrors}个):`, 'red');
      log(`      - 检查API密钥配置 (Coze API, CORE API)`, 'red');
      log(`      - 查看服务器日志`, 'red');
      log(`      - 检查外部服务可用性`, 'red');
    }
    
    if (clientErrors > 0) {
      log(`   📝 请求格式问题 (${clientErrors}个):`, 'red');
      log(`      - 可能是API接口参数不匹配`, 'red');
      log(`      - 检查请求格式是否正确`, 'red');
    }
  }
  
  log(`\n⏰ 测试完成时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  return results;
}

// 运行测试
if (require.main === module) {
  runAllTests()
    .then(results => {
      const successCount = results.filter(r => r.success).length;
      const total = results.length;
      log(`\n🎯 测试任务完成！成功率: ${((successCount / total) * 100).toFixed(1)}%`, 'bold');
      process.exit(successCount === total ? 0 : 1);
    })
    .catch(error => {
      log(`\n💥 测试执行出错: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testAPI }; 