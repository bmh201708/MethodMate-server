#!/bin/bash

# MethodMate API 后端入口脚本
# 用于 DevBox 项目部署和 OCI 镜像启动

# 检查并修复 npm 权限问题
if [ -d "/www/server/nodejs/cache" ]; then
    echo "检测到服务器环境，修复 npm 权限..."
    sudo chown -R $(whoami):$(whoami) "/www/server/nodejs/cache" 2>/dev/null || true
fi

# 清理 npm 缓存（如果需要）
npm cache clean --force 2>/dev/null || true

# 安装依赖（如果 node_modules 不存在）
if [ ! -d "node_modules" ]; then
    echo "安装项目依赖..."
    npm install --no-optional --cache /tmp/.npm
fi

# 启动应用
echo "启动 MethodMate API 服务..."
node local-api.js