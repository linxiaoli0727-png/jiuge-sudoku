#!/bin/zsh

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_FILE="$APP_DIR/index.html"

if [[ ! -f "$APP_FILE" ]]; then
  echo "找不到游戏文件：$APP_FILE"
  exit 1
fi

open "$APP_FILE"
echo "九格已打开。关闭这个终端窗口不会影响游戏。"
