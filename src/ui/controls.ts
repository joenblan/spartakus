// Speed controls: pause, 1×, 3×. Keyboard: space toggles pause, 1 and 3 pick a speed.
import { colors, fonts, sizes } from '../render/theme';
import type { Loop, Speed } from './loop';

const OPTIONS: { speed: Speed; label: string }[] = [
  { speed: 0, label: 'Pause' },
  { speed: 1, label: '1×' },
  { speed: 3, label: '3×' },
];

export function mountSpeedControls(loop: Loop, parent: HTMLElement): void {
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: `${sizes.topBarX.controls}px`,
    height: `${sizes.topBar}px`,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  });
  const buttons = OPTIONS.map(({ speed, label }) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.title = speed === 0 ? 'Pause (space)' : `${label} speed (key ${speed})`;
    Object.assign(b.style, {
      font: `bold ${sizes.numberSize + 1}px ${fonts.sans}`,
      padding: '5px 12px',
      border: `${sizes.outline}px solid ${colors.ink}`,
      borderRadius: '3px',
      cursor: 'pointer',
    });
    b.onclick = () => loop.setSpeed(speed);
    bar.appendChild(b);
    return { b, speed };
  });
  const paint = () => {
    for (const { b, speed } of buttons) {
      const on = loop.speed === speed;
      b.style.background = on ? colors.buttonActive : colors.button;
      b.style.color = on ? colors.buttonActiveText : colors.ink;
    }
  };
  let lastRunning: Speed = 1;
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (loop.speed === 0) loop.setSpeed(lastRunning);
      else {
        lastRunning = loop.speed;
        loop.setSpeed(0);
      }
    } else if (e.key === '1') loop.setSpeed(1);
    else if (e.key === '3') loop.setSpeed(3);
  });
  const prevChange = loop.onChange;
  loop.onChange = () => {
    prevChange?.();
    paint();
  };
  paint();
  parent.appendChild(bar);
}
