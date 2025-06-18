# MethodMate Server

MethodMate API后端服务，为学术研究提供智能化支持，包括论文搜索、研究方法分析、AI问答等功能。

## 功能特性

- 🔍 **学术搜索**: 集成Semantic Scholar API，提供高质量的学术论文搜索
- 📝 **论文分析**: 自动提取和分析论文研究方法
- 🤖 **AI问答**: 集成Coze AI，提供智能问答和统计方法解释
- 🌐 **多语言支持**: 支持中英文翻译和处理
- 📊 **语义推荐**: 基于对话历史的智能论文推荐
- 🔬 **研究方法提取**: 自动识别和总结论文中的研究方法

## API端点

### 核心功能
- `POST /api/scholar-search` - 学术论文搜索
- `POST /api/semantic-recommend` - 语义推荐
- `POST /api/coze-chat` - AI聊天问答

### 论文处理
- `POST /api/paper/get-full-content` - 获取论文全文
- `POST /api/paper/generate-method-summary` - 生成方法摘要
- `POST /api/paper/get-cached-method` - 获取缓存的研究方法

### 工具和测试
- `POST /api/query-statistical-method` - 统计方法查询
- `POST /api/test-core` - CORE API测试

## 技术栈

- **框架**: Node.js + Express
- **AI服务**: Coze API
- **学术API**: Semantic Scholar API, CORE API
- **翻译服务**: 集成多种翻译API
- **部署**: Docker/DevBox支持

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 环境配置
创建`.env`文件并配置以下变量：
```env
COZE_API_KEY=your_coze_api_key
CORE_API_KEY=your_core_api_key
SEMANTIC_API_KEY=your_semantic_scholar_api_key
PORT=3002
NODE_ENV=production
```

### 启动服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start

# 使用入口脚本
chmod +x entrypoint.sh
./entrypoint.sh
```

## 部署

### DevBox/远程服务器
```bash
# 克隆项目
git clone https://github.com/bmh201708/MethodMate-server.git
cd MethodMate-server

# 安装依赖
npm install

# 设置执行权限
chmod +x entrypoint.sh

# 启动服务
./entrypoint.sh
```

### Docker部署
```bash
# 构建镜像
docker build -t methodmate-server .

# 运行容器
docker run -p 3002:3002 -e COZE_API_KEY=your_key methodmate-server
```

## API文档

### 请求格式
所有API请求都使用JSON格式：
```json
{
  "Content-Type": "application/json"
}
```

### 响应格式
```json
{
  "success": true,
  "data": "响应数据",
  "error": "错误信息(如果有)"
}
```

### 示例请求
```bash
# 学术搜索
curl -X POST http://localhost:3002/api/scholar-search \
  -H "Content-Type: application/json" \
  -d '{"query":"machine learning"}'

# AI问答
curl -X POST http://localhost:3002/api/coze-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"什么是t检验?"}'
```

## 开发指南

### 项目结构
```
├── local-api.js          # 主服务文件
├── translate-service.js   # 翻译服务
├── coze-translate-service.js # Coze翻译服务
├── entrypoint.sh         # 启动脚本
├── package.json          # 项目配置
└── README.md            # 项目文档
```

### 添加新API
1. 在`local-api.js`中添加新的路由
2. 实现相应的处理逻辑
3. 添加错误处理
4. 更新文档

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！

## 联系方式

- GitHub: [@bmh201708](https://github.com/bmh201708)
- 项目主页: [MethodMate](https://github.com/bmh201708/MethodMate-server) 