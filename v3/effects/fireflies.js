// boxw-fx v3 特效模块：萤火虫（gl_VertexID 程序化点，李萨如漂移 + 呼吸闪烁，暖色加色光斑）
// 插槽：drawScene。参数：speed(漂移速度 0~200)、glow(光晕大小 0.5~4)
// 数量随画质：low 30 / mid 80 / high 150。
(function () {
    'use strict';

    var FLY_VS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uSize;' +
        'out float vGlow;' +
        'float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }' +
        'void main(){' +
        '  float id = float(gl_VertexID);' +
        '  float h0 = hash(id), h1 = hash(id + 17.0), h2 = hash(id + 53.0), h3 = hash(id + 101.0);' +
        '  float h4 = hash(id + 199.0), h5 = hash(id + 271.0);' +
        '  float bx = 0.08 + h0 * 0.84, by = 0.15 + h1 * 0.65;' +
        '  float rx = 0.02 + h2 * 0.05, ry = 0.02 + h3 * 0.04;' +
        '  float sx = 0.25 + h4 * 0.5, sy = 0.3 + h5 * 0.5;' +
        '  float x = bx + rx * sin(uTime * sx * 2.0 + h0 * 20.0) + ry * 0.5 * sin(uTime * sy * 3.1 + h2 * 9.0);' +
        '  float y = by + ry * cos(uTime * sy * 2.4 + h1 * 15.0) + rx * 0.5 * cos(uTime * sx * 1.7 + h3 * 7.0);' +
        '  float blink = sin(uTime * (0.35 + h3 * 0.7) + h5 * 25.0) * 0.5 + 0.5;' +
        '  blink = pow(blink, 2.5);' +
        '  blink *= 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.8 + h4 * 2.2) + h1 * 11.0));' +
        '  vGlow = blink;' +
        '  gl_PointSize = max(1.0, uSize * (0.6 + h4 * 1.2) * (0.4 + blink * 0.6) + 2.0);' +
        '  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);' +
        '}';

    var FLY_FS = '#version 300 es\n' +
        'precision highp float;' +
        'in float vGlow; out vec4 outColor;' +
        'void main(){' +
        '  float r = length(gl_PointCoord - 0.5) * 2.0;' +
        '  float a = smoothstep(1.0, 0.0, r);' +
        '  a *= a;' +
        '  outColor = vec4(mix(vec3(0.9, 0.75, 0.25), vec3(0.6, 0.95, 0.4), 0.35) * a * vGlow * 0.9, 1.0);' +
        '}';

    var COUNT = { low: 30, mid: 80, high: 150 };

    BwFx.register('fireflies', {
        priority: 40,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pFly = ctx.program(FLY_VS, FLY_FS);
            var quality = COUNT[params.quality] ? params.quality : 'mid';
            var speed = (params.speed != null ? Number(params.speed) : 100) / 100;
            var glow = params.glow != null ? Number(params.glow) : 2;

            return {
                drawScene: function (t) {
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.ONE, gl.ONE);
                    gl.useProgram(pFly);
                    gl.uniform1f(pFly.u.uTime, t * speed);
                    gl.uniform1f(pFly.u.uSize, glow * ctx.dpr * (ctx.sceneW / ctx.physW));
                    gl.bindVertexArray(ctx.emptyVao);
                    gl.drawArrays(gl.POINTS, 0, COUNT[quality]);
                    gl.disable(gl.BLEND);
                },
                quality: function (q) {
                    if (COUNT[q]) quality = q;
                },
                setParam: function (id, value) {
                    if (id === 'speed') speed = (Number(value) || 0) / 100;
                    else if (id === 'glow') glow = Number(value) || 1;
                }
            };
        }
    });
})();
