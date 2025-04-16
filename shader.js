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

#define NUM_LAYERS 3.

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c,-s,s,c);
}

float Hash21(vec2 p) {
    p = fract(p*vec2(123.34,145.54));
    p += dot(p, p+45.23);
    return fract(p.x*p.y);
}

#define T uTime
#define R uResolution.xy


vec3 palette(float x){
  vec3 purple = vec3(0.45, 0.07, 0.61);
  vec3 light = vec3(.36, 0.12, 0.93);
  return mix(purple, light, x);
}

vec2 globalPos(vec2 pos){
    vec2 mover = vec2(cos(T)*.25,sin(T)*.125);
    return pos-mover + hash12(gl_FragCoord.xy + T * 0.1)*.0125;
}

float circle(vec2 pos,float lo, float hi){
    return smoothstep(lo,hi,length(globalPos(pos)));
}

// vec3 dispersive(vec3 color, vec2 pos, float lambert){

//     float ior = refractIndex;
//     float rd = 1.-circle(pos - ior/R.x,0.05,.25 + lambert * .025);
//     float r = gradient(rd).r;
//     float rg = 1.-circle(pos,0.05,.25 + lambert * .025);
//     float g = gradient(rd).g;
//     float bd = 1.-circle(pos + ior/R.x,0.05,.25 + lambert * .025);
//     float b = gradient(rd).b;

//     return vec3(r,g,b);
// }

vec3 normals(vec2 uv, vec2 size, float radius) {
  float d = box(uv, size, radius);
  float smoothFactor = .85; // Controls the smoothness of the normals
  float dx = dFdx(d);
  float dy = dFdy(d);
  // Reduce the impact of the depth component for softer edges
  float dz = d * (1.0 - smoothFactor);
  
  return normalize(vec3(dx, dy, dz));
}

float map(float val, float inA, float inB, float outA, float outB) {
  return (val - inA) / (inB - inA) * (outB - outA) + outA;
}

float fresnel(vec3 direction, vec3 normal, float power, bool invert) {
    vec3 halfDirection = normalize( normal + direction );
    float cosine = dot( halfDirection, direction );
    float product = max( cosine, 0.0 );
    float factor = invert ? 1.0 - pow( product, power ) : pow( product, power );
    return factor;
}
vec4 remapShadows(vec4 color) {
  float factor = 12.;
  return vec4(
    pow(color.x, factor),
    pow(color.y, factor),
    pow(color.z, factor),
    color.w
  );
}

float ease(float t, float power) {
    if (t < 0.5) {
        return 0.5 * pow(2.0 * t, power);
    } else {
        return 1.0 - 0.5 * pow(2.0 * (1.0 - t), power);
    }
}


float noise( vec2 co ){
    return fract( sin( dot( co.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

vec4 Particles2( in vec2 uv )
{
	
    float u_brightness = 1.2;
    float u_blobiness = 1.0;
    float u_particles = 10.0;

    float u_limit = 10.0;

    float u_energy = 1.0 * 0.75;

    vec2 position = uv * 0.33;
    float t = (T*0.5+100.) * u_energy;
    
    float a = 0.0;
    float b = 0.0;
    float c = 0.0;

    vec2 pos;
    vec2 center = vec2( 0,0 );

    float na, nb, nc, nd, d;
    float limit = u_particles / u_limit;
    float step = 1.0 / u_particles;
    float n = 0.0;
    
    for ( float i = 0.0; i <= 1.0; i += 0.025 ) {

        if ( i <= limit ) {

            vec2 np = vec2(n, 0.);

            
            na = noise( np * 1.1 );
            nb = noise( np * 2.8 );
            nc = noise( np * 0.7 );
            nd = noise( np * 3.2 );

            pos = center;
            pos.x += sin(t*na) * cos(t*nb) * tan(t*na*0.15) * 0.3;
            pos.y += tan(t*nc) * sin(t*nd) * 0.1;
            
            d = pow( 1.6*na / length( pos - position ), u_blobiness );
            
            if ( i < limit * 0.3333 ) a += d;
            else if ( i < limit * 0.5 ) b += d;
            else c += d;


            n += step;
        }
    }


    vec3 col = vec3(a*25.5,0.0,a*b) * 0.0001 * u_brightness;    
    return vec4( col, u_brightness );
    

}

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
    float burst = sin(uTime * .05);
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

vec4 Breath( in vec2 uv )
{

    float dMask = 1.0 - length(uv);
    dMask = smoothstep(0.25, 1.0, clamp(dMask, 0.0, 1.0)) * pow(abs(sin(T * 0.888) * 1.5), 3.0);
    vec3 col = 0.5 + 0.5*cos(T * 1.0123 + uv.xyx + vec3(0,2,4));
    return vec4(col * dMask,1.0);
}

vec3 fakeReflection(vec2 uv, vec2 size, float time) {
  vec2 reflPos = uv * 2.0;
  float loop = mod(T, 60.0) * PI * 2.0 / 60.0; // Ensure loop completes every 60 seconds
  float moveX = loop * R.x * 0.01;
  float moveY = loop * R.y * 0.01;
  float sweep = sin(reflPos.x + reflPos.y + moveX - moveY + loop) * 0.5 + 0.5;
  float edgeFactor = smoothstep(0.0, 0.8, length(reflPos) / length(size));
  float refl = pow(sweep, 3.0) * 0.3;
  float refl2 = pow(sin(reflPos.y * 0.5 - loop) * 0.5 + 0.5, 5.0) * 0.25;
  return vec3(refl);
}

const vec3 rd = vec3(0.0, 0.0, -1.0);

void main() {
  vec2 st = vTexCoord;
  vec2 uv = vTexCoord - .5;
  uv.x *= uResolution.x / uResolution.y;
  float alpha = 0.;
  vec2 halfSize = vec2(0.4 * ratio, 0.3);
  float d = box(uv, halfSize, uCornerRadius);
  float ddxy = fwidth(d);
  float rectmask = smoothstep(0.0, ddxy, d);
  
  float glowmask = 0.95 * (1.-d) + hash12(vec2(gl_FragCoord.xy * 1024. + uTime) ) * 0.025;
  float glow = smoothstep(0.8,1., glowmask);
  vec3 glowColor = (glow) * palette(sin(PI*4.+uTime * 0.5)*.5+.5);
  
  vec3 render = glowColor + vec3(1.-rectmask);
  vec3 n = normals(uv, halfSize, uCornerRadius);
  float g = 1.0 - abs(n.z);
  g = g * 0.8 / (g * 0.8 - g + 1.0);
  float glass = 1.-((1.0 - 0.4 * g));
  
  // Add the fake reflection effect - only within the glass area
  vec3 reflection = fakeReflection(uv, halfSize, uTime)*1.5;
  float reflMask = 1.0 - rectmask; // Only apply to the glass area
  
  // Combine glass with reflection
  render = vec3(glass * 0.75) + reflection * reflMask;
  
  alpha += glow;
  vec4 particles = Particles(uv, 0.);
  render += particles.rgb * reflection * reflMask;
  alpha += particles.a * reflMask;

  render += Breath(uv * .5).rgb * (1.-reflMask) * 0.25;
  render += Breath(uv).rgb  * reflection * reflMask * 0.1;


  fragColor = vec4(render,alpha);
  

    
}`;
