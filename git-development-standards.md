# Git 开发规范与约束

## 1. 分支规范

主分支：

- `main`：生产稳定分支，只允许合并已测试通过的代码。
- `develop`：日常集成分支，功能开发完成后先合并到此分支。

开发分支：

- `feature/xxx`：新功能开发，例如 `feature/user-login`。
- `fix/xxx`：问题修复，例如 `fix/order-status-bug`。
- `hotfix/xxx`：线上紧急修复，例如 `hotfix/payment-timeout`。
- `release/xxx`：发版准备分支，例如 `release/v1.2.0`。

约束：

- 禁止直接在 `main` 分支开发。
- 禁止多人长期共用同一个功能分支。
- 分支名称必须能看出改动目的，避免 `test`、`aaa`、`new` 这类无意义命名。

## 2. 提交规范

提交信息格式：

```text
type(scope): subject
```

常用类型：

- `feat`：新增功能
- `fix`：修复问题
- `docs`：文档修改
- `style`：代码格式调整，不影响逻辑
- `refactor`：代码重构
- `test`：测试相关
- `chore`：构建、依赖、配置等杂项

示例：

```text
feat(auth): add user login api
fix(order): correct order status update logic
docs(git): add branch workflow rules
```

约束：

- 一次提交只做一类事情，避免把多个无关修改混在一起。
- 提交前必须自测，不能把明显不可运行的代码提交上去。
- 禁止提交无意义信息，例如 `update`、`fix bug`、`111`。

## 3. 合并规范

推荐流程：

1. 从 `develop` 拉取最新代码。
2. 基于 `develop` 创建功能分支。
3. 本地开发并提交。
4. 推送远程分支。
5. 发起 Merge Request / Pull Request。
6. 代码审查通过后合并到 `develop`。
7. 发版前从 `develop` 创建 `release` 分支。
8. 测试通过后合并到 `main` 并打 Tag。

约束：

- 合并前必须解决冲突。
- 合并前必须确认测试通过。
- 重要功能必须经过代码审查。
- 合并到 `main` 后必须打版本 Tag。

## 4. 代码审查规范

审查重点：

- 是否符合需求。
- 是否存在明显 Bug。
- 是否影响已有功能。
- 是否有必要的异常处理。
- 是否存在安全风险。
- 是否有重复代码或明显低质量实现。
- 是否补充了必要测试。

约束：

- 审查人不能只点通过，需要确认核心逻辑。
- 作者需要回应审查意见。
- 未解决关键问题前不得合并。

## 5. 冲突处理规范

处理原则：

- 谁开发相关模块，谁优先处理冲突。
- 冲突解决后必须重新运行测试。
- 不确定代码含义时，不允许随意删除他人代码。

约束：

- 禁止用强制覆盖方式解决冲突。
- 禁止未经确认删除他人功能代码。
- 冲突解决后需要单独提交，并说明处理内容。

## 6. 版本 Tag 规范

版本格式：

```text
v主版本.次版本.修订版本
```

示例：

```text
v1.0.0
v1.1.0
v1.1.1
```

规则：

- 主版本：不兼容的大版本升级。
- 次版本：新增功能，但兼容旧版本。
- 修订版本：Bug 修复或小改动。

约束：

- 每次正式发布必须打 Tag。
- Tag 对应的代码必须来自 `main` 分支。
- Tag 说明中应包含主要变更内容。

## 7. 禁止事项

严禁：

- 直接向 `main` 强推代码。
- 提交密码、密钥、Token、数据库连接串等敏感信息。
- 提交本地临时文件、日志文件、编译产物。
- 未经沟通重写公共分支历史。
- 未测试直接合并。
- 大量无关格式化导致代码审查困难。

## 8. 推荐配置

建议项目维护：

- `.gitignore`：忽略本地缓存、日志、构建产物、依赖目录。
- `README.md`：说明项目启动、构建、测试方式。
- `CHANGELOG.md`：记录版本变更。
- PR 模板：约束提交说明、测试结果和影响范围。

## 9. 常用命令

```bash
git checkout develop
git pull
git checkout -b feature/xxx
git status
git add .
git commit -m "feat(module): describe change"
git push origin feature/xxx
```

同步最新代码：

```bash
git checkout develop
git pull
git checkout feature/xxx
git merge develop
```

打版本 Tag：

```bash
git checkout main
git pull
git tag -a v1.0.0 -m "release v1.0.0"
git push origin v1.0.0
```

## 10. 总结

Git 规范的核心目标是：

- 保证主分支稳定。
- 保证提交记录清晰。
- 保证代码可追溯。
- 保证多人协作时减少冲突。
- 保证上线版本可回滚、可定位、可复盘。
