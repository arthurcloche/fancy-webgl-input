// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gl-canvas");
  const container = document.querySelector(".container");
  const inputWrapper = document.querySelector(".empty-container");

  // Initialize WebGL2
  const gl = canvas.getContext("webgl2", { alpha: true });
  if (!gl) {
    console.error("WebGL2 not supported");
    return;
  }

  // Compile shaders
  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  // Get attribute locations
  const positionAttribLocation = gl.getAttribLocation(program, "aPosition");
  const texCoordAttribLocation = gl.getAttribLocation(program, "aTexCoord");

  // Get uniform locations
  const resolutionUniformLocation = gl.getUniformLocation(
    program,
    "uResolution"
  );
  const inputSizeUniformLocation = gl.getUniformLocation(program, "uInputSize");
  const inputOffsetUniformLocation = gl.getUniformLocation(
    program,
    "uInputOffset"
  );
  const cornerRadiusUniformLocation = gl.getUniformLocation(
    program,
    "uCornerRadius"
  );
  const timeUniformLocation = gl.getUniformLocation(program, "uTime");

  // Create buffers
  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();
  const vao = gl.createVertexArray();

  gl.bindVertexArray(vao);

  // Position buffer (fullscreen quad)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(positionAttribLocation);
  gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);

  // Texture coordinate buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  const texCoords = [0, 0, 1, 0, 0, 1, 1, 1];
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(texCoordAttribLocation);
  gl.vertexAttribPointer(texCoordAttribLocation, 2, gl.FLOAT, false, 0, 0);

  // Setup blending
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Function to handle resize
  function handleResize() {
    // Get device pixel ratio
    const pixelRatio = window.devicePixelRatio || 2;

    // Get container's CSS size
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;

    // Set canvas size with pixel ratio for high DPI displays
    canvas.width = Math.floor(displayWidth * pixelRatio);
    canvas.height = Math.floor(displayHeight * pixelRatio);

    // Keep canvas visual size the same with CSS
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Update WebGL viewport to match the canvas's pixel dimensions
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Also adjust the input wrapper to maintain proper positioning
    inputWrapper.style.height = `${displayHeight * 0.6}px`;

    // Render
    render();
  }

  // Add resize event listeners for the breakpoints
  const breakpoints = [768, 1200];
  let lastBreakpoint = null;

  function checkBreakpoints() {
    const width = window.innerWidth;
    let currentBreakpoint = null;

    if (width <= breakpoints[0]) {
      currentBreakpoint = "small";
    } else if (width <= breakpoints[1]) {
      currentBreakpoint = "medium";
    } else {
      currentBreakpoint = "large";
    }

    if (currentBreakpoint !== lastBreakpoint) {
      lastBreakpoint = currentBreakpoint;
      handleResize();
    }
  }

  // Initial size check
  checkBreakpoints();

  // Add resize listener
  window.addEventListener("resize", checkBreakpoints);

  // Render function
  function render() {
    // Clear canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use shader program
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    // Get input element dimensions relative to canvas
    const inputRect = inputWrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // Get the pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;

    // Calculate input position and size, adjusted for pixel density
    const inputOffsetX = (inputRect.left - canvasRect.left) * pixelRatio;
    const inputOffsetY = (inputRect.top - canvasRect.top) * pixelRatio;
    const inputWidth = inputRect.width * pixelRatio;
    const inputHeight = inputRect.height * pixelRatio;

    // Set uniforms
    gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    gl.uniform2f(inputSizeUniformLocation, inputWidth, inputHeight);
    gl.uniform2f(inputOffsetUniformLocation, inputOffsetX, inputOffsetY);
    gl.uniform1f(cornerRadiusUniformLocation, 0.05); // Set corner radius in pixels
    gl.uniform1f(timeUniformLocation, performance.now() / 1000.0); // Add time uniform in seconds

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Also modify to animate continuously
  let animationFrameId;

  function animate() {
    render();
    animationFrameId = requestAnimationFrame(animate);
  }

  // Start animation
  animate();

  // Handle window resize
  window.addEventListener("resize", handleResize);
});

// Helper function to create shader
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error("Failed to compile shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

// Helper function to create program
function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (!success) {
    console.error("Failed to link program:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
