/* eslint-disable */
// TODO - generic draw call
// One of the good things about GL is that there are so many ways to draw things
import GL, {glGet} from './api';
import {assertWebGLContext, assertWebGL2Context} from './context';
import {glContextWithState} from './context';
import assert from 'assert';

// A good thing about webGL is that there are so many ways to draw things,
// e.g. depending on whether data is indexed and/or isInstanced.
// This function unifies those into a single call with simple parameters
// that have sane defaults.
export function draw(gl, {
  drawMode = GL.TRIANGLES,
  vertexCount,
  offset = 0,
  isIndexed = false,
  indexType = GL.UNSIGNED_SHORT,
  isInstanced = false,
  instanceCount = 0
}) {
  assertWebGLContext(gl);

  const extension = gl.getExtension('ANGLE_instanced_arrays');

  // TODO - Use polyfilled WebGL2RenderingContext instead of ANGLE extension
  if (isInstanced && isIndexed) {
    extension.drawElementsInstancedANGLE(
      drawMode, vertexCount, indexType, offset, instanceCount
    );
  } else if (isInstanced) {
    extension.drawArraysInstancedANGLE(
      drawMode, offset, vertexCount, instanceCount
    );
  } else if (isIndexed) {
    gl.drawElements(drawMode, vertexCount, indexType, offset);
  } else {
    gl.drawArrays(drawMode, offset, vertexCount);
  }
}

const ERR_ARGUMENTS = 'clear called without arguments';

/**
 * Optionally clears depth, color and stencil buffers
 * @param {WebGLRenderingContext} gl - context
 * @param {Object} options
 */
export function clear(gl, {
  color,
  depth,
  stencil
} = {}) {
  glContextWithState(gl, {color, depth, stencil}, () => {
    const clearFlags =
      (color ? GL.COLOR_BUFFER_BIT : 0) |
      (depth ? GL.COLOR_BUFFER_BIT : 0) |
      (stencil ? gl.DEPTH_BUFFER_BIT : 0);
    assert(clearFlags, ERR_ARGUMENTS);
    gl.clear(clearFlags);
  });
}

/**
 * Read pixels from a target
 *
 * Will read from the currently bound framebuffer, or the currently bound
 *  drawing buffer - if context has been created with
 *  preserveDrawingBuffers
 *
 * @param {WebGLRenderingContext} gl
 * @param {Object} opts
 * @param {Number} opts.x - leftmost coord to be read
 * @param {Number} opts.y - bottommost (or topmost if sourceHeight supplied)
 * @param {Number} opts.width=1 - width of area to be read
 * @param {Number} opts.height=1 - height of area to be read
 * @param {Number} opts.sourceHeight= - target height, implies top left coords
 * @param {Number} opts.dataOffset=0 - WebGL2 only - offset into data array
 * @param {Number} opts.format=GL.RBGA - Can be set to GL.RGB or GL.ALPHA
 *
 * @return {ArrayView} - types array, either passed in or autoallocated
 */
export function readPixels(gl, {
  x,
  y,
  width = 1,
  height = 1,
  data,
  dataOffset = 0,
  type = GL.UNSIGNED_BYTE,
  sourceHeight,
  format = GL.RGBA
}) {
  // Read color in the central pixel, to be mapped with picking colors
  data = data || new Uint8Array(4 * width * height);
  // If source height is specified, a top left coordinate system is used
  y = sourceHeight ? sourceHeight - y : y;
  if (dataOffset) {
    assertWebGL2Context(gl);
    gl.readPixels(x, y, width, height, format, type, data, dataOffset);
  } else {
    gl.readPixels(x, y, width, height, format, type, data);
  }
  return data;
}

/**
 * Read pixels directly into webgl buffer
 * NOTE: WebGL2 only
 *
 * @param {WebGLRenderingContext} gl
 * @param {Object} options
 * @return {WebGLBuffer} the passed in buffer
 */
export function readPixelsToBuffer(gl, {
  x,
  y,
  width = 1,
  height = 1,
  buffer,
  dataOffset = 0,
  type = GL.UNSIGNED_BYTE,
  sourceHeight,
  format = GL.RGBA
}) {
  assertWebGL2Context(gl);

  // If source height is specified, a top left coordinate system is used
  y = sourceHeight ? sourceHeight - y : y;

  gl.bindBuffer(GL.PIXEL_PACK_BUFFER, buffer.handle);

  gl.readPixels(x, y, width, height, format, type, dataOffset);

  gl.bindBuffer(GL.PIXEL_PACK_BUFFER, null);

  return buffer;
}

/*
* @param {} opt.filter
 */
export function blitFramebuffer(gl, {
  source: [sourceX, sourceY, sourceWidth, sourceHeight],
  dest: [destX, destY, destWidth, destHeight],
  mask = GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT,
  filter = GL.LINEAR
}) {
}
