import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fetch = require('node-fetch');
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试配置
const BASE_URL = 'http://118.195.129.161:3002';
const TEST_TIMEOUT = 30000; // 30秒超时

// 颜色输出函数
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

// 测试工具函数
async function testEndpoint(name, path, method = 'GET', body = null, expectedStatus = 200) {
  try {
    log(`\n🧪 测试 ${name}...`, 'blue');
    log(`   URL: ${BASE_URL}${path}`, 'cyan');
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: TEST_TIMEOUT
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
      log(`   请求体: ${JSON.stringify(body, null, 2)}`, 'cyan');
    }
    
    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}${path}`, options);
    const duration = Date.now() - startTime;
    
    const responseText = await response.text();
    let responseData;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      responseData = responseText;
    }
    
    if (response.status === expectedStatus) {
      log(`   ✅ 成功 (${response.status}) - ${duration}ms`, 'green');
      if (typeof responseData === 'object' && responseData) {
        log(`   响应: ${Object.keys(responseData).join(', ')}`, 'green');
      } else {
        log(`   响应长度: ${responseText.length} 字符`, 'green');
      }
      return { success: true, data: responseData, duration };
    } else {
      log(`   ❌ 失败 (${response.status}) - 期望: ${expectedStatus}`, 'red');
      log(`   错误: ${responseText.substring(0, 200)}...`, 'red');
      return { success: false, error: responseText, status: response.status, duration };
    }
  } catch (error) {
    log(`   ❌ 连接错误: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// 主测试函数
