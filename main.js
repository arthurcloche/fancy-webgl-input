// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("gl-canvas");
  const textarea = document.getElementById("fancy-input");
  const submitButton = document.getElementById("submit-button");
  const container = document.querySelector(".container");
  const inputWrapper = document.querySelector(".input-wrapper");

  // Initialize WebGL2
  const gl = canvas.getContext("webgl2", { alpha: true });
  if (!gl) {
    console.error("WebGL2 not supported");
    return;
  }

  // Auto-growing textarea functionality
  function adjustTextareaHeight() {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate new height based on content
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
    const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop);
    const paddingBottom = parseFloat(getComputedStyle(textarea).paddingBottom);
    const minLines = 3;
    const maxLines = 8;

    // Calculate current lines of text
    const scrollHeight = textarea.scrollHeight;
    const textareaHeight = scrollHeight;
    const minHeight = lineHeight * minLines + paddingTop + paddingBottom;
    const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;

    // Apply height constraints
    let newHeight = Math.max(minHeight, Math.min(textareaHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;

    // Adjust container height proportionally if needed
    if (newHeight > minHeight) {
      // Calculate how much the textarea grew
      const growthFactor = newHeight / minHeight;

      // Get original container dimensions
      const originalAspectRatio = 8 / 3;
      const containerWidth = container.clientWidth;

      // Adjust container height based on textarea growth
      // and maintain the original width
      const newContainerHeight =
        (containerWidth / originalAspectRatio) * growthFactor;
      container.style.height = `${newContainerHeight}px`;
      container.style.aspectRatio = "auto"; // Override the aspect-ratio temporarily
    } else {
      // Reset to original aspect ratio
      container.style.height = "auto";
      container.style.aspectRatio = "8/3";
    }

    // Trigger resize for WebGL
    handleResize();
  }

  // Listen for input events to adjust height
  textarea.addEventListener("input", adjustTextareaHeight);

  // Submit button event listener
  submitButton.addEventListener("click", () => {
    const text = textarea.value.trim();
    if (text) {
      console.log("Submitted:", text);
      // Add your submission logic here
    }
  });

  // Also submit on Enter key (without shift)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitButton.click();
    }
  });

  // Initialize textarea height
  setTimeout(adjustTextareaHeight, 0);

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
    const inputRect = textarea.getBoundingClientRect();
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

  // Replace the initial render with animation start
  // handleResize(); // replaced with animate();

  // Handle window resize
  window.addEventListener("resize", handleResize);

  // Re-render on input focus/blur to update visual state
  textarea.addEventListener("focus", render);
  textarea.addEventListener("blur", render);
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
