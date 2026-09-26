// boxw-fx v3 特效模块：飘雪（gl_VertexID 程序化点，无状态无缓冲，hash 散列位置）
// 插槽：drawScene（加色小圆点）。参数：speed(下落速度 0~200)、wind(横向风力 -100~100)、size(雪花大小 0.5~4)
// 数量随画质：low 800 / mid 2000 / high 4000。
(function () {
    'use strict';

    var SNOW_VS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform float uTime; uniform float uWind; uniform float uSize;' +
        'out float vTw;' +
        'float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }' +
        'void main(){' +
        '  float id = float(gl_VertexID);' +
        '  float h0 = hash(id), h1 = hash(id + 11.0), h2 = hash(id + 37.0), h3 = hash(id + 91.0);' +
        '  float spd = 0.02 + h1 * 0.035;' +
        '  float y = fract(h0 + uTime * spd);' +
        '  float sway = sin(uTime * (0.4 + h2 * 0.8) + h3 * 20.0) * 0.012;' +
        '  float x = fract(h2 * 0.97 + uTime * uWind * spd * 0.6) + sway;' +
        '  float px = x * 2.0 - 1.0;' +
        '  float py = 1.0 - y * 2.0;' +
        '  vTw = 0.55 + 0.45 * sin(uTime * (1.0 + h3 * 2.0) + h0 * 30.0);' +
        '  gl_PointSize = max(1.0, uSize * (0.5 + h1 * 1.1) + 1.0);' +
        '  gl_Position = vec4(px, py, 0.0, 1.0);' +
        '}';

    var SNOW_FS = '#version 300 es\n' +
        'precision highp float;' +
        'in float vTw; out vec4 outColor;' +
        'void main(){' +
        '  float r = length(gl_PointCoord - 0.5) * 2.0;' +
        '  float a = smoothstep(1.0, 0.15, r) * vTw * 0.85;' +
        '  outColor = vec4(vec3(0.85, 0.90, 1.0) * a, 1.0);' +
        '}';

    var COUNT = { low: 800, mid: 2000, high: 4000 };

    BwFx.register('snow', {
        priority: 30,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pSnow = ctx.program(SNOW_VS, SNOW_FS);
            var quality = COUNT[params.quality] ? params.quality : 'mid';
            var speed = (params.speed != null ? Number(params.speed) : 100) / 100;
            var wind = params.wind != null ? Number(params.wind) / 100 : 0;
            var size = params.size != null ? Number(params.size) : 2;

            return {
                drawScene: function (t) {
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.ONE, gl.ONE);
                    gl.useProgram(pSnow);
                    gl.uniform1f(pSnow.u.uTime, t * speed);
                    gl.uniform1f(pSnow.u.uWind, wind);
                    gl.uniform1f(pSnow.u.uSize, size * ctx.dpr * (ctx.sceneW / ctx.physW));
                    gl.bindVertexArray(ctx.emptyVao);
                    gl.drawArrays(gl.POINTS, 0, COUNT[quality]);
                    gl.disable(gl.BLEND);
                },
                quality: function (q) {
                    if (COUNT[q]) quality = q;
                },
                setParam: function (id, value) {
                    if (id === 'speed') speed = (Number(value) || 0) / 100;
                    else if (id === 'wind') wind = (Number(value) || 0) / 100;
                    else if (id === 'size') size = Number(value) || 1;
                }
            };
        }
    });
})();
