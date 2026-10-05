const fs = require('fs');
let html = fs.readFileSync('public/hairline-practice-patterns.html', 'utf8');

// 1. Add postMessage listener
const messageListener = `
  window.addEventListener('message', (e) => {
    if (e.data && typeof e.data.hoverPattern === 'number') {
      const idx = e.data.hoverPattern;
      if (idx === -1) {
        over = null;
        retarget();
        return;
      }
      const coords = [
        [2, 2], [6, 2],
        [2, 4], [6, 4],
        [2, 6], [6, 6],
        [4, 8], [7, 8]
      ];
      if (coords[idx]) {
        over = [(coords[idx][0] + 0.5) * CELL, (coords[idx][1] + 0.5) * CELL];
        retarget();
      }
    }
  });
`;

html = html.replace('bag.add(pointer(stage, {', messageListener + '\n  bag.add(pointer(stage, {');

// 2. Add orange gradient effect
const orangeEffect = `
    const ratio = clamp((h - 5) / (HMAX - 5), 0, 1);
    const fillStyle = ratio > 0 ? \`color-mix(in srgb, #f97316 \${ratio * 80}%, var(--hl-plate))\` : "";
    for (let p of c.el.g.childNodes) p.style.fill = fillStyle;
`;

html = html.replace('c.el.sil.classList.toggle("hi", h > HMAX * 0.5);', 'c.el.sil.classList.toggle("hi", h > HMAX * 0.5);\n' + orangeEffect);

fs.writeFileSync('public/hairline-practice-patterns.html', html);
