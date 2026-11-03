"""Renders the Mountain of Knowledge artwork and the matching silhouettes.

Outputs (all deterministic, seeded):
  public/images/mountain/mountain.webp   ray-marched terrain with transparency
  public/images/mountain/ridges.webp     full-bleed distant ridges
  public/images/birthday/cake-night.webp cake in moonlight (same framing)
  public/images/birthday/cake-lit.webp   cake in candlelight
  src/data/silhouettes.ts                point-matched outlines for the morph

Run from the repo root:  python tools/art/render.py
Everything lives in a 1000 x 800 "stage" coordinate space, shared with the SVG.
"""
from __future__ import annotations

import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCALE = 1.6  # pixels per stage unit
W, H = int(1000 * SCALE), int(800 * SCALE)
SIL_POINTS = 180  # points per half of each outline


def hex_rgb(h: str) -> np.ndarray:
    return np.array([int(h[i : i + 2], 16) for i in (1, 3, 5)], dtype=np.float32) / 255


def srgb(lin: np.ndarray) -> np.ndarray:
    return np.clip(lin, 0, 1) ** (1 / 2.2)


def lin(c: np.ndarray) -> np.ndarray:
    return c**2.2


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def fractal(n: int, rng, base: int, octaves: int, gain=0.5, ridged=False):
    """Fractal noise on an n x n grid, in 0..1."""
    out = np.zeros((n, n), np.float32)
    amp, tot, cells = 1.0, 0.0, base
    for _ in range(octaves):
        g = rng.random((cells + 3, cells + 3), dtype=np.float32)
        layer = ndi.zoom(g, n / cells, order=3)[:n, :n]
        if ridged:
            layer = 1 - np.abs(layer * 2 - 1)
            layer = layer * layer
        out += amp * layer
        tot += amp
        amp *= gain
        cells *= 2
    return out / tot


# ---------------------------------------------------------------- terrain
NEIGHBOURS = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
              (-1, -1, 1.414), (-1, 1, 1.414), (1, -1, 1.414), (1, 1, 1.414)]


def stream_erosion(h, cell, uplift, iters=170, k=7.5e-5, u=6e-4):
    """Carves drainage into a height field with the stream-power law.

    Water gathers downhill, and rock wears away in proportion to the flow and
    the slope. Ridges and valleys then connect the way real ones do, instead of
    being independent spikes of noise.
    """
    flow = np.ones_like(h)
    for _ in range(iters):
        drops = []
        for dz, dx, dist in NEIGHBOURS:
            drops.append(np.maximum(h - np.roll(h, (dz, dx), (0, 1)), 0) / dist)
        total = sum(drops) + 1e-7
        fractions = [d / total for d in drops]
        for _ in range(6):  # flow is kept between iterations, so it converges as it erodes
            next_flow = np.ones_like(h)
            for (dz, dx, _), frac in zip(NEIGHBOURS, fractions):
                next_flow += np.roll(flow * frac, (-dz, -dx), (0, 1))
            flow = next_flow
        slope = np.maximum.reduce(drops) / cell
        # a blurred flow gives valleys width, so they never reduce to knife cuts
        h = h + u * uplift - k * ndi.gaussian_filter(np.sqrt(flow), 1.3) * slope
        h = h + (ndi.uniform_filter(h, 3) - h) * 0.10  # slow hillslope creep
        # rock past its angle of repose slumps, which rounds off needles
        relaxed = ndi.uniform_filter(h, 3)
        h = np.where(slope > 1.75, h * 0.8 + relaxed * 0.2, h)
        h = np.maximum(h, 0)
    return h, flow


