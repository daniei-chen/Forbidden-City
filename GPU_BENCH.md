# 真实 GPU 帧率基准（headless Chrome，硬件加速）

> 由 `tools/gpu-bench.mjs` 生成。若 renderer 为 SwiftShader 说明本机无可用 GPU 加速。

| 画质 | 渲染器 | FPS | ms/帧 | draw calls | 三角面 |
| --- | --- | --- | --- | --- | --- |
| high | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 220 | 4.54 | 1255 | 3.59 M |
| medium | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 112.7 | 8.87 | 1172 | 3.06 M |
| low | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 117.1 | 8.54 | 1251 | 3.59 M |
| high@1.5x | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 114 | 8.77 | 1175 | 3.06 M |
