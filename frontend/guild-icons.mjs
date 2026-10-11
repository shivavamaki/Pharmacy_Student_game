// Original 16 x 16 icons. Decorative; the adjacent button text names the action.
const shapes={
 team:'M3 1h4v4H3zM9 2h4v4H9zM2 6h6v7H6v3H3v-3H1V8h1zM9 7h5v2h1v5h-3v2H9z',
 sword:'M11 1h4v4h-2v2h-2v2H9v2H7v2H5v2H2v-3h2v-2h2V8h2V6h2V4h1zM2 6h2v2h2v2h2v2h2v2H8v-2H6v-2H4V8H2z',
 coin:'M4 1h8v2h2v2h1v6h-1v2h-2v2H4v-2H2v-2H1V5h1V3h2zM6 4v8h4v-2H8V9h2V7H8V6h2V4z',
 book:'M1 3h5v1h4V3h5v11h-5v1H6v-1H1zM3 5v7h3V5zM10 5v7h3V5zM7 5v8h2V5z',
 scroll:'M3 1h10v2h2v3h-2v7h-2v2H1v-2h2V4H1V1zM5 4v1h6V4zM5 7v1h6V7zM5 10v1h4v-1z',
 shield:'M2 1h12v8h-1v2h-2v2H9v2H7v-2H5v-2H3V9H2zM7 4v3H4v2h3v3h2V9h3V7H9V4z',
 gear:'M6 1h4v3h2V2h2v4h2v4h-2v4h-2v-2h-2v3H6v-3H4v2H2v-4H0V6h2V2h2v2h2zM6 6v4h4V6z',
 music:'M5 2h9v9h-1v2h-4v-3h3V5H7v8H6v2H2v-3h3z'
};
export function guildIcon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 16 16');svg.setAttribute('class','pixel-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',shapes[name]||shapes.shield);path.setAttribute('fill','currentColor');path.setAttribute('fill-rule','evenodd');svg.append(path);return svg;}
