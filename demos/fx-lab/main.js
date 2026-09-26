// fx-lab 演示壁纸：接入 boxw-fx v1，四个特效全开 + HUD 帧率
// 本文件演示开发者最小接入：create → autoWallpaper，参数由宿主经 bwSetParam 路由。
(function () {
    'use strict';

    var canvas = document.getElementById('stage');
    var fx = BwFx.create(canvas, {
        effects: {
            stars: {},
            ripple: {},
            particles: {},
            bloom: {}
        }
    });
    if (!fx) {
        document.getElementById('hud').textContent = 'WebGL2 不可用（需 WebView2 引擎）';
        return;
    }

    BwFx.autoWallpaper(fx, { hud: 'hud' });
    window.__fx = fx; // 验证 harness 用
})();