async function runTests() {
  log('🚀 MethodMate API 接口测试开始', 'bold');
  log(`📡 测试服务器: ${BASE_URL}`, 'cyan');
  log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}`, 'cyan');
  
  const results = [];
  
  // 1. 基础连通性测试
  log('\n' + '='.repeat(50), 'yellow');
  log('📡 基础连通性测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  // 测试根路径
  results.push({
    name: '根路径访问',
    ...(await testEndpoint('根路径访问', '/', 'GET', null, 404))
  });
  
  // 2. 语义推荐API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('🔍 语义推荐API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  // 基础语义推荐测试
  results.push({
    name: '语义推荐API - 基础测试',
    ...(await testEndpoint(
      '语义推荐API - 基础测试',
      '/api/semantic-recommend',
      'POST',
      {
        chatHistory: [
          { type: 'user', content: 'machine learning research methods' }
        ],
        filter_venues: false,
        session_id: 'test_session_001'
      }
    ))
  });
  
  // 中文查询测试
  results.push({
    name: '语义推荐API - 中文查询',
    ...(await testEndpoint(
      '语义推荐API - 中文查询',
      '/api/semantic-recommend',
      'POST',
      {
        chatHistory: [
          { type: 'user', content: '机器学习研究方法' }
        ],
        filter_venues: true,
        session_id: 'test_session_002'
      }
    ))
  });
  
  // 3. 论文全文获取API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('📄 论文全文获取API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: '论文全文获取',
    ...(await testEndpoint(
      '论文全文获取',
      '/api/paper/get-full-content',
      'POST',
      {
        title: 'Machine Learning in Healthcare: A Review',
        doi: null
      }
    ))
  });
  
  // 4. 研究方法生成API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('🔬 研究方法生成API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: '研究方法概要生成',
    ...(await testEndpoint(
      '研究方法概要生成',
      '/api/paper/generate-method-summary',
      'POST',
      {
        title: 'A Study of Machine Learning Methods',
        fullText: 'This research paper investigates various machine learning algorithms and their applications in data analysis. The methodology involves experimental design, data collection, and statistical analysis using quantitative methods.'
      }
    ))
  });
  
  // 5. CORE API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('🗃️ CORE API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: 'CORE API测试',
    ...(await testEndpoint(
      'CORE API测试',
      '/api/test-core',
      'POST',
      {
        title: 'Machine Learning Applications',
        doi: null
      }
    ))
  });
  
  // 6. 统计方法查询API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('📊 统计方法查询API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: '统计方法查询',
    ...(await testEndpoint(
      '统计方法查询',
      '/api/query-statistical-method',
      'POST',
      {
        method: 't-test'
      }
    ))
  });
  
  // 7. Coze聊天API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('💬 Coze聊天API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: 'Coze聊天API',
    ...(await testEndpoint(
      'Coze聊天API',
      '/api/coze-chat',
      'POST',
      {
        message: 'What is machine learning?',
        conversation_id: 'test_conversation_001'
      }
    ))
  });
  
  // 8. 缓存研究方法API测试
  log('\n' + '='.repeat(50), 'yellow');
  log('💾 缓存研究方法API测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  results.push({
    name: '缓存研究方法获取',
    ...(await testEndpoint(
      '缓存研究方法获取',
      '/api/paper/get-cached-method',
      'POST',
      {
        title: 'Data Mining Techniques',
        doi: null
      }
    ))
  });
  
  // 9. 错误处理测试
  log('\n' + '='.repeat(50), 'yellow');
  log('⚠️ 错误处理测试', 'yellow');
  log('='.repeat(50), 'yellow');
  
  // 测试无效路径
  results.push({
    name: '无效API路径',
    ...(await testEndpoint('无效API路径', '/api/invalid-endpoint', 'GET', null, 404))
  });
  
  // 测试缺少参数的请求
  results.push({
    name: '缺少参数的请求',
    ...(await testEndpoint(
      '缺少参数的请求',
      '/api/paper/get-full-content',
      'POST',
      {},
      400
    ))
  });
  
  // 生成测试报告
  log('\n' + '='.repeat(70), 'bold');
  log('📊 测试结果汇总', 'bold');
  log('='.repeat(70), 'bold');
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  log(`\n📈 总体统计:`, 'cyan');
  log(`   总测试数: ${results.length}`, 'cyan');
  log(`   成功: ${successCount}`, 'green');
  log(`   失败: ${failureCount}`, failureCount > 0 ? 'red' : 'green');
  log(`   成功率: ${((successCount / results.length) * 100).toFixed(1)}%`, 'cyan');
  log(`   总耗时: ${totalTime}ms`, 'cyan');
  
  log(`\n📋 详细结果:`, 'cyan');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    log(`   ${index + 1}. ${status} ${result.name}${duration}`, result.success ? 'green' : 'red');
    if (!result.success && result.error) {
      log(`      错误: ${result.error.substring(0, 100)}...`, 'red');
    }
  });
  
  // 连接诊断
  log(`\n🔧 连接诊断建议:`, 'yellow');
  if (failureCount === results.length) {
    log(`   ❌ 所有测试都失败了，可能的原因:`, 'red');
    log(`      1. 服务器未启动或端口3002未开放`, 'red');
    log(`      2. 防火墙阻止了连接`, 'red');
    log(`      3. 需要配置反向代理到端口3002`, 'red');
    log(`      4. DNS或网络配置问题`, 'red');
  } else if (failureCount > 0) {
    log(`   ⚠️ 部分测试失败，建议检查:`, 'yellow');
    log(`      1. API密钥配置是否正确`, 'yellow');
    log(`      2. 外部服务(Coze API, CORE API)是否可用`, 'yellow');
    log(`      3. 服务器资源是否充足`, 'yellow');
  } else {
    log(`   ✅ 所有测试通过！服务运行正常`, 'green');
  }
  
  log(`\n🔗 建议的服务器配置检查命令:`, 'cyan');
  log(`   1. 检查服务状态: ps aux | grep node`, 'cyan');
  log(`   2. 检查端口占用: netstat -tulpn | grep 3002`, 'cyan');
  log(`   3. 检查防火墙: ufw status`, 'cyan');
  log(`   4. 检查nginx配置: nginx -t`, 'cyan');
  
  return {
    total: results.length,
    success: successCount,
    failure: failureCount,
    successRate: (successCount / results.length) * 100,
    totalTime,
    results
  };
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(summary => {
      log(`\n🎯 测试完成! 成功率: ${summary.successRate.toFixed(1)}%`, 'bold');
      process.exit(summary.failure > 0 ? 1 : 0);
    })
    .catch(error => {
      log(`\n💥 测试运行出错: ${error.message}`, 'red');
      process.exit(1);
    });
}

export default runTests; 