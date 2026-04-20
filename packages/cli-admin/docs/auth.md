# auth - 认证管理

## 登录

```bash
# 浏览器 SSO 登录（默认方式）
cashop-console auth login
cashop-console auth login --env stable

# 账号密码登录（终端输入，支持短信验证码）
cashop-console auth login --credential

# Token 直接登录（从浏览器 Cookie X-AUTHENTICATION 获取）
cashop-console auth login --token <token>
cashop-console auth login --token <token> --env prod
```

| 方式 | 选项 | 说明 |
|------|------|------|
| 浏览器 SSO | (默认) | 打开浏览器完成 SSO 登录，自动获取 Token |
| 账号密码 | `--credential` | 终端输入用户名密码，支持短信验证码 |
| 直接 Token | `--token <token>` | 适用于自动化场景 |

## 登出

```bash
cashop-console auth logout
cashop-console auth logout --env prod
```

## 查看状态

```bash
cashop-console auth status
cashop-console auth status --env prod
```

输出示例：

```
✓ Logged in as zhang.san
  Environment: stable
```
