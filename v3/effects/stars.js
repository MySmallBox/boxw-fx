// boxw-fx v1 特效模块：背景星空（程序化星点 + 中心光晕 + 微弱闪烁）
// 插槽：drawScene（无混合全屏绘制，priority 最低最先画，相当于清屏背景）。
// 参数：twinkle(闪烁幅度 0~1)、color(星点颜色)
(function () {
    'use strict';

    var STARS_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uTwinkle;' +
        'in vec2 vUv; out vec4 outColor;' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }' +
        'void main(){' +
        '  vec2 p = vUv * vec2(1.6, 1.0);' +
        '  float n = 0.0;' +
        '  float tw = 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (1.0 + hash(floor(p * 240.0)) * 3.0)' +
        '          + hash(floor(p * 240.0)) * 20.0));' +
        '  n += hash(floor(p * 240.0)) * 0.14 * tw;' +
        '  vec2 g = p * 60.0; vec2 fc = fract(g) - 0.5;' +
        '  n += hash(floor(g)) > 0.995 ? 0.5 * smoothstep(0.14, 0.02, length(fc)) : 0.0;' +
        '  vec3 base = mix(vec3(0.016, 0.020, 0.038), vec3(0.040, 0.030, 0.062),' +
        '                  smoothstep(0.0, 1.0, vUv.y * 0.7 + 0.3));' +
        '  float halo = exp(-dot(vUv - vec2(0.5, 0.42), vUv - vec2(0.5, 0.42)) * 3.0);' +
        '  base += vec3(0.03, 0.05, 0.09) * halo;' +
        '  outColor = vec4(base + n * vec3(0.5, 0.6, 0.9), 1.0);' +
        '}';

    BwFx.register('stars', {
        priority: 5,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pStars = ctx.program(ctx.quadVS, STARS_FS);
            var twinkle = params.twinkle != null ? Number(params.twinkle) : 1.0;

            return {
                drawScene: function (t) {
                    gl.disable(gl.BLEND);
                    gl.useProgram(pStars);
                    gl.uniform1f(pStars.u.uTime, t);
                    gl.uniform1f(pStars.u.uTwinkle, twinkle);
                    ctx.blitQuad(pStars);
                },
                setParam: function (id, value) {
                    if (id === 'twinkle') twinkle = Number(value) || 0;
                }
            };
        }
    });
})();