def build_terrain(n=1800, coarse=640):
    rng = np.random.default_rng(1729)
    zs, xs = np.mgrid[0:coarse, 0:coarse].astype(np.float32) / (coarse - 1)
    x = xs * 2.4 - 1.2  # world x
    z = zs * 2.4 - 1.2  # world z, centred on the summit
    warp_a = fractal(coarse, rng, 3, 3) - 0.5
    warp_b = fractal(coarse, rng, 3, 3) - 0.5
    wx, wz = x + warp_a * 0.30, z + warp_b * 0.30

    def peak(px, pz, height, width, power):
        dist = np.hypot(wx - px, (wz - pz) * 0.9)
        return height * np.clip(1 - dist / width, 0, 1) ** power

    def spine(x0, z0, h0, x1, z1, h1, width, power=1.2):
        """A ridge line between two points, falling away on both sides."""
        dx, dz = x1 - x0, z1 - z0
        t = np.clip(((wx - x0) * dx + (wz - z0) * dz) / (dx * dx + dz * dz), 0, 1)
        dist = np.hypot(wx - (x0 + dx * t), wz - (z0 + dz * t))
        return (h0 + (h1 - h0) * t) * np.clip(1 - dist / width, 0, 1) ** power

    # a massif, not a spike: the summit stands on ridges that link it to its shoulders
    west, east, back = (-0.46, -0.04, 0.60), (0.50, 0.08, 0.54), (-0.08, 0.52, 0.58)
    forms = [
        peak(0.0, 0.0, 1.00, 0.86, 1.15),
        spine(0, 0, 0.96, *west, 0.66),
        spine(0, 0, 0.96, *east, 0.66),
        spine(0, 0, 0.96, *back, 0.62),
        spine(0, 0, 0.92, 0.07, -0.60, 0.34, 0.50),  # the buttress facing the viewer
        spine(*west, -0.86, -0.22, 0.20, 0.52),
        spine(*east, 0.88, -0.12, 0.18, 0.52),
    ]
    base = ndi.gaussian_filter(np.maximum.reduce(forms), 5)
    body = np.clip(base * 3, 0, 1)
    # enough relief for many small catchments, rather than a few long radial lines
    base = base + (fractal(coarse, rng, 9, 5, 0.55) - 0.47) * 0.34 * body

    print("eroding...")
    h, flow = stream_erosion(base, 2.4 / (coarse - 1), np.clip(base, 0, 1))

    h = ndi.gaussian_filter(ndi.zoom(h, n / coarse, order=3)[:n, :n], 1.2)
    flow = ndi.zoom(np.log1p(flow), n / coarse, order=1)[:n, :n]
    mask = np.clip(h * 3, 0, 1)
    ridged = fractal(n, rng, 7, 6, 0.5, ridged=True)
    fine = fractal(n, rng, 40, 4, 0.55, ridged=True)
    # surface detail stays small next to the eroded forms that carry the shape
    h = h + (ridged - 0.32) * 0.075 * mask + (fine - 0.32) * 0.016 * mask
    h = np.maximum(h, 0)
    h = h / h.max() * 1.36
    return h.astype(np.float32), ridged, fine, flow.astype(np.float32)


def cast_shadows(h, light, cell):
    """Height-field shadow sweep along the horizontal light direction."""
    n = h.shape[0]
    lx, ly, lz = light
    horiz = np.hypot(lx, lz)
    dx, dz, slope = lx / horiz / cell, lz / horiz / cell, ly / horiz * cell
    zz, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    shadow = np.ones_like(h)
    step, dist = 1.0, 1.0
    while dist < n * 0.8:
        px = xx + dx * dist
        pz = zz + dz * dist
        s = ndi.map_coordinates(h, [pz, px], order=1, mode="nearest")
        over = s - (h + slope * dist)
        shadow = np.minimum(shadow, 1 - smooth(0.0, 0.006 + dist * cell * 0.012, over))
        step *= 1.1
        dist += max(1.0, step)
    return shadow


