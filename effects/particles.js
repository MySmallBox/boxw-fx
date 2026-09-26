// boxw-fx v1 特效模块：GPU 粒子场
// 状态存 RGBA32F 纹理（位置+速度）side×side，更新/绘制双 program，ping-pong。
// 插槽：sim(状态更新) + drawScene(加色点绘制)。参数：quality/pointSize/audioDrive/colorA/colorB
(function () {
    'use strict';

    var UPDATE_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uState; uniform vec2 uMouse; uniform float uDt; uniform float uTime;' +
        'uniform float uPush; uniform float uAudio; uniform float uAspect;' +
        'in vec2 vUv; out vec4 outColor;' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }' +
        'void main(){' +
        '  vec4 s = texture(uState, vUv);' +
        '  vec2 pos = s.xy; vec2 vel = s.zw;' +
        '  vec2 d = (pos - uMouse) * vec2(uAspect, 1.0);' +
        '  float dist2 = dot(d, d);' +
        '  vel += (pos - uMouse) * uPush * exp(-dist2 * 14.0) * uDt * 60.0;' +
        '  float seed = hash(vUv * 513.0);' +
        '  vel += vec2(sin(pos.y * 17.0 + uTime * (1.3 + seed)), cos(pos.x * 15.0 + uTime * (1.1 + seed * 0.8)))' +
        '         * (0.006 + uAudio * 0.12) * uDt * 60.0;' +
        '  vel += (vec2(hash(vUv.yx * 397.0 + uTime), hash(vUv * 761.0 - uTime)) - 0.5) * uAudio * 0.05 * uDt * 60.0;' +
        '  vel *= pow(0.982, uDt * 60.0);' +
        '  float sp = length(vel); if (sp > 1.2) vel *= 1.2 / sp;' +
        '  pos = fract(pos + vel * uDt);' +
        '  outColor = vec4(pos, vel);' +
        '}';

    var DRAW_VS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform sampler2D uState; uniform int uSide; uniform float uSize; uniform float uAspect;' +
        'out float vSpeed;' +
        'void main(){' +
        '  ivec2 tc = ivec2(gl_VertexID % uSide, gl_VertexID / uSide);' +
        '  vec4 s = texelFetch(uState, tc, 0);' +
        '  vec2 pos = s.xy;' +
        '  vSpeed = length(s.zw);' +
        '  gl_PointSize = max(1.0, uSize * (0.4 + fract(float(tc.x * 7 + tc.y * 13) * 0.011) * 1.3));' +
        '  gl_Position = vec4(pos.x * 2.0 - 1.0, 1.0 - pos.y * 2.0, 0.0, 1.0);' +
        '}';

    var DRAW_FS = '#version 300 es\n' +
        'precision highp float;' +
        'uniform vec3 uColorA; uniform vec3 uColorB;' +
        'in float vSpeed; out vec4 outColor;' +
        'void main(){' +
        '  float r = length(gl_PointCoord - 0.5) * 2.0;' +
        '  float a = smoothstep(1.0, 0.0, r); a *= a;' +
        '  vec3 c = mix(uColorA, uColorB, min(1.0, vSpeed * 3.0));' +
        '  outColor = vec4(c * a, 1.0);' +
        '}';

    var SIDE = { low: 80, mid: 144, high: 224 };
    var POINT = { low: 2.4, mid: 2.0, high: 1.8 };

    BwFx.register('particles', {
        priority: 20,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var pUpdate = ctx.program(ctx.quadVS, UPDATE_FS);
            var pDraw = ctx.program(DRAW_VS, DRAW_FS);
            var side = 0, texA = null, texB = null, fboA = null, fboB = null;
            var pointSize = params.pointSize != null ? params.pointSize : null;
            var audioDrive = params.audioDrive !== false;
            var colorA = params.colorA || [0.16, 0.36, 0.85];
            var colorB = params.colorB || [0.55, 0.95, 1.0];
            var quality = SIDE[params.quality] ? params.quality : 'mid';

            function init(side_) {
                if (side === side_) return;
                side = side_;
                var n = side * side;
                var data = new Float32Array(n * 4);
                for (var i = 0; i < n; i++) {
                    var base = Math.random() * Math.PI * 2;
                    data[i * 4] = Math.random();
                    data[i * 4 + 1] = Math.random();
                    data[i * 4 + 2] = Math.cos(base) * 0.006;
                    data[i * 4 + 3] = Math.sin(base) * 0.006;
                }
                if (texA) {
                    gl.deleteTexture(texA); gl.deleteTexture(texB);
                    gl.deleteFramebuffer(fboA); gl.deleteFramebuffer(fboB);
                }
                texA = ctx.makeTex(side, side, gl.RGBA32F, gl.RGBA, gl.FLOAT, data, gl.NEAREST);
                texB = ctx.makeTex(side, side, gl.RGBA32F, gl.RGBA, gl.FLOAT, null, gl.NEAREST);
                fboA = ctx.makeFbo(texA);
                fboB = ctx.makeFbo(texB);
            }
            init(SIDE[quality]);

            return {
                sim: function (t, dt, input) {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB);
                    gl.viewport(0, 0, side, side);
                    gl.disable(gl.BLEND);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, texA);
                    var pu = pUpdate;
                    gl.useProgram(pu);
                    gl.uniform1i(pu.u.uState, 0);
                    gl.uniform2f(pu.u.uMouse, input.mx, input.my);
                    gl.uniform1f(pu.u.uDt, dt);
                    gl.uniform1f(pu.u.uTime, t);
                    gl.uniform1f(pu.u.uPush, input.push);
                    gl.uniform1f(pu.u.uAudio, audioDrive ? input.audio : 0);
                    gl.uniform1f(pu.u.uAspect, ctx.aspect);
                    ctx.blitQuad(pu);
                    var tt = texA; texA = texB; texB = tt;
                    var ff = fboA; fboA = fboB; fboB = ff;
                },
                drawScene: function () {
                    var gl2 = gl;
                    gl2.enable(gl2.BLEND);
                    gl2.blendFunc(gl2.ONE, gl2.ONE);
                    gl2.useProgram(pDraw);
                    gl2.activeTexture(gl2.TEXTURE0);
                    gl2.bindTexture(gl2.TEXTURE_2D, texA);
                    gl2.uniform1i(pDraw.u.uState, 0);
                    gl2.uniform1i(pDraw.u.uSide, side);
                    var ps = pointSize != null ? pointSize : POINT[quality];
                    gl2.uniform1f(pDraw.u.uSize, ps * ctx.dpr * (ctx.sceneW / ctx.physW));
                    gl2.uniform1f(pDraw.u.uAspect, ctx.aspect);
                    gl2.uniform3f(pDraw.u.uColorA, colorA[0], colorA[1], colorA[2]);
                    gl2.uniform3f(pDraw.u.uColorB, colorB[0], colorB[1], colorB[2]);
                    gl2.bindVertexArray(ctx.emptyVao);
                    gl2.drawArrays(gl2.POINTS, 0, side * side);
                    gl2.disable(gl2.BLEND);
                },
                quality: function (q) {
                    if (!SIDE[q]) return;
                    quality = q;
                    init(SIDE[q]);
                },
                setParam: function (id, value) {
                    if (id === 'pointSize') pointSize = Number(value) || 2;
                    else if (id === 'audioDrive') audioDrive = value === true || value === 'true';
                }
            };
        }
    });
})();
