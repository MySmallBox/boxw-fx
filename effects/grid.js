// boxw-fx v3 特效模块：合成波透视网格（暗色天空 + 霓虹地平面网格，无混合全屏背景）
// 插槽：drawScene（全屏不透明底，与星空二选一或互相覆盖）。
// 参数：speed(滚动速度 0~200)、intensity(亮度 0~100)、density(纵向线密度 10~100)
(function () {
    'use strict';

    var GRID_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uIntensity; uniform float uDensity;' +
        'in vec2 vUv; out vec4 outColor;' +
        'float line1d(float g){' +
        '  float d = abs(fract(g + 0.5) - 0.5) / max(fwidth(g), 1e-5);' +
        '  return 1.0 - min(d, 1.0);' +
        '}' +
        'void main(){' +
        '  float hy = 0.42;' +
        '  vec2 uv = vUv;' +
        '  vec3 col = mix(vec3(0.05, 0.01, 0.10), vec3(0.012, 0.010, 0.035),' +
        '                 smoothstep(0.0, 0.42, uv.y));' +
        '  float glow = exp(-pow((uv.y - hy) * 14.0, 2.0));' +
        '  col += vec3(0.85, 0.15, 0.55) * glow * 0.16 * uIntensity;' +
        '  float d = hy - uv.y;' +
        '  if (d > 0.0) {' +
        '    float z = 0.12 / max(d, 0.001) + uTime;' +
        '    float x = (uv.x - 0.5) * uDensity * 4.0 / max(d, 0.001);' +
        '    float lz = line1d(z);' +
        '    float lx = line1d(x);' +
        '    float fade = smoothstep(0.0, 0.10, d) * smoothstep(1.2, 0.15, z - uTime);' +
        '    col += vec3(0.10, 0.65, 0.95) * lz * 0.55 * fade * uIntensity;' +
        '    col += vec3(0.90, 0.20, 0.75) * lx * 0.35 * fade * uIntensity;' +
        '  }' +
        '  outColor = vec4(col, 1.0);' +
        '}';

    BwFx.register('grid', {
        priority: 4,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pGrid = ctx.program(ctx.quadVS, GRID_FS);
            var timeScale = (params.speed != null ? Number(params.speed) : 100) / 100;
            var intensity = params.intensity != null ? Number(params.intensity) : 70;
            var density = params.density != null ? Number(params.density) : 40;

            return {
                drawScene: function (t) {
                    gl.disable(gl.BLEND);
                    gl.useProgram(pGrid);
                    gl.uniform1f(pGrid.u.uTime, t * timeScale);
                    gl.uniform1f(pGrid.u.uIntensity, intensity / 100);
                    gl.uniform1f(pGrid.u.uDensity, density / 40);
                    ctx.blitQuad(pGrid);
                },
                setParam: function (id, value) {
                    // speed/intensity/density 与 UI 滑条同刻度
                    if (id === 'speed') timeScale = (Number(value) || 0) / 100;
                    else if (id === 'intensity') intensity = Number(value) || 0;
                    else if (id === 'density') density = Number(value) || 40;
                }
            };
        }
    });
})();
