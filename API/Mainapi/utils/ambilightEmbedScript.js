/**
 * Shared client-side Ambilight edge color broadcaster injected into direct HTML5
 * embed pages (/api/webflix/embed, /api/miaw/miaw-embed). Because the embed loads
 * the MP4 from the same origin as itself, Canvas 2D sampling never hits CORS taint,
 * letting the parent PlayerStage react dynamically even inside cross-origin iframes.
 */
function getAmbilightEmbedScript(videoId) {
  return `
    (function() {
      var vid = document.getElementById(${JSON.stringify(videoId)});
      if (!vid || window.parent === window) return;
      var W = 16, H = 9;
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) return;

      function boost(r, g, b) {
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max < 8) return 'rgba(0,0,0,0)';
        var avg = (r + g + b) / 3;
        var lift = (max < 42 && max > min + 4) ? 1.55 : 1.12;
        var clamp = function(n) { return Math.max(0, Math.min(255, Math.round(n))); };
        return 'rgba(' + clamp((avg + (r - avg) * 1.45) * lift) + ',' +
          clamp((avg + (g - avg) * 1.45) * lift) + ',' +
          clamp((avg + (b - avg) * 1.45) * lift) + ',0.72)';
      }

      function sample() {
        if (vid.readyState < 2 || !vid.videoWidth || !vid.videoHeight) return;
        try {
          ctx.drawImage(vid, 0, 0, W, H);
          var d = ctx.getImageData(0, 0, W, H).data;
          var avgBox = function(x0, x1, y0, y1) {
            var r = 0, g = 0, b = 0, n = 0;
            for (var y = y0; y <= y1; y++) {
              for (var x = x0; x <= x1; x++) {
                var i = (y * W + x) * 4;
                r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
              }
            }
            return n ? boost(r / n, g / n, b / n) : 'rgba(0,0,0,0)';
          };
          window.parent.postMessage({
            type: 'dawger-ambilight-colors',
            active: !vid.paused && !vid.ended,
            top: avgBox(2, W - 3, 1, 3),
            bottom: avgBox(2, W - 3, H - 4, H - 2),
            left: avgBox(0, 3, 1, H - 2),
            right: avgBox(W - 4, W - 1, 1, H - 2)
          }, '*');
        } catch (e) {}
      }

      setInterval(function() {
        if (!vid.paused && !vid.ended) sample();
      }, 130);
      vid.addEventListener('playing', sample);
      vid.addEventListener('seeked', sample);
      vid.addEventListener('loadeddata', sample);
    })();
  `;
}

module.exports = { getAmbilightEmbedScript };
