// boxw-fx 特效模块：樱花（精灵贴图粒子）
// 质感来源：AI 花瓣图集（黑底键控反预乘）+ 局部椭圆发射区 + 寿命淡入淡出 +
//           cos 翻面（负值镜像 UV 假背面）+ 风场摆动 + 三层景深（前景用失焦 sprite）。
// 插槽：drawScene。素材：assets/sakura/atlas.png（3x3 单元格，0-5 清晰 / 6-8 失焦）。
// 参数均为 UI 刻度，见 effects.json。
(function () {
    'use strict';

    var VS = '#version 300 es\n' +
        'layout(location=0) in vec4 aPos; ' +
        'layout(location=1) in vec2 aRot; ' +
        'layout(location=2) in vec2 aSprite; ' +
        'layout(location=3) in float aFlip;' +
        'out vec2 vUv; out float vAlpha;' +
        'void main(){' +
        '  vec2 c = vec2(float((gl_VertexID & 1) << 1) - 1.0, float(gl_VertexID & 2) - 1.0);' +
        '  vec2 uv = c * 0.5 + 0.5;' +
        '  uv.x = mix(uv.x, 1.0 - uv.x, aFlip);' +
        '  vec2 local = vec2(c.x * aPos.z, c.y * aPos.w);' +
        '  vec2 r = vec2(aRot.x * local.x - aRot.y * local.y, aRot.y * local.x + aRot.x * local.y);' +
        '  vec2 p = aPos.xy + r;' +
        '  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);' +
        '  float col = mod(aSprite.x, 3.0), row = floor(aSprite.x / 3.0);' +
        '  vUv = (vec2(col, row) + uv) / 3.0;' +
        '  vAlpha = aSprite.y;' +
        '}';

    var FS = '#version 300 es\n' +
        'precision mediump float;' +
        'uniform sampler2D uTex; uniform vec3 uTint;' +
        'in vec2 vUv; in float vAlpha; out vec4 outColor;' +
        'void main(){' +
        '  vec4 s = texture(uTex, vUv);' +
        '  outColor = vec4(s.rgb * uTint * vAlpha, s.a * vAlpha);' +
        '}';

    var MAX = 900;
    var SPRITE_AR = 0.68;

    function pick(list) { return list[(Math.random() * list.length) | 0]; }

    BwFx.register('sakura', {
        priority: 60,
        deps: [],
        create: function (ctx, params) {
            var gl = ctx.gl;
            var prog = ctx.program(VS, FS);
            var tex = null;

            var count = Number(params.count) || 160;
            var spawnX = (params.spawnX != null ? Number(params.spawnX) : 50) / 100;
            var spawnY = (params.spawnY != null ? Number(params.spawnY) : 30) / 100;
            var spawnR = (params.spawnR != null ? Number(params.spawnR) : 25) / 100;
            var wind = (params.wind != null ? Number(params.wind) : 15) / 100;
            var fall = (params.fall != null ? Number(params.fall) : 60) / 100;
            var size = (params.size != null ? Number(params.size) : 100) / 100;
            var tint = (params.tint != null ? Number(params.tint) : 40) / 100;
            var bokeh = params.bokeh !== false;
            var qualityMul = 1;

            var img = new Image();
            img.onload = function () {
                var cv = document.createElement('canvas');
                cv.width = img.width; cv.height = img.height;
                var c2 = cv.getContext('2d');
                c2.drawImage(img, 0, 0);
                var d = c2.getImageData(0, 0, cv.width, cv.height), px = d.data;
                for (var i = 0; i < px.length; i += 4) {
                    var a = px[i + 3] / 255;
                    px[i] *= a; px[i + 1] *= a; px[i + 2] *= a;
                }
                c2.putImageData(d, 0, 0);
                tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            };
            img.src = 'assets/sakura/atlas.png';

            var P = {
                x: new Float32Array(MAX), y: new Float32Array(MAX),
                age: new Float32Array(MAX), life: new Float32Array(MAX),
                hs: new Float32Array(MAX), sway: new Float32Array(MAX),
                tilt: new Float32Array(MAX), tiltSpd: new Float32Array(MAX),
                rot: new Float32Array(MAX), rotSpd: new Float32Array(MAX),
                sprite: new Float32Array(MAX), alpha: new Float32Array(MAX),
                fallSpd: new Float32Array(MAX)
            };
            var inst = new Float32Array(MAX * 10);

            var vao = gl.createVertexArray();
            var buf = gl.createBuffer();
            gl.bindVertexArray(vao);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
            var STRIDE = 40;
            gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, STRIDE, 0);
            gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 16);
            gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 24);
            gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE, 32);
            for (var l = 0; l < 4; l++) gl.vertexAttribDivisor(l, 1);
            gl.bindVertexArray(null);

            function layerOf(i, n) {
                var nBack = Math.round(n * 0.55), nMid = Math.round(n * 0.33);
                return i < nBack ? 0 : (i < nBack + nMid ? 1 : 2);
            }

            function respawn(i, n, initial) {
                var lay = layerOf(i, n);
                var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
                P.x[i] = spawnX + Math.cos(a) * spawnR * rr;
                P.y[i] = spawnY + Math.sin(a) * spawnR * rr * 0.8;
                P.life[i] = 2.4 + Math.random() * 2.8;
                P.age[i] = initial ? Math.random() * P.life[i] : 0;
                var base = lay === 0 ? 0.014 : (lay === 1 ? 0.024 : 0.055);
                P.hs[i] = base * (0.75 + Math.random() * 0.5);
                P.sway[i] = Math.random() * Math.PI * 2;
                P.tilt[i] = Math.random() * Math.PI * 2;
                P.tiltSpd[i] = (0.5 + Math.random() * 1.4) * (Math.random() < 0.5 ? -1 : 1);
                P.rot[i] = Math.random() * Math.PI * 2;
                P.rotSpd[i] = (0.3 + Math.random() * 1.2) * (Math.random() < 0.5 ? -1 : 1);
                P.sprite[i] = lay === 2 ? pick([6, 7, 8]) : pick([0, 1, 2, 3, 4, 5]);
                P.alpha[i] = lay === 0 ? 0.88 : (lay === 1 ? 1 : 0.6);
                P.fallSpd[i] = (lay === 0 ? 0.55 : (lay === 1 ? 0.85 : 1.25)) * (0.8 + Math.random() * 0.4);
            }

            var n = 0;
            function rebuild() {
                n = Math.max(4, Math.min(MAX, Math.round(count * qualityMul * (bokeh ? 1 : 0.9))));
                for (var i = 0; i < n; i++) respawn(i, n, true);
            }
            rebuild();

            var uTint = prog.u.uTint, uTex = prog.u.uTex;

            return {
                textureReady: function () { return !!tex; },
                drawScene: function (t, dt) {
                    if (!tex) return;
                    var aspect = ctx.physW / ctx.physH;
                    var instN = bokeh ? n : layerBoundary(n);
                    var k = 0, i, lay;
                    for (i = 0; i < instN; i++) {
                        P.age[i] += dt;
                        var lifeT = P.age[i] / P.life[i];
                        if (lifeT >= 1) { respawn(i, n, false); continue; }
                        var fallV = P.fallSpd[i] * (0.05 + fall * 0.22);
                        P.y[i] += fallV * dt;
                        var swayV = Math.sin(P.sway[i] + t * 1.4) * 0.03 + wind * 0.14;
                        P.x[i] += swayV * dt;
                        P.tilt[i] += P.tiltSpd[i] * dt * (0.6 + fall * 1.2);
                        P.rot[i] += P.rotSpd[i] * dt;
                        if (P.y[i] > 1.08 || P.x[i] < -0.12 || P.x[i] > 1.12) { respawn(i, n, false); continue; }
                        var fade = Math.min(1, lifeT / 0.15) * (1 - smooth01((lifeT - 0.6) / 0.4));
                        var hh = P.hs[i] * size;
                        var cosT = Math.cos(P.tilt[i]);
                        // 边缘面下限：cosT≈0 时不压成灰色细条，保留正面轮廓再渐缩
                        var hw = hh * SPRITE_AR * (0.5 + 0.5 * Math.abs(cosT)) / aspect;
                        var sinR = Math.sin(P.rot[i]), cosR = Math.cos(P.rot[i]);
                        inst[k] = P.x[i]; inst[k + 1] = P.y[i]; inst[k + 2] = hw; inst[k + 3] = hh;
                        inst[k + 4] = cosR; inst[k + 5] = sinR;
                        inst[k + 6] = P.sprite[i]; inst[k + 7] = P.alpha[i] * fade;
                        inst[k + 8] = cosT < 0 ? 1 : 0; inst[k + 9] = 0;
                        k += 10;
                    }
                    var drawN = k / 10;
                    if (!drawN) return;
                    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst, 0, k);
                    gl.enable(gl.BLEND);
                    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
                    gl.useProgram(prog);
                    gl.activeTexture(gl.TEXTURE0);
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    gl.uniform1i(uTex, 0);
                    gl.uniform3f(uTint, 1, 1 - tint * 0.38, 1 - tint * 0.25);
                    gl.bindVertexArray(vao);
                    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, drawN);
                    gl.bindVertexArray(null);
                    gl.disable(gl.BLEND);
                },
                quality: function (q) {
                    qualityMul = q === 'low' ? 0.55 : (q === 'high' ? 1.5 : 1);
                    rebuild();
                },
                setParam: function (id, value) {
                    var v = Number(value);
                    switch (id) {
                        case 'count': if (v) { count = v; rebuild(); } break;
                        case 'spawnX': spawnX = v / 100; break;
                        case 'spawnY': spawnY = v / 100; break;
                        case 'spawnR': spawnR = v / 100; break;
                        case 'wind': wind = v / 100; break;
                        case 'fall': fall = v / 100; break;
                        case 'size': size = v / 100; break;
                        case 'tint': tint = v / 100; break;
                        case 'bokeh':
                            bokeh = value === true || value === 'true';
                            rebuild();
                            break;
                    }
                }
            };
        }
    });

    function smooth01(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }
    function layerBoundary(n) { return n - Math.round(n * 0.12); }
})();
