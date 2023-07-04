#version 330

// ------------------------------------------------------------------------------------------------|
//// Textures

// Input textures - base image and its depth map
uniform sampler2D base_image;
uniform sampler2D depth_map;

// Base_image's resolution
uniform vec2 resolution;

// ------------------------------------------------------------------------------------------------|
//// Effect parameters

// Camera parameters
uniform vec2  camera_position;
uniform float camera_distance;

// Parallax intensity for a normalized camera_position
uniform float parallax_intensity;

// Vignette parameters
uniform float vignette_radius;
uniform float vignette_intensity;

// Random parameters
uniform float time;
uniform float zoom;
uniform float rotation;

// ------------------------------------------------------------------------------------------------|

//// OpenGL stuff

// Vertex data, output color
in vec2 vertex_stuv;
out vec4 color;

// ------------------------------------------------------------------------------------------------|

// Zero depth means the object does not move
float get_depth(vec2 stuv) {
    // Don't overshoot image borders
    stuv = clamp(stuv, 0.0, 1.0);

    // Return inversion of heightmap relative to camera_distance
    // FIXME: Directions should be inverted when this changes signal relative to camera_distance
    return camera_distance - texture(depth_map, stuv).r;
}

// Depth-Layer displacement for a pixel, composed of the camera displacement times max
// camera displacement (parallax_intensity) times the depth of the pixel (zero should not move)
vec2 displacement(vec2 stuv) {
    return camera_position * get_depth(stuv) * parallax_intensity;
}

// Trivial 2D rotation matrix
mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

// Center-Zoom a stuv coordinate space
vec2 center_zoom_stuv(vec2 stuv, float zoom) {
    return (stuv - 0.5) * zoom + 0.5;
}

// Apply border vignettes, all values normalized.
// - vignette_radius is the distance from the border to the center
// - vignette_intensity is the starting value of the transparency of the vignette on the borders
// - Vignette reaches zero on vignette_radius/2
// FIXME: I was sleepy, have weird effects on vignette_intensity=1
vec3 vignette(vec2 stuv, vec3 pixel) {

    // Get the minimum distance to any border
    float distance_to_border = min(min(stuv.x, 1.0 - stuv.x), min(stuv.y, 1.0 - stuv.y));

    // Get the vignette value
    float vignette_value = smoothstep(vignette_radius, vignette_radius - vignette_intensity, distance_to_border);

    // Apply the vignette alpha composition
    return mix(pixel, vec3(0.0), vignette_value);
}

// ------------------------------------------------------------------------------------------------|

void main() {
    // "Shadertoy Coordinates", which are from (0, 0) to (1, 1)
    vec2 stuv = vertex_stuv;

    // Flip coords vertically
    stuv.y = 1.0 - stuv.y;

    // Zoom in on the stuv coordinate since the max displacement on X or Y is $intensity
    stuv = center_zoom_stuv(stuv, zoom - parallax_intensity/2);

    // Center-Rotate the stuv coordinates considering the aspect ratio
    // FIXME: I don't remember and am lazy to think in anti shear matrix vectors
    // float aspect_ratio = resolution.x/resolution.y;
    // stuv = rotate2d(rotation) * (stuv - 0.5) + 0.5;

    // --------------------------------------------------------------------------------------------|
    // The idea of how this shader works is that we search, on the opposite direction a pixel is
    // supposed to "walk", if some other pixel should be in front of *us* or not.

    // The direction the pixel walk is the camera displacement itself
    vec2 direction = camera_position*parallax_intensity;

    // Initialize the parallax space with the original stuv
    vec2 parallax_uv = stuv + displacement(stuv);

    // FIXME: Do you know how to code shaders better than me?
    // Fixme: Could you implement the step() pixel size anti-aliasing and better efficiency?
    for (float i=0; i<length(direction); i=i+0.001) {
        vec2 walk_stuv          = stuv + direction*i;
        vec2 other_displacement = displacement(walk_stuv);

        if (i < length(other_displacement)) {
            parallax_uv = walk_stuv;
        }
    }

    // Sample the texture on the parallax space
    color = texture(base_image, parallax_uv);

    // Apply vignette
    // color.rgb = vignette(stuv, color.rgb);
}