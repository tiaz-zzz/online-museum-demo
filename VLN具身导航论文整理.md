# VLN 具身导航与路径规划 · 论文整理

> 更新至 2026-09。面向本项目的调研：视觉语言导航（Vision-and-Language Navigation, VLN）与先进具身导航的最新论文，按「综述 → 任务基准 → 主线方法 → 环境表征与规划 → 世界模型 → 通用导航 → 户外无人机 → 评测诊断 → 落地建议」组织。所有条目附 arXiv / 项目页链接。

---

## 0. 快速阅读路线

如果时间有限，建议按这个顺序读：

1. **先读综述**建立坐标系：[VLN Today and Tomorrow (TMLR 2024)](https://github.com/zhangyuejoslin/VLN-Survey-with-Foundation-Models)
2. **理解任务与指标**：R2R → VLN-CE → ObjectNav（见 §2）
3. **看懂现代主流两条路**：
   - 端到端 VLA 模型：[NaVid](https://arxiv.org/abs/2402.15852) → [Uni-NaVid](https://arxiv.org/abs/2412.06224) → [NavFoM](https://arxiv.org/abs/2509.12129)
   - LLM 智能体 + 环境表征：[NavGPT](https://arxiv.org/abs/2305.16986) → [MapGPT](https://arxiv.org/abs/2401.07314) → [ConceptGraphs](https://arxiv.org/abs/2309.16650) / [NavRAG](https://arxiv.org/pdf/2502.11142)
4. **世界模型规划**（2025 起最热方向）：[NWM](https://arxiv.org/abs/2412.03572)、[NavMorph](https://arxiv.org/pdf/2506.23468)
5. **结合本项目**直接看 §11。

**核心指标速记**：NE（导航误差，米）、SR（成功率）、SPL（按最短路径归一化的成功率，越高说明路径越高效）、OSR（可观测成功率）。VLN 论文主要看 R2R / R2R-CE 上的 SR 和 SPL。

---

## 1. 综述（先读）

| 综述 | 发表 | 说明 | 链接 |
| --- | --- | --- | --- |
| VLN Today and Tomorrow: A Survey in the Era of Foundation Models | TMLR 2024 | 基础模型时代的 VLN 综述，四模块分类（世界模型/人模型/导航智能体/行为分析），仓库持续更新 | [GitHub](https://github.com/zhangyuejoslin/VLN-Survey-with-Foundation-Models) |
| VLN: A Survey of Tasks, Methods, and Results | ACL 2022 | 经典老综述，任务定义和指标最清楚 | [arXiv](https://arxiv.org/abs/2203.12667) |
| Vision-and-Language Navigation: A Comprehensive Survey | 2025.10 | 新综述，提出四象限任务分类法 | [链接](https://bcpublication.org) |
| A Comprehensive Survey and Systematic Real-World Study | IEEE TASE 2026 | 面向真机落地的 VLN 综述 | [arXiv](https://arxiv.org) |
| A Survey of Object Goal Navigation | TASE | 目标导航（ObjectNav）专题综述 | [PDF](https://orca.cardiff.ac.uk/id/eprint/167432/1/ObjectGoalNavigationSurveyTASE.pdf) |

---

## 2. 任务家族、模拟器与数据集

VLN 任务家族一览：

- **R2R**（Room-to-Room，CVPR 2018）：离散环境、指令→路径，一切的原点。[arXiv 1711.07280](https://arxiv.org/abs/1711.07280)
- **REVERIE**（CVPR 2020）：远程目标物体 + 指令，更像"找到并走到那个物体"。[arXiv 1906.07672](https://arxiv.org/abs/1906.07672)
- **RxR**（CVPR 2020）：多语言、更长的指令。
- **SOON**（AAAI 2021）：以物体属性描述为目标的场景物体导航。
- **VLN-CE**（ECCV 2020）：把离散导航图搬到**连续环境**（无导航图、需低层控制），更接近真实机器人。[arXiv 2004.02857](https://arxiv.org/abs/2004.02857)
- **ObjectNav**（目标物体导航）：给定"去找一把椅子"，Habitat HM3D-Semantics 是标准评测。
- **街景/城市级 VLN**：Touchdown（AAAI 2019）等，在真实街景中按语言行走。[arXiv 1811.12354](https://arxiv.org/abs/1811.12354)
- **无人机 Aerial VLN**：AerialVLN、CityNav（见 §8）。

| 数据集 / 模拟器 | 说明 | 链接 |
| --- | --- | --- |
| Matterport3D (MP3D) | 90 栋真实建筑扫描，R2R/REVERIE 底座 | [arXiv](https://arxiv.org/abs/1709.06158) |
| Habitat | Meta 的具身 AI 标准模拟器（含 2.0/3.0） | [arXiv](https://arxiv.org/abs/1904.01201) |
| HM3D | 1000 个真实场景 3D 扫描，ObjectNav/AVD 标准 | [arXiv](https://arxiv.org/abs/2109.08238) |
| IVLN | 迭代式/持久环境 VLN 评测（连续轮对话式导航） | [PDF](https://openaccess.thecvf.com) |

---

## 3. 经典专用模型（离散环境，2020–2023）

理解现代方法之前必知的基线，全部基于 MP3D 导航图。

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| PREVALENT | CVPR 2020 | 图文对齐预训练 + 带历史状态的导航 | [arXiv](https://arxiv.org/abs/2002.10638) |
| HAMT | NeurIPS 2021 | 全景图像 + 完整轨迹历史的端到端 Transformer | [arXiv](https://arxiv.org/abs/2110.13309) |
| DUET | CVPR 2022 | **局部动作 + 全局拓扑图**双图联合推理，拓扑图范式的开端 | [arXiv](https://arxiv.org/abs/2202.11742) |
| ETPNav | TPAMI 2024 | 抽象拓扑规划 + 连续环境执行，VLN-CE 长期 SOTA | [arXiv](https://arxiv.org/abs/2304.03047) |
| BEVBert | ICCV 2023 | BEV 多尺度空间记忆 + 全局图，R2R 未见环境 SOTA | [arXiv](https://arxiv.org/abs/2212.04385) |
| GridMM | ICCV 2023 | 全局记忆栅格（GO 记忆网格）融合多模态 | [arXiv](https://arxiv.org/abs/2307.12907) |
| ScaleVLN | ICCV 2023 | 用大规模数据（含 Internet 级全景）扩展 VLN 泛化 | [arXiv](https://arxiv.org/abs/2307.15644) |

---

## 4. LLM / VLM 时代的导航智能体

### 4.1 零样本（提示工程，无需训练）

把视觉观察转成文字喂给 LLM/VLM，用提示引导推理。

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| NavGPT | AAAI 2024 | 开山之作：GPT-4 零样本推理，观察→文字描述→逐步导航思维链 | [arXiv](https://arxiv.org/abs/2305.16986) |
| NavCoT | ICML 2024 | 参数化导航思维链：域内微调让 LLM 学会"边走边想" | [arXiv](https://arxiv.org/abs/2403.07376) |
| MapGPT | ACL 2024 | **地图引导提示 + 自适应路径规划**：把拓扑图写成文本提示，LLM 沿图规划 | [arXiv](https://arxiv.org/abs/2401.07314) |
| DiscussNav | ICRA 2024 | 多 LLM 角色讨论（下一步该去哪）改进零样本决策 | [GitHub](https://github.com/LYX0501/DiscussNav) |
| InstructNav | CoRL 2024 | 面向多种指令类型（动态物体/隐式意图等）的通用零样本导航，动态指令链 | [arXiv](https://arxiv.org/pdf/2406.04882) |
| SpatialNav | arXiv 2026.01 | 空间场景图 + 以智能体为中心的空间地图 + "罗盘式"视觉表示，零样本 VLN | [arXiv](https://arxiv.org/html/2601.06806v1) |
| HiMemVLN | arXiv 2026.03 | 分层记忆框架提升**开源 LLM** 零样本导航可靠性（隐私友好、可本地部署） | [arXiv](https://arxiv.org) |
| EvolveNav | arXiv 2025 | LLM 导航的自我改进/自演化推理范式 | [arXiv](https://arxiv.org) |
| NavRAG | ACL 2025 | **检索增强生成导航**：从全局到局部的场景层级树 RAG，生成/理解长程指令 | [arXiv](https://arxiv.org/pdf/2502.11142) |

### 4.2 端到端微调 / VLA 导航基础模型

用导航数据微调多模态大模型，或直接训出 Vision-Language-Action（VLA）导航模型——**2025–2026 的绝对主流**。

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| NaviLLM | CVPR 2024 | 基于 LLaVA 的导航专用 LMM，schema 化指令统一多任务 | [arXiv](https://arxiv.org/abs/2312.02010) |
| NavGPT-2 | ECCV 2024 | 显式导航推理 + 微调对齐，弥合 LLM 推理与专用模型差距 | [arXiv](https://arxiv.org/abs/2407.12366) |
| **NaVid** | RSS 2024 | **视频版 VLM 只靠 RGB 视频流输出低层动作**，不要地图/深度/里程计，跨模拟器-真机泛化强 | [arXiv](https://arxiv.org/abs/2402.15852) |
| **Uni-NaVid** | RSS 2025 | 第一个视频 VLA 统一 VLN / ObjectNav / 跟踪等任务，线上线下 token 压缩 | [arXiv](https://arxiv.org/abs/2412.06224) |
| **NaVILA** | RSS 2025 | 腿式机器人 VLA：VLM 输出语言级动作 + RL 运动控制，真机验证 | [arXiv](https://arxiv.org/abs/2412.04453) |
| **NavFoM** | arXiv 2025.09 | 导航基础模型：800 万样本、**跨本体**（四足/无人机/轮式/车辆）跨任务 | [arXiv](https://arxiv.org/abs/2509.12129) |
| Uni-LaViRA | arXiv 2026.05 | 语言-视觉-机器人动作翻译，真机流式动作 | [arXiv](https://arxiv.org) |
| BEVInstructor | ECCV 2024 | BEV（鸟瞰图）教师信号蒸馏给单目 VLN 学生 | [arXiv](https://arxiv.org/pdf/2407.15087) |
| LangNav | NAACL 2024 Findings | 语言作为感知与预测之间的语义压缩提示 | [arXiv](https://arxiv.org) |

---

## 5. 环境表征与路径规划（与本项目最相关）

导航智能体怎么"记住"环境和"决定走哪条路"。

### 5.1 拓扑图 / BEV 栅格表示

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| Dynam3D | NeurIPS 2025 | 动态分层 3D token 喂给 VLM 做 VLN，可更新裁剪的 3D 记忆 | [NeurIPS](https://neurips.cc) |
| HNR-VLN | CVPR 2024 | NeRF 前瞻预测：虚拟"偷看"前方再决策 | [arXiv](https://arxiv.org/pdf/2404.01943) |
| VLN-VER | CVPR 2024 | 体积化环境表示（3D 体素记忆）对齐语言与空间 | [arXiv](https://arxiv.org/pdf/2403.14158) |
| Object–Path Graphs | arXiv 2026.09 | 新的拓扑表征：物体-路径图用于目标驱动 VLN | [arXiv](https://arxiv.org/html/2609.24189v1) |
| Bridging the 2D–3D Gap | CVPR 2026 | 层级语义场景图弥合 2D 观察与 3D 空间，未见环境 VLN | [arXiv](https://arxiv.org/html/2606.00095v1) |
| Optimal Transport + 图推理 | NeurIPS 2025 | VLN-CE 上最优传输 + 图驱动推理做子图选择 | [NeurIPS](https://neurips.cc/virtual/2025/poster/115108) |

### 5.2 开放词汇 3D 场景图（语言可查询的空间记忆）

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| **ConceptGraphs** | ICRA 2024 | 奠基之作：2D 基础模型 + 3D 几何融合成**开放词汇 3D 场景图**，LLM 直接查询规划 | [arXiv](https://arxiv.org/abs/2309.16650) |
| HOV-SG | RSS 2024 | 楼层→房间→物体三级开放词汇场景图，机器人长程语言导航 | [项目页](https://hovsg.github.io/) |
| DovSG | RA-L 2025 | **动态**开放词汇场景图 + 语言任务规划，环境变化可更新 | [项目页](https://bjhyzj.github.io/dovsg-web/) |
| Open3DSG | CVPR 2024 | 点云直接预测开放词汇关系场景图，零样本规划 | [GitHub](https://github.com/boschresearch/Open3DSG) |
| MSGNav | arXiv 2025.11 | 多模态（非纯文本）3D 场景图零样本导航，保留视觉信息 | [arXiv](https://arxiv.org/abs/2511.10376) |
| VL-KnG | arXiv 2025.10 | 时空知识图：持久场景表示 + 可查询空间推理 | [arXiv](https://arxiv.org/html/2510.01483v1) |
| RoboHop | IROS 2024 | 基于语义图像段的拓扑图，开放词汇可导航 | [项目页](https://oravus.github.io/RoboHop) |
| osmAG-LLM | arXiv 2025.07 | 开放词汇占据栅格 + LLM，零样本 ObjectNav 系统 | [arXiv](https://arxiv.org/html/2507.12753v1) |
| Inference-Time 3D Scene Graph Updates | arXiv 2025.06 | 推理时在线更新场景图（基于 ConceptGraphs） | [arXiv](https://arxiv.org) |

### 5.3 目标探索 / Frontier 规划（ObjectNav 主线）

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| Frontier-Based Exploration | 1997 | 一切 frontier 探索的源头（经典机器人学） | — |
| ESC | ICML 2023 | LLM 常识作为"软约束"修正 frontier 探索（"床一般在卧室"） | [arXiv](https://arxiv.org/abs/2301.13166) |
| L3MVN | IROS 2023 | LLM 给 frontier 打分选目标 | [arXiv](https://arxiv.org/abs/2304.05501) |
| **VLFM** | ICRA 2024 | 视觉-语言 frontier 图（BLIP-2 相似度值图 + frontier 规划），已用于 Spot 真机 | [arXiv](https://arxiv.org/abs/2312.03275) |
| FOM-Nav | 2025 | Frontier-Object 联合地图，高效找物体 | [PDF](https://hal.science/hal-05392088v1/file/FOMNav.pdf) |
| **GOAT** | RSS 2023 | "GO to Any Thing"：多模态目标的终身/在线导航系统（全景记忆 + 场景图 + 探索） | [arXiv](https://arxiv.org/abs/2311.06430) |

---

## 6. 世界模型：靠"想象"来规划

2025 年以来最热的方向——把世界模型（视频生成）当导航的"脑内模拟器"。

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| Pathdreamer | ICCV 2021 | 先驱：360° 全景世界模型，给定视角预测未见区域 | [arXiv](https://arxiv.org/abs/2105.08756) |
| **NWM (Navigation World Models)** | CVPR 2025 | Meta：CDiT 条件扩散 Transformer，4000 小时导航视频训练；**"规划即模拟"**——在想象中 rollout 候选轨迹选最优，推理时可加大算力规划更长路径 | [arXiv](https://arxiv.org/abs/2412.03572) / [代码](https://github.com/facebookresearch/nwm) |
| **NavMorph** | ICCV 2025 | 自演化世界模型用于 VLN-CE：学环境动态先验辅助规划 | [arXiv](https://arxiv.org/pdf/2506.23468) |
| PanoGen | NeurIPS 2023 | 文本引导全景生成做 VLN 数据增强（环境多样性） | [arXiv](https://arxiv.org/abs/2305.19195) |
| Do Visual Imaginations Improve VLN? | CVPR 2025 | 实证研究：想象模块到底帮不帮忙（诊断类） | [arXiv](https://arxiv.org/pdf/2503.16394) |
| RAE-NWM | arXiv 2026.03 | NWM 迁到稠密视觉表征空间做稠密探索 | [arXiv](https://arxiv.org/abs/2603.09241) |

---

## 7. 通用视觉导航基础模型（真机向）

不依赖语言指令、以"到达目标图像/点"为条件的跨本体导航策略（Berkeley Shah 系）。

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| GNM | ICRA 2023 | 跨本体（遥控车/狗/轮机）目标条件导航策略，第一个"通用导航模型" | [代码](https://github.com/robodhruv/visualnav-transformer) |
| ViNT | CoRL 2023 | **视觉导航基础模型**：Transformer + 目标图采样预训练，可适配新机器人 | [arXiv](https://arxiv.org/abs/2306.14835) |
| NoMaD | ICRA 2024 | 目标掩码扩散策略：一个模型统一"探索"与"目标导航" | [arXiv](https://arxiv.org/abs/2310.07896) |

> 这一支与 VLN 的关系：ViNT/NoMaD 负责"怎么走"（低层技能），LLM/VLM 负责"去哪"（语言接地）。近期很多系统是这种分层组合（NaVILA、GOAT 都是这个思路）。

---

## 8. 户外与无人机 VLN

| 论文/基准 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| AerialVLN / AirVLN | ICCV 2023 | 首个大规模无人机 VLN 模拟基准（25k 指令） | [GitHub](https://github.com/AirVLN/AirVLN) |
| CityNav | ICCV 2024 | 首个**真实城市级**无人机 VLN 数据集，32k 人类轨迹 + GPS + 地标 | [arXiv](https://arxiv.org/abs/2306.06068) |
| OpenFly | arXiv 2025.02 | 多引擎工具链 + 10 万轨迹航拍 VLN 基准 | [arXiv](https://arxiv.org/abs/2502.18041) |
| FlightGPT | arXiv 2025.05 | VLM + SFT/GRPO 强化学习的无人机 VLN，CityNav 标准基线 | [arXiv](https://arxiv.org/abs/2505.12835) |
| Towards Realistic UAV VLN | ICLR 2025 | OpenUAV 平台 + 真实物理约束 + CCA 方法 | [OpenReview](https://openreview.net/forum?id=rUvCIvI4eB) |
| LookasideVLN | CVPR 2026 | 方向感知的航拍 VLN（注意方向信息的重要性） | [PDF](https://openaccess.thecvf.com/content/CVPR2026/papers/Ning_LookasideVLN_Direction-Aware_Aerial_Vision-and-Language_Navigation_CVPR_2026_paper.pdf) |
| HUGE-Bench | arXiv 2026 | 高层无人机 VLA 基准 | [arXiv](https://arxiv.org) |
| ViSA | arXiv 2026.03 | 视觉-空间推理增强，CityNav SR 提升 70.3% | [arXiv](https://arxiv.org) |

---

## 9. 新训练范式与评测诊断

| 论文 | 发表 | 核心思想 | 链接 |
| --- | --- | --- | --- |
| HTNav | CVPR 2026 | **IL+RL 混合范式**：模仿学习打底 + 强化学习纠正，协作导航 | [CVPR](https://cvpr.thecvf.com) |
| GSA-VLN (General Scene Adaptation) | ICLR 2025 | 超越"一次性执行指令"：泛化到新场景的持续适应 | [ICLR](https://proceedings.iclr.cc/paper_files/paper/2025/hash/aebf6284fe85a8f44b4785d41bc8249a-Abstract-Conference.html) |
| Active Test-time VLN | NeurIPS 2025 | 测试时主动适应：智能体自己评估导航结果并在线学习 | [NeurIPS](https://neurips.cc/virtual/2025/poster/119128) |
| CVLN (Continual VLN) | 2025 | 持续学习设定下的 VLN 训练/评测 | [PDF](https://bmva-archive.org.uk) |
| VLN-MME | ACL 2026 | 诊断型基准：系统评测 MLLM 作为导航智能体的能力短板 | [ACL](https://aclanthology.org/2026.acl-long.1300.pdf) |
| NavNuances | EMNLP 2024 Findings | 细粒度失败模式诊断基准 | [arXiv](https://arxiv.org/pdf/2409.17313) |
| vln-behave | CVPR 2023 | VLN 行为学分析（路径偏离/停顿等行为模式） | [GitHub](https://github.com/Yoark/vln-behave) |
| Diagnose VLN | NAACL 2022 | 早期经典诊断工作 | [GitHub](https://github.com/VegB/Diagnose_VLN) |
| NavHint | EACL 2024 | 借助人类提示（hints）辅助导航决策 | [arXiv](https://arxiv.org/pdf/2402.02559) |
| LANA | CVPR 2023 | 语言标注模型：给轨迹生成指令（数据增广/ Speaker） | [arXiv](https://arxiv.org/abs/2303.08409) |
| VLN-Trans | ACL 2023 | 机器翻译扩充多语言指令数据 | [arXiv](https://arxiv.org/pdf/2302.09230) |

---

## 10. 2024 → 2026 趋势总结

1. **输入从单帧全景 → 视频流**：NaVid/Uni-NaVid 证明只用 RGB 视频 + 时序建模就能跨模拟器和真机泛化，地图/深度/里程计不再是必需品。
2. **智能体形态从"专用小模型" → "VLA 基础模型"**：NavFoM（800 万样本、跨四足/无人机/轮式/车辆）代表收敛方向——一个模型覆盖导航全家桶。
3. **规划从"学出来的打分器" → "世界模型内模拟"**：NWM 开创"规划即想象"，在脑内 rollout 候选路径再选优；NavMorph 把世界模型放进 VLN-CE。
4. **环境记忆从"隐式向量" → "显式结构"**：开放词汇 3D 场景图（ConceptGraphs → HOV-SG → DovSG → MSGNav）让语言可直接查询空间记忆，天然支持零样本和可解释规划。
5. **零样本路线成熟**：NavGPT → MapGPT → InstructNav → SpatialNav，把地图/场景图编码进提示词是标准做法；NavRAG 把 RAG 引入导航推理。
6. **评测从 R2R 刷榜 → 泛化/诊断/真机**：VLN-MME（诊断 MLLM）、IVLN/CVLN（持久与持续学习）、TASE 2026 真机落地综述、CityNav/OpenFly（户外真机级）。
7. **户外/无人机 VLN 爆发**：AerialVLN → CityNav → OpenFly → FlightGPT/LookasideVLN，2025–2026 最活跃的增长点。

---

## 11. 结合本项目（3DGS 在线博物馆）的落地方案建议

本项目是 three.js + Spark 的 3DGS 博物馆步行游览 demo（WASD 行走、展品热点、门洞切换展厅、导览巡游）。要做"VLN 式具身导航"，即：**用户（或虚拟讲解员）用自然语言指定目的地，智能体在博物馆场景里规划并执行路径**。对照文献，推荐分层方案：

### 架构对位（文献概念 → 本项目实现）

| 文献概念 | 论文出处 | 本项目落地 |
| --- | --- | --- |
| 导航图 / 拓扑地图 | DUET / ETPNav | 在每个展厅手工（或半自动）标定**路点图**：门洞、展厅中心、展品驻留点为节点，走廊为边。3DGS 场景没有 mesh 碰撞，路点图是最可靠的可行走表征 |
| 地图写进提示词 | MapGPT (ACL 2024) | 把路点图序列化成文本（"大厅→东侧门洞→青铜器厅：司母戊鼎…"）作为 LLM 系统提示，让 LLM 做全局路径规划 |
| 场景图 / 语义记忆 | ConceptGraphs、HOV-SG | 展品清单（名称、位置、展厅、讲解文本）即天然的场景图；后续可自动从 splat + VLM 抽取展品位置 |
| 检索增强导航 | NavRAG (ACL 2025) | 用户问"哪有宋代的瓷器"→ 先 RAG 检索展品库 → 再规划路点路径 → 输出讲解 + 带路 |
| 全局规划 + 局部执行 | GOAT / NaVILA 分层范式 | LLM 在路点图上给全局路径（A*/Dijkstra 校验），局部用样条平滑 + 门洞触发传送（复用现有 portal 机制） |
| 低层路径平滑 | 经典运动规划 | three.js 中 Catmull-Rom 曲线插值路点 + 面向约束（yaw 渐变），即"虚拟讲解员巡游"的可视化版 |
| 零样本 VLM 感知（可选） | NaVid、VLFM | 若想让智能体"看见"splat 画面做视觉接地（如"走到那辆 truck 旁边"），可截帧给 VLM；但纯文本路点图已够用且成本低一个量级 |

### 建议的里程碑

1. **M-A（零训练，1–2 周）**：路点图 + MapGPT 式提示工程 + A* 全局规划 + 样条局部平滑。指标用 NE / 路径长度 / 到达率即可量化。
2. **M-B**：展品 RAG（NavRAG 式）接入讲解系统，支持开放词汇目的地（"看点青铜器"→ 最近/最相关展品节点）。
3. **M-C（进阶）**：接入 VLM 截帧做视觉接地，或用 LLM 在多条候选路径中按"观展体验"（拥挤度、顺路讲解）重排——对应 NWM 的"多候选模拟择优"思想。

### 精读优先级（为本项目定制）

1. MapGPT（拓扑图提示规划，直接可抄）→ 2. NavRAG（展品检索增强）→ 3. GOAT（分层系统设计参考）→ 4. NaVid（若做视觉接地）→ 5. NWM（多候选规划思想）。

---

## 附：论文清单合并速查（按年份）

- 2020：PREVALENT、REVERIE、VLN-CE
- 2021：HAMT、Pathdreamer、HM3D、SOON
- 2022：DUET、Touchdown、GNM
- 2023：BEVBert、GridMM、ScaleVLN、PanoGen、DiscussNav、NavGPT、NaviLLM、ESC、L3MVN、GOAT、ViNT、IVLN、vln-behave、RoboHop
- 2024：ETPNav、MapGPT、NavCoT、NavGPT-2、NaVid、ConceptGraphs、VLFM、Open3DSG、CityNav、HNR-VLN、VLN-VER、BEVInstructor、NavHint、NavNuances、AerialVLN、NoMaD、AirVLN
- 2025：Uni-NaVid、NaVILA、NavFoM、NWM、NavMorph、FlightGPT、OpenFly、NavRAG、GSA-VLN、MSGNav、VL-KnG、osmAG-LLM、FOM-Nav、DovSG、Dynam3D、CVLN、VLN-MME
- 2026：Uni-LaViRA、SpatialNav、HiMemVLN、Bridging the 2D–3D Gap、LookasideVLN、HTNav、HUGE-Bench、ViSA、RAE-NWM、Object–Path Graphs

> 维护建议：[Awesome VLN](https://github.com/waynechu1021/Awesome_Visual_Language_Navigation) 与 [VLN-Survey-with-Foundation-Models](https://github.com/zhangyuejoslin/VLN-Survey-with-Foundation-Models) 两个仓库持续追踪即可，无需自己扫 arXiv。
