# 可复用评审组件

组装脚本自动内联 `review-components.js/.css`，业务脚本在 DOMContentLoaded 后使用 `window.ReviewComponents`。组件使用textContent输出业务文本。

- `features(host,{title,groups:[{title,owner,change:'新增|改动|复用',items:[文字],rule,target:页面ID}],foundation})`：真实功能结构卡片及层级。不能仅用同名标题和正文段落代替。
- `flow(host,{width,height,nodes:[{id,label,x,y,width,height,type:'decision'}],edges:[{from,to,label,path?,labelX?,labelY?}]})`：带方向与判断节点的内联SVG。布局由PRD图决定；多行文字、复杂图或时序图可直接使用其他内联SVG，保留全部语义。组件不会自动推导业务分支。
- `boards(host,groups,renderScene)`：每组 `{title,description,scenes,returnLabel?}`；每场景 `{id,title,width,height,trigger,note,...业务固定状态}`。`renderScene(scene)`返回共用业务渲染器构造的HTMLElement；禁止重新手写一套静态界面。组件负责分组、箭头与触发说明、原尺寸/概览切换、静态隔离和ID/name去重。多分支不能硬排成线性路径：拆分场景组或自定义布局表达真实连线。
- `description(host,{'功能说明':文字,'逻辑说明':文字,'交互说明':文字,'备注':文字})`：当前业务页专属说明。商家端、内部平台、详情共用视口时，在每次业务页变化后重新提供对应说明。

调用时序：业务UI先渲染 → 编辑器初始化 → 固定场景组件渲染。业务重新渲染后派发 `document.dispatchEvent(new Event('proto:rendered'))`。编辑器也监听新增节点恢复绑定；稳定的显式编辑键仍是跨页/重绘保留修改的依据，不能依赖自动路径覆盖不同语义的列表行。

业务导出必须先读配置快照，再初始化数据；不能无条件重新生成覆盖已编辑的静态或业务DOM。画板导出可以保留已生成内容，并跳过重复生成；通用重绘组件本身不保证业务导出正确。

在真实查询、账户切换、明细打开等代表性按钮上标记唯一 `data-review-test-action="query|account|detail..."`。按实际操作顺序安排；验收脚本会点击并检查编辑绑定仍存在。不能用专门的空操作按钮凑验收。随后还需实际修改重绘后文案、刷新、导出重开验证内容保真。
