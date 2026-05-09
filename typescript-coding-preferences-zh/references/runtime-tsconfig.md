# Runtime 与 TSConfig 参考

## 新项目基线

除非项目明确需要 CommonJS、纯浏览器环境，或者框架已经接管了 tsconfig，否则可以默认采用这份基线：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

`NodeNext` 可以让 TypeScript 的模块解析行为与 Node 的 ESM / CommonJS 包解析规则保持一致。`esModuleInterop: true` 则可以减少与仍以 CommonJS 风格导出的 npm 包互操作时的摩擦。

## 运行时偏好

- 偏保守的服务端运行时：Node.js 24
- 偏 Bun-first 的产品 / 开发体验运行时：当前环境内可用的稳定版 Bun
- Edge / serverless 运行时：先服从目标平台，再让业务代码尽量保持框架无关

不要顺手把已有 CommonJS 项目改成 `NodeNext`。模块系统迁移应视为明确任务，因为 package exports、导入扩展名、测试运行器和构建产物都会受到影响。
