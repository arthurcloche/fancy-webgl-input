// "Cosmic Cycles" by Martijn Steinrucken aka BigWings/CountFrolic - 2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

const vertexShaderSource = `#version 300 es
in vec4 aPosition;
in vec2 aTexCoord;

out vec2 vTexCoord;

void main() {
  gl_Position = aPosition;
  vTexCoord = aTexCoord;
}`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 vTexCoord;
out vec4 fragColor;

uniform vec2 uResolution;
uniform vec2 uInputSize;
uniform vec2 uInputOffset;
uniform float uCornerRadius;
uniform float uTime;

const float PI = ${Math.PI.toFixed(8)};
const float margins = 0.2;
const float ratio = 8./3.;


#define NUM_LAYERS 5.


// SDF for rounded rectangle
// https://www.shadertoy.com/view/Nlc3zf
float box(vec2 p, vec2 size, float radius) {
  vec2 q = abs(p) - size + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

vec3 irri(float x){
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.);
  vec3 d = vec3(0.,0.334,0.667);
  return a + b * cos( 6.28318 * ( c * x + d ));
}

vec3 palette(float x){
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  vec3 c = vec3(1.);
  vec3 d = vec3(0.0,0.10,0.20);//vec3(0.5,0.20,0.25);
  return a + b * cos( 6.28318 * ( c * x + d ));
}

float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

#define NUM_LAYERS 5.

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c,-s,s,c);
}

// "Cosmic Cycles" by Martijn Steinrucken aka BigWings/CountFrolic - 2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
// Email: countfrolic@gmail.com
// Twitter: @The_ArtOfCode
// YouTube: youtube.com/TheArtOfCodeIsCool

float Star(vec2 uv, float a, float sparkle) {
    vec2 av1 = abs(uv);
     vec2 av2 = abs(uv*Rot(a));
    vec2 av = min(av1, av2);
    
    float d = length(uv);
    float star = av1.x*av1.y;
    star = max(av1.x*av1.y, av2.x*av2.y);
    star = max(0., 1.-star*1e3);
    
    float m = min(5., 1e-2/d);
    
    return m+pow(star, 4.)*sparkle;
}

float Hash21(vec2 p) {
    p = fract(p*vec2(123.34,145.54));
    p += dot(p, p+45.23);
    return fract(p.x*p.y);
}

vec3 StarLayer(vec2 uv, float t, float sparkle, float angle, out float alpha) {
    vec2 gv = fract(uv)-.5;
    vec2 id = floor(uv);
    vec3 col = vec3(0);
    // vec3 _col = vec3(0.);
    #ifndef BURST
    t = 0.;
    #endif
    
    for(int y=-1; y<=1; y++) {
        for(int x=-1; x<=1; x++) {
            vec2 offs = vec2(x, y);
            float n = Hash21(id-offs);
            vec3 N = fract(n*vec3(10,100,1000));
            vec2 p = (N.xy-.5)*.7;
            float brightness = Star(gv-p+offs, n*6.2831+t, sparkle);
            vec3 _col = irri(angle+fract(uTime * .125 + length(vTexCoord-.5)));
            vec3 star = brightness*palette(p.x*.5+.5)*N.z*N.z;//vec3(.6+p.x, .4, .6+p.y)*N.z*N.z;
            star *= 1.+sin((t+n)*20.)*smoothstep(sin(t)*.5+.5, 1., fract(10.*n));
            
            float d = length(gv+offs);
            
            col += star*smoothstep(1.5, .8, d);
            alpha += brightness;
        }
    }
    return col;
}

// Function to create radial god rays
vec3 godRays(vec2 uv, vec2 pos, float intensity) {
    vec2 delta = uv - pos;
    float angle = atan(delta.y, delta.x);
    float dist = length(delta);
    
    // Create radial rays
    float rays = 0.5 + 0.5 * sin(angle * 12.0 + uTime * 0.5);
    rays = pow(rays, 2.0) * intensity;
    
    // Fade based on distance
    rays *= smoothstep(1.2, 0.2, dist);
    
    // Add some noise to make it more natural
    rays *= 0.8 + 0.2 * hash12(uv * 40.0 + uTime);
    
    return vec3(rays) * mix(
        vec3(1.0, 0.8, 0.4),  // Warm color
        vec3(0.6, 0.8, 1.0),  // Cool color
        sin(uTime * 0.1) * 0.5 + 0.5
    );
}