def render_mountain():
    print("terrain...")
    h, ridged, fine, flow = build_terrain()
    n = h.shape[0]
    cell = 2.4 / (n - 1)

    def bilinear(arr, wx, wz):
        u = (wx + 1.2) / 2.4 * (n - 1)
        v = (wz + 1.2) / 2.4 * (n - 1)
        return ndi.map_coordinates(arr, [v, u], order=1, mode="nearest")

    # camera
    eye_y, eye_z, focal = 0.20, -2.15, 1320.0
    # aim the camera so the summit lands on the same stage point as before
    pz, px = np.unravel_index(int(np.argmax(h)), h.shape)
    summit_x, summit_z = px * cell - 1.2, pz * cell - 1.2
    summit_d = summit_z - eye_z
    cx = 500 * SCALE - summit_x / summit_d * focal
    cy = 122 * SCALE + (float(h.max()) - eye_y) / summit_d * focal
    near, far = -1.15, 1.15

    print("projecting...")
    slices = 2600
    zbuf = np.full((H, W), np.nan, np.float32)
    xcol = (np.arange(W, dtype=np.float32) - cx) / focal
    ybuf = np.full(W, H + 2.0, np.float32)
    prev_z = np.full(W, near, np.float32)
    zvals = near + (far - near) * np.linspace(0, 1, slices)
    slice_step = (far - near) / (slices - 1)
    rows = np.arange(H, dtype=np.float32)
    for wz in zvals:
        d = wz - eye_z
        wx = xcol * d
        hh = bilinear(h, wx, np.full(W, wz, np.float32))
        ytop = cy - (hh - eye_y) / d * focal
        vis = ytop < ybuf
        if vis.any():
            cols = np.nonzero(vis)[0]
            for c in cols:
                y0 = max(int(np.ceil(ytop[c])), 0)
                y1 = min(int(np.ceil(ybuf[c])), H)
                if y1 > y0:
                    if ybuf[c] > H or wz - prev_z[c] <= 3 * slice_step:
                        # interpolate depth across the span so nothing streaks
                        t = (rows[y0:y1] - ytop[c]) / max(ybuf[c] - ytop[c], 1e-3)
                        zbuf[y0:y1, c] = wz + (prev_z[c] - wz) * t
                    else:
                        # far rock rising from behind a nearer ridge: interpolating
                        # here would sample the hidden valley and draw a dark seam
                        zbuf[y0:y1, c] = wz
                ybuf[c] = ytop[c]
                prev_z[c] = wz

    covered = np.isfinite(zbuf)
    zb = np.where(covered, zbuf, far)
    dd = zb - eye_z
    xpix = (np.arange(W, dtype=np.float32) - cx) / focal
    wxb = xpix[None, :] * dd

    print("shading...")
    # surface data on the grid
    gz, gx = np.gradient(h, cell)
    nlen = np.sqrt(gx * gx + gz * gz + 1)
    nx, ny, nz = -gx / nlen, 1 / nlen, -gz / nlen

    moon = np.array([-0.84, 0.40, -0.30], np.float32)
    moon /= np.linalg.norm(moon)
    rim = np.array([0.80, 0.25, -0.35], np.float32)
    rim /= np.linalg.norm(rim)

    shadow = cast_shadows(h, moon, cell)
    shadow = ndi.gaussian_filter(shadow, 0.8)

    ao = np.clip(0.55 + (h - ndi.gaussian_filter(h, 22)) * 7, 0, 1)
    ao = ao * (1 - smooth(4.0, 8.0, flow) * 0.35)  # valleys sit in shadow
    slope = 1 - ny
    snow_noise = fractal(n, np.random.default_rng(5), 24, 5)
    # snow holds on gentle ground and collects in gullies; steep faces stay bare rock
    gully = np.clip((ndi.gaussian_filter(h, 7) - h) * 26, 0, 0.32)
    snow = smooth(0.60, 0.86, h + (snow_noise - 0.5) * 0.26 + gully - slope * 0.30)
    snow *= 1 - smooth(0.50, 0.68, slope - gully)

    curv = h - ndi.gaussian_filter(h, 2.2)
    veins = smooth(0.0055, 0.016, curv) * smooth(0.48, 0.66, fractal(n, np.random.default_rng(9), 9, 3))

    rng = np.random.default_rng(31)
    # rock beds tilt as one body across the mountain instead of following its contours
    zg, xg = np.mgrid[0:n, 0:n].astype(np.float32) * cell
    strata = 0.5 + 0.5 * np.sin((h * 0.9 + xg * 0.36 + zg * 0.12) * 78 + fine * 3)

    lit = np.clip(nx * moon[0] + ny * moon[1] + nz * moon[2], 0, 1) * shadow
    fill = np.clip(nx * rim[0] + ny * rim[1] + nz * rim[2], 0, 1)
    sky = 0.5 + 0.5 * ny

    rock_a, rock_b = lin(hex_rgb("#1A2638")), lin(hex_rgb("#4A5A70"))
    snow_c = lin(hex_rgb("#DCEFFB"))
    moon_c = lin(hex_rgb("#C6E6FA"))
    rim_c = lin(hex_rgb("#36C5F0"))
    sky_c = lin(hex_rgb("#1D3A5C"))

    rock_mix = np.clip(ridged * 0.62 + strata * 0.20 + (1 - ao) * -0.12 + 0.04, 0, 1)[..., None]
    albedo = rock_a * (1 - rock_mix) + rock_b * rock_mix
    sn = snow[..., None]
    albedo = albedo * (1 - sn) + snow_c * sn

    colour = (
        albedo * moon_c * (lit[..., None] * 4.4)
        + albedo * rim_c * (fill[..., None] ** 2 * shadow[..., None] * 0.55)
        + albedo * sky_c * (sky[..., None] * ao[..., None] * 0.62)
    )
    colour += rim_c * veins[..., None] * (1 - sn * 0.7) * 0.13
    colour = colour.astype(np.float32)

    print("resolving image...")
    uv = [(zb + 1.2) / 2.4 * (n - 1), (wxb + 1.2) / 2.4 * (n - 1)]
    img = np.stack(
        [ndi.map_coordinates(colour[..., i], uv, order=1, mode="nearest") for i in range(3)], -1
    )
    height_px = ndi.map_coordinates(h, uv, order=1, mode="nearest")

    # glints: tiny embers of knowledge held in the rock
    glint = np.zeros((H, W), np.float32)
    ys = rng.integers(0, H, 1300)
    xs = rng.integers(0, W, 1300)
    keep = covered[ys, xs]
    glint[ys[keep], xs[keep]] = rng.random(keep.sum(), dtype=np.float32) ** 2.4 * 4.5
    glint = ndi.gaussian_filter(glint, 0.9) * 2.6 + ndi.gaussian_filter(glint, 3.0) * 4.0
    glint *= 1 - smooth(0.6, 1.1, height_px) * 0.8
    img += lin(hex_rgb("#8BDCF5")) * glint[..., None] * 0.55

    # valley fog: the mountain rises out of low cloud
    fog_c = lin(hex_rgb("#1A3350"))
    yy = (np.arange(H, dtype=np.float32) / H)[:, None]
    low = smooth(0.42, 0.04, height_px)
    fn = ndi.zoom(fractal(512, np.random.default_rng(3), 6, 4), (H / 512, W / 512), order=1)[:H, :W]
    fog = np.clip(low * (0.45 + fn * 0.9), 0, 1) * smooth(0.45, 0.82, yy)
    fog = (fog + smooth(0.78, 1.0, yy) * 0.7).clip(0, 1)
    img = img * (1 - fog[..., None]) + fog_c * fog[..., None]

    # transparency: dissolve the foot and the flanks into the backdrop
    xn = np.abs((np.arange(W, dtype=np.float32) + 0.5) / W - 0.5) * 2
    side = 1 - smooth(0.82, 1.0, xn)[None, :]
    foot = 1 - smooth(0.74, 0.90, yy)
    alpha = covered.astype(np.float32)
    alpha = ndi.gaussian_filter(alpha, 0.7)
    ground = smooth(0.012, 0.13, height_px + (fn - 0.5) * 0.10)
    alpha = alpha * side * foot * ground

    rgb = srgb(img)
    # tone: lift mids a touch but keep the night
    rgba = np.dstack([rgb, alpha])
    out = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    p = ROOT / "public/images/mountain"
    p.mkdir(parents=True, exist_ok=True)
    out.save(p / "mountain.webp", quality=82, method=6)

    # silhouette, in stage units, taken from what the camera really sees
    solid = alpha > 0.5
    top = np.argmax(solid, axis=0).astype(np.float32)
    top[~solid.any(axis=0)] = H
    top = ndi.gaussian_filter1d(top, 1.5) / SCALE
    xs_stage = np.arange(W) / SCALE
    apex = int(np.argmin(top))
    print("apex at", xs_stage[apex], top[apex])
    return xs_stage, top, apex


