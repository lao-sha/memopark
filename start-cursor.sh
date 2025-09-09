#!/bin/bash
# Cursor启动脚本 - 禁用GPU加速和主题问题

# 设置环境变量禁用硬件加速
export LIBGL_ALWAYS_SOFTWARE=1
export MESA_GL_VERSION_OVERRIDE=3.3
export ELECTRON_DISABLE_GPU=1
export ELECTRON_DISABLE_GPU_SANDBOX=1

# 禁用主题图标加载问题
export ELECTRON_DISABLE_SECURITY_WARNINGS=1

# 启动Cursor
cursor "$@"
