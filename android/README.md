# mdocs Android 壳

轻量 WebView：填自己的 mdocs 地址，侧载 APK。不上架。不参与 `pnpm build` / npm 包。

## 环境

- **不要装 Android Studio / 模拟器**（那是好几 GB）
- 本机最小 SDK（约 500MB，无模拟器）：`~/software/android-sdk`
  - 只含：cmdline-tools、platform-tools、platforms;android-34、build-tools;34.0.0
- 构建用已有 JDK 17：`JAVA_HOME` 指向 `.../jbr-17.0.14/Contents/Home`

## 构建 APK

```bash
cd android
./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

把 APK 拷到手机安装。首次需允许「未知来源」。

`assembleRelease` 使用 debug 签名，同样可侧载（见 `app/build.gradle.kts`）。

## 使用

1. 手机要能访问那台 mdocs（同一 Wi‑Fi、VPN 或公网）。不要填电脑上的 `127.0.0.1`。
2. 打开 App → 填写例如 `192.168.1.8:4000` 或 `https://你的域名`
3. 刷新用网页里的「拉取更新」。更换服务器：长按桌面图标 →「更换服务器」
4. 复制了本站文档链接（`/#/doc/<id>`）再切回 App，会打开该文

## 和主工程的关系

| | |
|--|--|
| 改这里 | 只影响 APK |
| `pnpm build` / `@fgbg/mdocs` | **不受影响**（npm `files` 不含 `android/`） |