def render_ridges():
    rng = np.random.default_rng(77)
    w, h = 2400, 560
    layers = [("#141F34", 0.62, 0.20, 220), ("#101A2C", 0.78, 0.14, 150)]
    img = np.zeros((h, w, 4), np.float32)
    for hexc, base, amp, feat in layers:
        n = 1024
        line = fractal(n, rng, 6, 6, 0.55, ridged=True)[n // 2]
        line = np.interp(np.linspace(0, n - 1, w), np.arange(n), line)
        top = (base - (line - 0.3) * amp * 2.4) * h
        mask = (np.arange(h, dtype=np.float32)[None, :] - top[:, None]).T
        a = np.clip(mask, 0, 1)
        c = hex_rgb(hexc)
        fade = 1 - np.arange(h, dtype=np.float32)[:, None] / h * 0.2
        for i in range(3):
            img[..., i] = img[..., i] * (1 - a) + c[i] * fade * a
        img[..., 3] = np.maximum(img[..., 3], a)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA").save(
        ROOT / "public/images/mountain/ridges.webp", quality=80, method=6
    )


# ---------------------------------------------------------------- cake
TIERS = [  # r, top y of the ellipse centre, bottom y of the ellipse centre (stage units)
    dict(r=305, top=520, bot=704),
    dict(r=222, top=372, bot=520),
    dict(r=142, top=246, bot=372),
]
K = 0.165  # ellipse flattening: how far the camera looks down
CX = 500.0
PLATE = dict(r=398, y=716, thick=16)
FLAME = (500.0, 118.0)


