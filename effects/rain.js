// boxw-fx v3 特效模块：雨丝（gl_VertexID 程序化 LINES，每点两条线段模拟拖尾）
// 插槽：drawScene（加色线段）。参数：speed(下落速度 0~300)、length(雨丝长度 0.2~1.5)
(function () {
    'use strict';

    var RAIN_VS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uSpeed; uniform float uDensity;' +
        'out float vFade;' +
        'float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }' +
        'void main(){' +
        '  float id = float(gl_VertexID / 2);' +
        '  float h0 = hash(id), h1 = hash(id + 13.0), h2 = hash(id + 47.0);' +
        '  float spd = 0.5 + h2 * 0.4;' +
        '  float y = fract(h0 + uTime * spd * uSpeed);' +
        '  float x = fract(h1 * 0.97);' +
        '  float seg = float(gl_VertexID % 2);' +
        '  float dy = seg * 0.055 * uDensity;' +
        '  vFade = 1.0 - seg;' +
        '  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - (y + dy) * 2.0, 0.0, 1.0);' +
        '}';

    var RAIN_FS = '#version 300 es\n' +
        'precision highp float;' +
        'in float vFade; out vec4 outColor;' +
        'void main(){' +
        '  outColor = vec4(vec3(0.45, 0.65, 0.90) * vFade * 0.55, 1.0);' +
        '}';

    var COUNT = { low: 600, mid: 1500, high: 2500 };

    BwFx.register('rain', {
        priority: 35,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pRain = ctx.program(RAIN_VS, RAIN_FS);
            var quality = COUNT[params.quality] ? params.quality : 'mid';
            var speed = (params.speed != null ? Number(params.speed) : 120) / 100;
            var length = params.length != null ? Number(params.length) : 0.8;

            return {
                drawScene: function (t) {
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.ONE, gl.ONE);
                    gl.useProgram(pRain);
                    gl.uniform1f(pRain.u.uTime, t);
                    gl.uniform1f(pRain.u.uSpeed, speed);
                    gl.uniform1f(pRain.u.uDensity, length);
                    gl.bindVertexArray(ctx.emptyVao);
                    gl.drawArrays(gl.LINES, 0, COUNT[quality] * 2);
                    gl.disable(gl.BLEND);
                },
                quality: function (q) {
                    if (COUNT[q]) quality = q;
                },
                setParam: function (id, value) {
                    if (id === 'speed') speed = (Number(value) || 0) / 100;
                    else if (id === 'length') length = Number(value) || 1;
                }
            };
        }
    });
})();
