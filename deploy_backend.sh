#!/bin/bash

# Yang Le Me 后端部署脚本
# 用途：自动化部署后端代码到远程服务器，保留上传的图片

# 配置参数
REMOTE_HOST="interstellar.fan"
REMOTE_USER="root"
DEPLOY_PATH="/mnt/vdb1/1panel/apps/openresty/openresty/www/sites/guiren-match"

# 1Panel API 配置
PANEL_URL="https://interstellar.fan:8090"
API_KEY="NSG9wjE8z5MvK4lu3sJxp960T5YSV98t"
RUNTIME_ID="9"  # Node.js 运行环境ID

echo "开始部署 Yang Le Me 后端应用..."

# 检查本地后端代码是否存在
if [ ! -d "./backend" ]; then
    echo "错误：找不到本地 backend 目录"
    exit 1
fi

echo "本地代码检查通过"

# 第一步：在远程服务器上备份上传的图片
echo "正在备份上传的图片..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa $REMOTE_USER@$REMOTE_HOST "DEPLOY_PATH='$DEPLOY_PATH'; BACKUP_DIR=\"/tmp/uploads_backup_\$(date +%s)\"; if [ -d \"\$DEPLOY_PATH/public/uploads\" ]; then mkdir -p \"\$BACKUP_DIR\" && cp -r \"\$DEPLOY_PATH/public/uploads\"/* \"\$BACKUP_DIR/\" 2>/dev/null || true && echo \"图片备份成功，备份位置: \$BACKUP_DIR\"; else echo \"没有需要备份的图片\"; fi"

echo ""

# 第二步：打包本地代码
echo "正在打包本地代码..."
tar -czf backend_temp.tar.gz -C ./backend --exclude='node_modules' --exclude='.git' --exclude='public/uploads' .

if [ $? -ne 0 ]; then
    echo "错误：代码打包失败"
    exit 1
fi

echo "本地代码打包成功"

# 第三步：传输代码到远程服务器
echo "正在传输代码到远程服务器..."
scp -i ~/.ssh/id_rsa backend_temp.tar.gz $REMOTE_USER@$REMOTE_HOST:/tmp/

if [ $? -ne 0 ]; then
    echo "错误：代码传输失败"
    rm -f backend_temp.tar.gz
    exit 1
fi

echo "代码传输成功"

# 第四步：在远程服务器上部署
echo "正在远程服务器上部署..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa $REMOTE_USER@$REMOTE_HOST "DEPLOY_PATH='$DEPLOY_PATH'; cd \"\$DEPLOY_PATH\"; echo '清理旧代码...'; for item in *; do if [ \"\$item\" != 'public' ]; then rm -rf \"\$item\"; fi; done; if [ -d 'public' ]; then cd public; for item in *; do if [ \"\$item\" != 'uploads' ]; then rm -rf \"\$item\"; fi; done; cd ..; fi; echo '解压新代码...'; tar -xzf /tmp/backend_temp.tar.gz; rm /tmp/backend_temp.tar.gz; echo '恢复备份的图片...'; BACKUP_DIR=\$(ls -td /tmp/uploads_backup_* 2>/dev/null | head -1); if [ -n \"\$BACKUP_DIR\" ] && [ -d \"\$BACKUP_DIR\" ]; then mkdir -p \"\$DEPLOY_PATH/public/uploads\"; cp -r \"\$BACKUP_DIR\"/* \"\$DEPLOY_PATH/public/uploads/\" 2>/dev/null || true; rm -rf \"\$BACKUP_DIR\"; echo '图片恢复成功'; else echo '没有找到备份的图片'; fi; echo '安装依赖...'; npm install"

echo ""

# 第五步：清理本地临时文件
rm -f backend_temp.tar.gz

# 第六步：通过 1Panel API 重启运行环境
echo "正在通过 1Panel API 重启运行环境..."

# 生成 1Panel Token (格式: md5('1panel' + API-Key + UnixTimestamp))
TIMESTAMP=$(date +%s)
PANEL_TOKEN=$(echo -n "1panel${API_KEY}${TIMESTAMP}" | md5sum | awk '{print $1}')

# 调用 1Panel API 重启运行环境
RESTART_RESPONSE=$(curl -s -k -X POST "${PANEL_URL}/api/v1/runtimes/operate" \
    -H "Content-Type: application/json" \
    -H "1Panel-Token: ${PANEL_TOKEN}" \
    -H "1Panel-Timestamp: ${TIMESTAMP}" \
    -d "{
        \"operate\": \"restart\",
        \"ID\": ${RUNTIME_ID}
    }" 2>/dev/null)

# 检查 API 响应
if echo "$RESTART_RESPONSE" | grep -q '"code":200'; then
    echo "运行环境重启成功！"
else
    echo "警告：运行环境重启可能失败，API响应:"
    echo "$RESTART_RESPONSE"
fi

echo ""
echo "部署完成！"
echo "应用已部署到 $REMOTE_USER@$REMOTE_HOST:$DEPLOY_PATH"
echo ""
echo "部署脚本执行完毕"
