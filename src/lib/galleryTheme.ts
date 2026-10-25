import type { CSSProperties } from 'react'

// How a client's gallery page looks. Light feels like a printed album, dark like a cinema.
const PALETTES: Record<string, Record<string, string>> = {
  light: { '--g-bg': '#faf8f5', '--g-fg': '#1c1b19', '--g-muted': '#8a857d', '--g-line': '#e7e2da', '--g-card': '#efebe4', '--g-btn': '#1c1b19', '--g-btn-fg': '#faf8f5', '--g-bar': 'rgba(250,248,245,.84)', '--g-lb': 'rgba(250,248,245,.985)' },
  dark: { '--g-bg': '#0c0c0c', '--g-fg': '#f1eee9', '--g-muted': '#8f8a83', '--g-line': '#232120', '--g-card': '#171615', '--g-btn': '#f1eee9', '--g-btn-fg': '#0c0c0c', '--g-bar': 'rgba(12,12,12,.8)', '--g-lb': 'rgba(8,8,8,.985)' },
}

export const themeVars = (theme: string): CSSProperties => (PALETTES[theme] ?? PALETTES.light) as CSSProperties

export const GALLERY_CSS = `
.g-root{background:var(--g-bg);color:var(--g-fg);min-height:100vh;font-family:var(--font-inter),Inter,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}
.g-serif{font-family:var(--g-serif),'Cormorant Garamond','Playfair Display',Georgia,'Times New Roman',serif}
.g-eyebrow{font-size:11.5px;letter-spacing:.3em;text-transform:uppercase;font-weight:500}
.g-btn{background:var(--g-btn);color:var(--g-btn-fg);border:1px solid var(--g-btn);border-radius:999px;padding:11px 24px;font-size:12.5px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:opacity .25s,transform .25s;font-family:inherit}
.g-btn:hover{opacity:.84}.g-btn:active{transform:scale(.98)}.g-btn:disabled{opacity:.45;cursor:default}
.g-btn.ghost{background:transparent;color:var(--g-fg);border-color:var(--g-line)}
.g-link{background:none;border:none;color:inherit;font:inherit;cursor:pointer;letter-spacing:.2em;text-transform:uppercase;font-size:11.5px;padding:6px 2px;border-bottom:1px solid currentColor;opacity:.9}
.g-input{width:100%;background:transparent;border:1px solid var(--g-line);color:var(--g-fg);border-radius:999px;padding:12px 18px;font-size:15px;text-align:center;outline:none;font-family:inherit}
.g-input:focus{border-color:var(--g-fg)}
@keyframes g-kenburns{from{transform:scale(1.03)}to{transform:scale(1.13)}}
@keyframes g-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes g-fade{from{opacity:0}to{opacity:1}}
.g-kb{animation:g-kenburns 24s ease-out both}
.g-rise{animation:g-rise 1s cubic-bezier(.2,.7,.2,1) both}
.g-rise.d1{animation-delay:.12s}.g-rise.d2{animation-delay:.24s}.g-rise.d3{animation-delay:.38s}
.g-fade{animation:g-fade .35s ease both}
.g-tile{position:relative;overflow:hidden;background:var(--g-card);border-radius:3px}
.g-tile img{opacity:0;transition:opacity .7s ease,transform 1s cubic-bezier(.2,.7,.2,1)}
.g-tile img.on{opacity:1}
.g-tile:hover img.on{transform:scale(1.03)}
.g-tile .g-dl{opacity:0;transition:opacity .25s}
.g-tile:hover .g-dl,.g-tile:focus-within .g-dl{opacity:1}
@media (hover:none){.g-tile .g-dl{opacity:1}}
.g-tab{background:none;border:none;color:var(--g-muted);font:inherit;font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding:8px 4px;cursor:pointer;border-bottom:1px solid transparent}
.g-tab.on{color:var(--g-fg);border-bottom-color:var(--g-fg)}
.g-iconbtn{background:none;border:none;color:var(--g-fg);cursor:pointer;width:42px;height:42px;border-radius:21px;display:flex;align-items:center;justify-content:center;font-size:22px;transition:background .2s;font-family:inherit}
.g-iconbtn:hover{background:color-mix(in srgb,var(--g-fg) 9%,transparent)}
.g-strip::-webkit-scrollbar{display:none}
.g-split{display:grid;grid-template-columns:1fr 1fr;min-height:100svh}
@media (max-width:760px){.g-split{grid-template-columns:1fr;min-height:0}.g-split>.g-split-img{order:-1;height:64vh}.g-split>.g-split-text{padding:48px 24px 56px}}
@media (prefers-reduced-motion:reduce){.g-kb,.g-rise,.g-fade{animation:none}.g-tile img{transition:none}}
`
