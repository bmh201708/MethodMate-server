import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fetch = require('node-fetch');

// 快速连通性测试脚本
const BASE_URL = 'http://118.195.129.161:3002';

async function quickTest() {
  console.log('🔍 MethodMate 快速连通性测试');
  console.log('================================');
  console.log(`📡 测试服务器: ${BASE_URL}`);
  console.log(`⏰ 时间: ${new Date().toLocaleString('zh-CN')}\n`);

  const tests = [
    {
      name: '服务器基础连通性',
      url: `${BASE_URL}/`,
      method: 'GET'
    },
    {
      name: '语义推荐API基础测试', 
      url: `${BASE_URL}/api/semantic-recommend`,
      method: 'POST',
      body: {
        chatHistory: [{ type: 'user', content: 'test' }],
        session_id: 'quick_test'
      }
    },
    {
      name: '统计方法查询API',
      url: `${BASE_URL}/api/query-statistical-method`,
      method: 'POST', 
      body: { method: 'correlation' }
    }
  ];

  let success = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`🧪 测试: ${test.name}`);
      
      const options = {
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      };
      
      if (test.body) {
        options.body = JSON.stringify(test.body);
      }

      const startTime = Date.now();
      const response = await fetch(test.url, options);
      const duration = Date.now() - startTime;
      
      if (response.status < 500) {
        console.log(`   ✅ 连通正常 (${response.status}) - ${duration}ms`);
        success++;
      } else {
        console.log(`   ❌ 服务器错误 (${response.status}) - ${duration}ms`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ 连接失败: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 快速测试结果:');
  console.log(`   成功: ${success}`);
  console.log(`   失败: ${failed}`); 
  console.log(`   成功率: ${((success / (success + failed)) * 100).toFixed(1)}%`);

  if (failed === tests.length) {
    console.log('\n❌ 所有测试失败 - 服务器可能未启动或网络不通');
    console.log('🔧 建议检查:');
    console.log('   1. 服务器是否运行在端口 3002');
    console.log('   2. 防火墙是否开放端口 3002');
    console.log('   3. 是否需要配置反向代理');
  } else if (failed > 0) {
    console.log('\n⚠️ 部分测试失败 - 服务器可能部分可用');
  } else {
    console.log('\n✅ 所有测试通过 - 服务器运行正常');
  }
}

quickTest().catch(console.error); 