FORMULAS = [
    "∇f", "∇·F", "∇×F", "∇²f = 0", "∮ F·dr", "∬ (curl F)·dS", "∭ div F dV",
    "ax²y″ + bxy′ + cy = 0", "y = xʳ Σ aₙxⁿ", "f(x) = Σ f⁽ⁿ⁾(x₀)(x − x₀)ⁿ/n!",
    "∂²u/∂t² = c² ∂²u/∂x²", "∂u/∂t = κ ∂²u/∂x²", "∂²u/∂x² + ∂²u/∂y² = 0",
    "z = |z|e^iθ", "(cos θ + i sin θ)ⁿ = cos nθ + i sin nθ", "aₙ, bₙ",
]


def formula_band(seed, width=2600, height=120, size=46):
    """Formulas piped in a band that wraps around a tier."""
    font = ImageFont.truetype(r"C:\Windows\Fonts\cambria.ttc", size, index=1)
    small = ImageFont.truetype(r"C:\Windows\Fonts\cambria.ttc", int(size * 0.66), index=1)
    im = Image.new("L", (width, height), 0)
    d = ImageDraw.Draw(im)
    rng = np.random.default_rng(seed)
    order = rng.permutation(len(FORMULAS))
    x, i = 10, 0
    while x < width - 80:
        s = FORMULAS[order[i % len(order)]]
        i += 1
        # "^" raises the rest of the string, drawn as true smaller text
        base, _, raised = s.partition("^")
        d.text((x, height * 0.5), base, fill=255, font=font, anchor="lm")
        x += int(d.textlength(base, font=font))
        if raised:
            d.text((x + 2, height * 0.5 - size * 0.3), raised, fill=255, font=small, anchor="lm")
            x += int(d.textlength(raised, font=small)) + 2
        x += 90
    return np.asarray(im, np.float32) / 255


