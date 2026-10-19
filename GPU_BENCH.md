# 真实 GPU 帧率基准（headless Chrome，硬件加速）

> 由 `tools/gpu-bench.mjs` 生成。若 renderer 为 SwiftShader 说明本机无可用 GPU 加速。

| 画质 | 渲染器 | FPS | ms/帧 | draw calls | 三角面 |
| --- | --- | --- | --- | --- | --- |
| high | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 148.5 | 6.74 | 1256 | 3.58 M |
| medium | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 129.3 | 7.73 | 1173 | 3.05 M |
| low | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 103 | 9.7 | 1252 | 3.58 M |
| high@1.5x | ANGLE (NVIDIA, NVIDIA GeForce RTX 5060 Ti (0x00002D04) Direct3D11 vs_5_0 ps_5_0, D3D11) | 103 | 9.71 | 1176 | 3.05 M |
