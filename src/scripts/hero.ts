// Hero field (raw WebGL, no library): one fragment shader of ink lines that bend toward the pointer and swell with the track.
import { reducedMotion } from './clock';
import { level } from './player';

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uPointer; uniform float uLevel; uniform vec3 uInk; uniform float uLines;
float hash(float n){ return fract(sin(n)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float n=i.x+i.y*57.;
  return mix(mix(hash(n),hash(n+1.),f.x), mix(hash(n+57.),hash(n+58.),f.x), f.y); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float a = 0.;
  for (float i = 0.; i < 40.; i++) {
    if (i >= uLines) break;
    float base = (i + .5) / uLines;
    float dx = (uv.x - uPointer.x) * aspect;
    float dy = base - uPointer.y;
    float env = exp(-dx*dx*3.2) * exp(-dy*dy*14.);
    float amp = (.006 + .06*env) * (1. + uLevel*3.5);
    float n1 = noise(vec2(uv.x*3.*aspect + i*3.1, uTime*.32 + i*.7)) - .5;
    float n2 = noise(vec2(uv.x*18.*aspect + i*9., uTime*.9)) - .5;
    float y = base + amp * (n1*2. + n2*(.25 + uLevel*2.2));
    float w = 1.2 / uRes.y;
    a += smoothstep(w*1.7, 0., abs(uv.y - y)) * (.28 + .72*env + uLevel*.5);
  }
  gl_FragColor = vec4(uInk, clamp(a, 0., 1.) * .62);
}`;

export async function initHero(canvas: HTMLCanvasElement): Promise<() => void> {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
  if (!gl) return () => {};
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return () => {};
  gl.useProgram(prog);
  canvas.parentElement?.querySelector('.hero-fallback')?.remove();

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = (name: string) => gl.getUniformLocation(prog, name);
  const uRes = u('uRes'), uTime = u('uTime'), uPointer = u('uPointer'), uLevel = u('uLevel'), uInk = u('uInk'), uLines = u('uLines');

  const small = window.innerWidth < 720;
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
  const ink = (getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#111111').replace('#', '');
  const hex = ink.length === 3 ? ink.replace(/./g, '$&$&') : ink;
  gl.uniform3f(uInk, parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  gl.uniform1f(uLines, small ? 22 : 34);

  const pointer = { x: 0.7, y: 0.55 };
  const target = { x: 0.7, y: 0.55 };
  const resize = () => {
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    target.x = (e.clientX - r.left) / r.width;
    target.y = 1 - (e.clientY - r.top) / r.height;
  };
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });

  let raf = 0;
  let visible = true;
  let smooth = 0;
  const still = reducedMotion();
  const t0 = performance.now();
  const frame = () => {
    pointer.x += (target.x - pointer.x) * 0.06;
    pointer.y += (target.y - pointer.y) * 0.06;
    smooth += (level() - smooth) * 0.25;
    gl.uniform1f(uTime, still ? 12 : (performance.now() - t0) / 1000);
    gl.uniform2f(uPointer, pointer.x, pointer.y);
    gl.uniform1f(uLevel, smooth);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible && !still) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was && !still) raf = requestAnimationFrame(frame);
  });
  io.observe(canvas);
  frame();

  return () => {
    cancelAnimationFrame(raf);
    visible = false;
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