// Function to create drop shadow
float dropShadow(float d, vec2 uv, vec2 lightDir) {
    // Make shadow offset in the opposite direction of light
    vec2 shadowOffset = -lightDir * 0.01;
    float shadowDist = box(uv + shadowOffset, vec2(0.4 * ratio, 0.3), uCornerRadius);
    
    // Create shadow only for the shape
    float shadow = smoothstep(-0.1, 0.1, shadowDist);
    shadow = max(0.0, 1.0 - shadow);
    
    // Soften shadow
    shadow *= 0.5;
    
    return shadow;
}

vec4 Particles(vec2 coord, float angle) {
    vec2 uv = coord;
    float t = -uTime * .3;
    float alpha = 0.;
    float twirl = sin(t * .1);
    twirl *= twirl * twirl * sin(dot(uv, uv));
    uv *= Rot(-t * .2);
    uv *= 2. + sin(t * .05);

    vec3 col = vec3(0);
    float speed = -.2;
    #ifdef BURST
    speed = .1;
    float bla = sin(t + sin(t + sin(t) * .5)) * .5 + .5;
    float d = dot(uv, uv);
    float a = atan(uv.x, uv.y);
    uv /= d;
    float burst = sin(iTime * .05);
    uv *= burst + .2;
    #endif

    float stp = 1. / NUM_LAYERS;

    for (float i = 0.; i < 1.; i += stp) {
        float lt = fract(t * speed + i);
        float scale = mix(10., .25, lt);
        float fade = smoothstep(0., .4, lt) * smoothstep(1., .95, lt);
        vec2 sv = uv * scale + i * 134.53;
        float a = 0.;
        col += StarLayer(sv, t, fade, angle, a) * fade;
        alpha += a * fade;
        
    }

    #ifdef BURST
    float burstFade = smoothstep(0., .02, abs(burst));
    float size = .9 * sin(t) + 1.;
    size = max(size, sqrt(size));
    float fade = size / d;
    col *= mix(1., fade, burstFade);
    col += fade * .2 * vec3(1., .5, .1) * bla * burstFade;
    alpha += fade * burstFade; // Accumulate alpha contribution

    t *= 1.5;

    float rays = sin(a * 5. + t * 3.) - cos(a * 7. - t);
    rays *= sin(a + t + sin(a * 4.) * 10.) * .5 + .5;
    col += rays * bla * .1 * burstFade;
    col += 1. - burstFade;
    #else
    col *= 4.;
    // alpha *= 4.;
    #endif

    return vec4(col, alpha); // Return alpha as part of the vec4
}

vec4 add(vec4 src, vec4 dst, bool clamped) {
    if (!clamped) return src + dst;
    return clamp(src + dst, 0.0, 1.0);
}

vec4 blend(vec4 src, vec4 dst, float f) {
    return mix(src, dst, f);
}

vec4 screen(vec4 src, vec4 dst, bool clamped) {
    if (!clamped) return vec4(1.0) - (vec4(1.0) - src) * (vec4(1.0) - dst);
    return clamp(vec4(1.0) - (vec4(1.0) - src) * (vec4(1.0) - dst), 0.0, 1.0);
}

void main() {
  vec2 st = vTexCoord;
  vec2 uv = vTexCoord - .5;
  uv.x *= uResolution.x / uResolution.y;
  float alpha = 0.;
  vec2 halfSize = vec2(0.4 * ratio, 0.3);
  float d = box(uv, halfSize, uCornerRadius);
  float ddxy = fwidth(max(uResolution.x, uResolution.y));
  float rectmask = smoothstep(0.5-ddxy, 0.5 + ddxy, d);
  float glowmask = 0.95 * (1.-d) + hash12(vec2(gl_FragCoord.xy * 1024. + uTime) ) * 0.025;
  
  vec2 lightDir = normalize(vec2(0.2, 0.7)); // Light coming from top-right
  float shadow = dropShadow(d, uv, lightDir);
  
  float raymask = smoothstep(0.75,1., glowmask) ;
  alpha += raymask;
  vec3 rays = godRays(st, vec2(0.5, 0.5), 0.8) * raymask; 
  
  float glow = smoothstep(0.8,1., glowmask);
  float a = atan(st.y-.5,st.x-.5) * 1./PI;
  alpha += glow;
  vec3 color =  (glow + rays) * palette(a+fract(uTime * .025 + length(st-.5)  ));
  
  color *= sign(d) * vec3(1.);
  //color += rays * mix(1.0, 0.0, smoothstep(-0.01, 0.01, -d));
  color = mix(color, mix(color, vec3(0.0, 0.0, 0.0), shadow), step(0.0, d));
  
  vec4 debug = vec4(color, alpha);
  float particlesmask = (1.-glow)*(1.-smoothstep(0.0, .25, d));
  vec4 particles = Particles(uv, a) * particlesmask;
  fragColor = screen(debug, particles, true);
}`;
