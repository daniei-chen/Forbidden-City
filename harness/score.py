#!/usr/bin/env python3
"""感知对比评分：SSIM / MAE / 亮度差 / 直方图距离（仅依赖 numpy + Pillow）。

用法：
  python harness/score.py --current harness/out/current --baseline harness/baselines --out harness/out/scores.json
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

TARGET_W, TARGET_H = 640, 360


def load_image(path):
    im = Image.open(path).convert('RGB')
    if im.size != (TARGET_W, TARGET_H):
        im = im.resize((TARGET_W, TARGET_H), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def gray(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def block_ssim(a, b, win=8):
    """按 win×win 分块计算 SSIM（要求尺寸可整除）。"""
    h, w = a.shape
    bh, bw = h // win, w // win
    a = a[: bh * win, : bw * win].reshape(bh, win, bw, win).transpose(0, 2, 1, 3).reshape(bh, bw, win * win)
    b = b[: bh * win, : bw * win].reshape(bh, win, bw, win).transpose(0, 2, 1, 3).reshape(bh, bw, win * win)
    mu1 = a.mean(axis=-1)
    mu2 = b.mean(axis=-1)
    v1 = a.var(axis=-1)
    v2 = b.var(axis=-1)
    cov = ((a - mu1[..., None]) * (b - mu2[..., None])).mean(axis=-1)
    c1 = 0.01 ** 2
    c2 = 0.03 ** 2
    num = (2 * mu1 * mu2 + c1) * (2 * cov + c2)
    den = (mu1 ** 2 + mu2 ** 2 + c1) * (v1 + v2 + c2)
    return float(np.mean(num / np.maximum(den, 1e-8)))


def color_hist(rgb, bins=32):
    out = []
    for c in range(3):
        h, _ = np.histogram(rgb[..., c], bins=bins, range=(0.0, 1.0))
        out.append(h.astype(np.float32) / max(1, h.sum()))
    return np.concatenate(out)


def compare(cur_path, base_path):
    cur = load_image(cur_path)
    base = load_image(base_path)
    g1, g2 = gray(cur), gray(base)
    ssim = block_ssim(g2, g1)
    mae = float(np.mean(np.abs(cur - base)) * 100.0)
    bright = float((g1.mean() - g2.mean()) * 100.0)
    hdist = float(np.abs(color_hist(cur) - color_hist(base)).sum())
    return {
        'ssim': round(ssim, 5),
        'mae': round(mae, 3),
        'bright': round(bright, 3),
        'hist': round(hdist, 4),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--current', required=True)
    ap.add_argument('--baseline', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    pairs = {}
    files = sorted(f for f in os.listdir(args.current) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')))
    for f in files:
        base_path = os.path.join(args.baseline, f)
        cur_path = os.path.join(args.current, f)
        if not os.path.exists(base_path):
            continue
        key = f[:-4]
        try:
            pairs[key] = compare(cur_path, base_path)
        except Exception as exc:  # noqa: BLE001
            pairs[key] = {'error': str(exc)[:200]}

    ok = [p for p in pairs.values() if 'ssim' in p]
    summary = {}
    if ok:
        summary = {
            'count': len(ok),
            'ssimMean': round(float(np.mean([p['ssim'] for p in ok])), 5),
            'minSsim': round(float(np.min([p['ssim'] for p in ok])), 5),
            'maeMean': round(float(np.mean([p['mae'] for p in ok])), 3),
            'brightMean': round(float(np.mean([p['bright'] for p in ok])), 3),
            'histMean': round(float(np.mean([p['hist'] for p in ok])), 4),
        }

    result = {'pairs': pairs, 'summary': summary}
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as fp:
        json.dump(result, fp, ensure_ascii=False, indent=2)
    print('[score] ' + json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
