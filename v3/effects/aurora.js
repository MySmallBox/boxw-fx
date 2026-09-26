// boxw-fx v3 特效模块：极光（多层幕帘 + fbm 条纹，加色叠加在背景上）
// 插槽：drawScene（全屏加色，priority 高于星空）。参数：intensity(强度 0~100)、speed(速度 0~200)
(function () {
    'use strict';

    var AURORA_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uIntensity;' +
        'in vec2 vUv; out vec4 outColor;' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }' +
        'float noise(vec2 p){' +
        '  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);' +
        '  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),' +
        '             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);' +
        '}' +
        'float fbm(vec2 p){' +
        '  float v = 0.0, a = 0.5;' +
        '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }' +
        '  return v;' +
        '}' +
        'void main(){' +
        '  vec2 uv = vUv; float t = uTime;' +
        '  float band = 0.0;' +
        '  for (int k = 0; k < 3; k++) {' +
        '    float fk = float(k);' +
        '    float base = 0.45 + 0.16 * fk + 0.06 * sin(uv.x * (1.5 + fk) + t * (0.10 + 0.03 * fk));' +
        '    float n = fbm(vec2(uv.x * (2.5 + fk * 1.3) + fk * 7.0, uv.x * 1.2 - t * (0.06 + 0.025 * fk)));' +
        '    float y = base + (n - 0.5) * 0.5;' +
        '    float curtain = exp(-pow((uv.y - y) * 6.0, 2.0));' +
        '    float streak = fbm(vec2(uv.x * 22.0 + fk * 13.0, t * 0.08));' +
        '    band += curtain * (0.55 + 0.45 * streak) * (0.9 - 0.2 * fk);' +
        '  }' +
        '  float hsl = clamp((uv.y - 0.3) * 1.4 + fbm(vec2(uv.x * 3.0, t * 0.02)) - 0.5, 0.0, 1.0);' +
        '  vec3 col = mix(vec3(0.10, 0.90, 0.55), vec3(0.45, 0.25, 0.90), hsl);' +
        '  col = mix(col, vec3(0.10, 0.60, 0.90), 0.25);' +
        '  outColor = vec4(col * band * uIntensity, 1.0);' +
        '}';

    BwFx.register('aurora', {
        priority: 8,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pAurora = ctx.program(ctx.quadVS, AURORA_FS);
            var intensity = params.intensity != null ? Number(params.intensity) : 60;
            var timeScale = (Number(params.speed) || 100) / 100;

            return {
                drawScene: function (t) {
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.ONE, gl.ONE);
                    gl.useProgram(pAurora);
                    gl.uniform1f(pAurora.u.uTime, t * timeScale);
                    gl.uniform1f(pAurora.u.uIntensity, intensity / 100 * 0.45);
                    ctx.blitQuad(pAurora);
                    gl.disable(gl.BLEND);
                },
                setParam: function (id, value) {
                    // intensity/speed 与 UI 滑条同刻度（0~100 / 0~200）
                    if (id === 'intensity') intensity = Number(value) || 0;
                    else if (id === 'speed') timeScale = (Number(value) || 0) / 100;
                }
            };
        }
    });
})();