def render_cake(lit: bool) -> Image.Image:
    SS = 2
    w, h = W * SS, H * SS
    s = SCALE * SS
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = xx / s, yy / s
    img = np.zeros((h, w, 3), np.float32)
    alpha = np.zeros((h, w), np.float32)

    fondant = lin(hex_rgb("#274A73"))
    fondant_b = lin(hex_rgb("#1A3454"))
    cream = lin(hex_rgb("#F5F8FC"))
    warm = lin(hex_rgb("#FFD9A6"))
    cyan = lin(hex_rgb("#36C5F0"))
    glow = lin(hex_rgb("#8BDCF5"))
    moon = lin(hex_rgb("#BFE2F8"))

    def light_at(px, py, pz, nx, ny, nz):
        """Returns linear RGB incident light for points and normals."""
        out = 0
        # moon, high on the left, shared with the mountain
        m = np.array([-0.62, 0.50, 0.60])
        m = m / np.linalg.norm(m)
        nl = np.clip(nx * m[0] + ny * m[1] + nz * m[2], 0, 1)
        scale = 0.42 if lit else 1.0
        out = out + moon * (nl * 1.5 * scale)[..., None]
        # cyan rim from the right
        rl = np.clip(nx * 0.86 + ny * 0.1 + nz * 0.25, 0, 1)
        out = out + cyan * (rl**2 * (0.42 if lit else 0.75))[..., None]
        out = out + lin(hex_rgb("#2E5A85")) * ((0.5 + 0.5 * ny) * 0.55)[..., None]
        if lit:
            lx, ly, lz = FLAME[0] - px, py - FLAME[1], 30.0 - pz
            d2 = lx * lx + ly * ly + lz * lz
            d = np.sqrt(d2)
            nd = np.clip((nx * lx + ny * ly + nz * lz) / d, 0, 1)
            fall = 1 / (1 + d2 / (230.0 * 230.0))
            out = out + warm * ((nd * 0.8 + 0.26) * fall * 3.4)[..., None]
        return out

    # plate
    px, py, pr, pt = CX, PLATE["y"], PLATE["r"], PLATE["thick"]
    rx = (X - px) / pr
    ry = (Y - py) / (pr * K)
    disc = rx * rx + ry * ry
    plate_side = (np.abs(rx) < 1) & (Y > py) & (Y < py + pt + np.sqrt(np.clip(1 - rx * rx, 0, 1)) * pr * K)
    nz = np.sqrt(np.clip(1 - rx * rx, 0, 1))
    side_col = lin(hex_rgb("#3A5A7E")) * light_at(X, Y, nz * pr, rx, np.zeros_like(rx), nz)
    img[plate_side] = side_col[plate_side]
    alpha[plate_side] = 1
    top = disc < 1
    tc = lin(hex_rgb("#567CA3")) * light_at(X, Y, -ry * pr, np.zeros_like(rx), np.ones_like(rx), np.zeros_like(rx))
    edge = smooth(0.90, 0.97, np.sqrt(disc))[..., None]
    tc = tc * (1 - edge * 0.5) + (glow * 0.42) * edge
    img[top] = tc[top]
    alpha[top] = 1

    bead_rng = np.random.default_rng(12)
    for idx, t in enumerate(TIERS):
        r, ty, by = t["r"], t["top"], t["bot"]
        u = (X - CX) / r
        inside_u = np.abs(u) < 1
        nzc = np.sqrt(np.clip(1 - u * u, 0, 1))
        curve = nzc * r * K  # lower edge of the ellipse in front
        body = inside_u & (Y >= ty) & (Y <= by + curve)

        # contact shadow on what sits beneath
        sh_d = np.sqrt(((X - CX) / (r * 1.09)) ** 2 + ((Y - by) / (r * 1.09 * K)) ** 2)
        sh = (1 - smooth(0.82, 1.0, sh_d)) * 0.62
        img *= (1 - sh)[..., None]

        v = np.clip((Y - ty) / np.maximum(by + curve - ty, 1), 0, 1)
        theta = np.arcsin(np.clip(u, -1, 1))
        base = fondant * (1 - v[..., None] * 0.35) + fondant_b * (v[..., None] * 0.35)

        # a soft band of piped formulas that wraps around the tier
        band_tex = formula_band(100 + idx)
        tw, th = band_tex.shape[1], band_tex.shape[0]
        band_lo, band_hi = 0.50, 0.70
        bv = np.clip((v - band_lo) / (band_hi - band_lo), 0, 0.999)
        bu = ((theta / np.pi + 0.5 + idx * 0.13) * (0.80 + idx * 0.0) * (r / 305) ** 0.6) % 1
        tex = band_tex[(bv * th).astype(int), (bu * (tw - 1)).astype(int)]
        tex = tex * ((v > band_lo) & (v < band_hi))
        tex = ndi.gaussian_filter(tex, 0.8)

        col = base * light_at(X, Y, nzc * r, u, np.zeros_like(u), nzc)
        col = col * (1 - tex[..., None] * 0.9) + (glow * 0.85 if not lit else cream * 0.95) * (
            tex[..., None] * 0.9 * (0.35 + 0.65 * nzc[..., None])
        )

        # frosting drips hanging from the top edge: the snowline, turned to icing
        drng = np.random.default_rng(40 + idx)
        ang = np.linspace(-1.6, 1.6, 900)
        lens = np.zeros_like(ang)
        cuts = np.sort(drng.uniform(-1.6, 1.6, 15 + idx * -3))
        for c in cuts:
            wd = drng.uniform(0.045, 0.09) * (305 / r) ** 0.5
            ln = drng.uniform(0.28, 1.0)
            lens = np.maximum(lens, ln * np.clip(1 - ((ang - c) / wd) ** 4, 0, 1) ** 0.6)
        drip_lens = np.interp(theta, ang, lens)
        rim_y = ty + curve  # front top edge
        drip_h = 18 + drip_lens * (by - ty) * 0.40
        dist = (Y - rim_y) / drip_h
        drip = (dist < 1) & body
        ice_dist = 1 - np.clip(dist, 0, 1)
        bevel = smooth(0.0, 0.32, ice_dist) * 0.5 + 0.5
        ice = cream * light_at(X, Y, nzc * r + 6, u, np.zeros_like(u) + 0.25, nzc)
        ice = ice * (0.78 + 0.22 * bevel[..., None]) * 1.05
        # shadow the icing throws on the fondant
        drip_soft = ndi.gaussian_filter(drip.astype(np.float32), s * 2.0)
        drip_soft = np.roll(drip_soft, int(4 * s), axis=0)
        col = col * (1 - drip_soft[..., None] * 0.55)
        col = np.where(drip[..., None], ice, col)

        img[body] = col[body]
        alpha[body] = 1

        # top face of the tier
        ey = (Y - ty) / (r * K)
        ed = u * u + ey * ey
        cap = ed < 1
        tc2 = cream * light_at(X, Y, -ey * r, u * 0.15, np.ones_like(u) * 0.97, ey * -0.1)
        img[cap] = tc2[cap]
        alpha[cap] = 1

        # pearl piping at the foot of the tier
        count = int(r * 0.19)
        for b in np.linspace(-np.pi / 2, np.pi / 2, count):
            bx = CX + np.sin(b) * r
            bz = np.cos(b)
            byy = by + bz * r * K
            br = 8.2 + idx * -0.8
            x0, x1 = int((bx - br - 1) * s), int((bx + br + 1) * s) + 1
            y0, y1 = int((byy - br - 1) * s), int((byy + br + 1) * s) + 1
            sx, sy = X[y0:y1, x0:x1], Y[y0:y1, x0:x1]
            dx, dy = (sx - bx) / br, (sy - byy) / br
            dsq = dx * dx + dy * dy
            m = dsq < 1
            dzz = np.sqrt(np.clip(1 - dsq, 0, 1))
            c = cream * light_at(sx, sy, bz * r + 10, dx, -dy, dzz)
            spec = np.clip(-dx * 0.5 - dy * 0.5 + dzz * 0.7, 0, 1) ** 24 * 0.6
            c = c + spec[..., None]
            img[y0:y1, x0:x1][m] = c[m]
            alpha[y0:y1, x0:x1][m] = 1
        _ = bead_rng

    rgb = srgb(img)
    rgba = np.dstack([rgb, alpha])
    pil = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    return pil.resize((W, H), Image.LANCZOS)


