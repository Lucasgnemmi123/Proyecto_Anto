const hero = document.querySelector('.hero');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

if (hero && !reduceMotion.matches) {
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const paintScene = () => {
    hero.style.setProperty('--hero-shift-x', `${pointerX * -7}px`);
    hero.style.setProperty('--hero-shift-y', `${pointerY * -5}px`);
    hero.style.setProperty('--effects-shift-x', `${pointerX * 15}px`);
    hero.style.setProperty('--effects-shift-y', `${pointerY * 11}px`);
    frame = 0;
  };

  const requestPaint = () => {
    if (!frame) frame = window.requestAnimationFrame(paintScene);
  };

  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    requestPaint();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
    requestPaint();
  }, { passive: true });

  reduceMotion.addEventListener('change', (event) => {
    if (!event.matches) return;
    pointerX = 0;
    pointerY = 0;
    paintScene();
  });
}
