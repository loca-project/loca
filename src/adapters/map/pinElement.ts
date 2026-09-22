/** 地図エンジンに依存しないピンの DOM 生成。MapLibre / Google の双方で使う。 */

export interface PinVisual {
  color: string;
  label?: string;
  ghost?: boolean;
}

const PIN_PATH = 'M16 1C9.4 1 4 6.4 4 13c0 9 12 22 12 22s12-13 12-22c0-6.6-5.4-12-12-12z';

/** 32x38 のピン。中央にラベルを置ける。 */
export function createPinElement({ color, label, ghost }: PinVisual): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'loca-pin';
  wrapper.style.cursor = 'pointer';
  wrapper.style.opacity = ghost ? '0.65' : '1';
  wrapper.style.lineHeight = '0';

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '38');
  svg.setAttribute('viewBox', '0 0 32 38');

  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', PIN_PATH);
  path.setAttribute('fill', color);
  path.setAttribute('stroke', '#ffffff');
  path.setAttribute('stroke-width', '2');
  svg.appendChild(path);

  if (label) {
    const text = document.createElementNS(svgNs, 'text');
    text.setAttribute('x', '16');
    text.setAttribute('y', '17');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '11');
    text.setAttribute('font-weight', '700');
    text.setAttribute('fill', '#ffffff');
    text.textContent = label;
    svg.appendChild(text);
  } else {
    const dot = document.createElementNS(svgNs, 'circle');
    dot.setAttribute('cx', '16');
    dot.setAttribute('cy', '13');
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', '#ffffff');
    dot.setAttribute('fill-opacity', '0.85');
    svg.appendChild(dot);
  }

  wrapper.appendChild(svg);
  return wrapper;
}