# ---------------------------------------------------------------- outlines
def resample(points: np.ndarray, count: int) -> np.ndarray:
    seg = np.hypot(*np.diff(points, axis=0).T)
    t = np.concatenate([[0], np.cumsum(seg)])
    u = np.linspace(0, t[-1], count)
    return np.stack([np.interp(u, t, points[:, 0]), np.interp(u, t, points[:, 1])], 1)


def cake_half() -> np.ndarray:
    """Left half of the cake outline, from the plate up to the top centre."""
    pr, py, pt = PLATE["r"], PLATE["y"], PLATE["thick"]
    # the front curve of the plate, from bottom centre out to its left edge
    pts = [(CX - np.sin(a) * pr, py + pt + np.cos(a) * pr * K) for a in np.linspace(0, np.pi / 2, 16)]
    pts += [(CX - pr, py), (CX - pr + 8, py - 9)]
    for i, t in enumerate(TIERS):
        r = t["r"]
        pts.append((CX - r, t["bot"] - (10 if i == 0 else 0)))
        pts.append((CX - r, t["top"]))
        if i < len(TIERS) - 1:
            arc = np.linspace(np.pi, np.pi * 1.02 + 0.5, 6)
            nr = TIERS[i + 1]["r"]
            for a in arc:
                pts.append((CX + np.cos(a) * r, t["top"] + np.sin(a) * r * K))
            pts.append((CX - nr * 1.02, t["top"] - r * K * 0.55))
    r = TIERS[-1]["r"]
    for a in np.linspace(np.pi, np.pi * 1.5, 14):
        pts.append((CX + np.cos(a) * r, TIERS[-1]["top"] + np.sin(a) * r * K))
    return np.array(pts, np.float32)


