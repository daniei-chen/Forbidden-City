# 真实 GPU 帧率基准（headless Chrome，硬件加速）

> 由 `tools/gpu-bench.mjs` 生成。若 renderer 为 SwiftShader 说明本机无可用 GPU 加速。

| 画质 | 渲染器 | FPS | ms/帧 | draw calls | 三角面 |
| --- | --- | --- | --- | --- | --- |
| high | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 169.6 | 5.9 | 1394 | 3.59 M |
| medium | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 224.6 | 4.45 | 1311 | 3.06 M |
| low | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 205.8 | 4.86 | 1390 | 3.59 M |
| high@1.5x | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 181.5 | 5.51 | 1314 | 3.06 M |