def write_silhouettes(xs, top, apex):
    # lift the mountain outline slightly so the clip never shaves the real edge
    step = 4
    mx = xs[::step]
    my = top[::step] - 2.5
    a = apex // step
    left = np.stack([mx[: a + 1], my[: a + 1]], 1)
    right = np.stack([mx[a:], my[a:]], 1)
    left = np.vstack([[0, 800], left])
    right = np.vstack([right, [1000, 800]])
    ml = resample(left, SIL_POINTS)
    mr = resample(right, SIL_POINTS)

    ch = cake_half()
    cl = resample(ch, SIL_POINTS)
    cr = resample((ch * [-1, 1] + [CX * 2, 0])[::-1], SIL_POINTS)

    mountain = np.vstack([ml, mr[1:]]).round(1)
    cake = np.vstack([cl, cr[1:]]).round(1)
    fmt = lambda a: ",".join(f"{v:g}" for v in a.flatten())
    text = (
        "// Generated by tools/art/render.py. Do not edit by hand.\n"
        "// Flat [x0, y0, x1, y1, ...] outlines with matching point order, in stage units.\n"
        f"export const mountainOutline = [{fmt(mountain)}];\n"
        f"export const cakeOutline = [{fmt(cake)}];\n"
        f"export const flamePosition = {{ x: {FLAME[0]:g}, y: {FLAME[1]:g} }};\n"
        f"export const candleBase = {{ x: {CX:g}, y: {TIERS[-1]['top'] + 2:g} }};\n"
    )
    (ROOT / "src/data/silhouettes.ts").write_text(text, encoding="utf-8")


def outlines_from_saved_image():
    """Rebuilds the outlines without re-rendering: python tools/art/render.py outlines"""
    alpha = np.asarray(Image.open(ROOT / "public/images/mountain/mountain.webp").convert("RGBA"))[..., 3]
    solid = alpha > 127
    top = np.argmax(solid, axis=0).astype(np.float32)
    top[~solid.any(axis=0)] = H
    top = ndi.gaussian_filter1d(top, 1.5) / SCALE
    write_silhouettes(np.arange(W) / SCALE, top, int(np.argmin(top)))


def render_cakes():
    """Only the cake: python tools/art/render.py cake"""
    d = ROOT / "public/images/birthday"
    print("cake...")
    render_cake(False).save(d / "cake-night.webp", quality=84, method=6)
    render_cake(True).save(d / "cake-lit.webp", quality=84, method=6)


def main():
    if "outlines" in sys.argv:
        outlines_from_saved_image()
        return
    if "cake" in sys.argv:
        render_cakes()
        return
    xs, top, apex = render_mountain()
    render_ridges()
    render_cakes()
    write_silhouettes(xs, top, apex)
    for f in [
        "public/images/mountain/mountain.webp",
        "public/images/mountain/ridges.webp",
        "public/images/birthday/cake-night.webp",
        "public/images/birthday/cake-lit.webp",
    ]:
        print(f, (ROOT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
