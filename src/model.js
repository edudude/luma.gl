// A scenegraph object node
/* eslint-disable guard-for-in */

// Define some locals
import {MAX_TEXTURES} from './config';
import Object3D from './scenegraph/object-3d';
import {Buffer, VertexAttributes, draw, Texture2D} from './webgl';
import {splat} from './utils';
import log from './log';
import assert from 'assert';

// TODO - experimental, not yet used
export class Material {
  constructor({shininess = 0, reflection = 0, refraction = 0} = {}) {
    this.shininess = shininess;
    this.reflection = reflection;
    this.refraction = refraction;
  }
}

// Model abstract O3D Class
export default class Model extends Object3D {

  /* eslint-disable max-statements  */
  /* eslint-disable complexity  */
  constructor({
    program,
    geometry,
    material = null,
    textures = [],
    // Enable instanced rendering (requires shader support and extra attributes)
    instanced = false,
    instanceCount = 0,
    vertexCount = undefined,
    isIndexed = undefined,
    // Picking
    pickable = false, pick = null,
    // Extra uniforms and attributes (beyond geometry, material, camera)
    uniforms = {},
    attributes = {},
    render = null, onBeforeRender = null, onAfterRender = null,
    ...opts
  } = {}) {
    // assert(program || program instanceof Program);
    assert(program);
    assert(geometry);

    super(opts);

    // set a custom program per o3d
    this.program = program;
    this.geometry = geometry;
    this.material = material;

    // instanced rendering
    this.instanced = instanced;
    this.instanceCount = instanceCount;
    this.vertexCount = vertexCount;
    this.isIndexed = isIndexed === undefined ?
      Boolean(this.geometry.indices) : isIndexed;

    // picking options
    this.pickable = Boolean(pickable);
    this.pick = pick || (() => false);

    // extra uniforms and attribute descriptors
    this.uniforms = uniforms;
    this.attributes = attributes;

    // override the render method, before and after render callbacks
    this.render = render || this.render;
    this.onBeforeRender = onBeforeRender || this.onBeforeRender;
    this.onAfterRender = onAfterRender || this.onAfterRender;

    this.buffers = {};
    this.userData = {};

    this.textures = splat(textures);

    // TODO - remove?
    this.dynamic = false;

    Object.seal(this);

    this._createBuffersFromAttributeDescriptors(this.geometry.getAttributes());
  }
  /* eslint-enable max-statements */
  /* eslint-enable complexity */

  get hash() {
    return this.id + ' ' + this.$pickingIndex;
  }

  setInstanceCount(instanceCount) {
    assert(instanceCount !== undefined);
    this.instanceCount = instanceCount;
    return this;
  }

  getInstanceCount() {
    return this.instanceCount;
  }

  setVertexCount(vertexCount) {
    this.vertexCount = vertexCount;
    return this;
  }

  getVertexCount() {
    return this.vertexCount === undefined ?
      this.geometry.getVertexCount() : this.vertexCount;
  }

  isPickable() {
    return this.pickable;
  }

  setPickable(pickable = true) {
    this.pickable = Boolean(pickable);
    return this;
  }

  getProgram() {
    return this.program;
  }

  getGeometry() {
    return this.geometry;
  }

  getAttributes() {
    return this.attributes;
  }

  setAttributes(attributes = {}) {
    Object.assign(this.attributes, attributes);
    this._createBuffersFromAttributeDescriptors(attributes);
    return this;
  }

  getUniforms() {
    return this.uniforms;
  }

  setUniforms(uniforms = {}) {
    this._checkUniforms(uniforms);
    Object.assign(this.uniforms, uniforms);
    return this;
  }

  setTextures(textures = []) {
    assert(textures.every(tex => tex instanceof Texture2D), 'setTextures');
    this.textures = textures;
    return this;
  }

  onBeforeRender() {
    const {program, attributes} = this;
    program.use();
    this.setAttributes(attributes);
    return this;
  }

  /*
   * @param {Camera} opt.camera=
   * @param {Camera} opt.viewMatrix=
   */
  render({camera, viewMatrix} = {}) {
    // Camera exposes uniforms that can be used directly in shaders
    if (camera) {
      this.setUniforms(camera.getUniforms());
    }
    if (viewMatrix) {
      this.setUniforms(this.getCoordinateUniforms(viewMatrix));
    }

    this._log();

    this.setProgramState();

    const {gl} = this.program;
    const {geometry, instanced, instanceCount} = this;
    draw(gl, {
      drawMode: geometry.drawMode,
      vertexCount: this.getVertexCount(),
      indexed: this.isIndexed,
      instanced,
      instanceCount
    });

    return this;
  }

  onAfterRender() {
    const {program, attributes} = this;
    program.use();
    // TODO - how about geometry?
    // Is there a perf penalty to always detaching?
    this.unsetProgramState(attributes);
    return this;
  }

  setProgramState() {
    const {program} = this;
    program.setUniforms(this.uniforms);
    program.setBuffers(this.buffers);
    this.bindTextures();
    return this;
  }

  unsetProgramState() {
    const {program} = this;
    const gl = program.gl;

    // unbind the array and element buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    const attributes = program.attributes;
    for (const name in attributes) {
      gl.disableVertexAttribArray(attributes[name]);
    }
    return this;
  }

  // Makes sure buffers are created for all attributes
  // and that the program is updated with those buffers
  // TODO - do we need the separation between "attributes" and "buffers"
  // couldn't apps just create buffers directly?
  _createBuffersFromAttributeDescriptors(attributes) {
    const {program: {gl}} = this;

    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];

      this.buffers[attributeName] =
        this.buffers[attributeName] || new Buffer(gl);

      const buffer = this.buffers[attributeName];
      buffer.setData({
        ...attribute,
        data: attribute.value
      });
    }

    return this;
  }

  bindTextures(force = false) {
    const {program} = this;
    this.textures = this.textures ? splat(this.textures) : [];
    let tex2D = 0;
    let texCube = 0;
    const mtexs = MAX_TEXTURES;
    const texs = this.textures;
    const l = texs.length;
    for (let i = 0; i < mtexs; i++) {
      if (i < l) {
        // rye TODO: update this when TextureCube is implemented.
        // const isCube = app.textureMemo[texs[i]].isCube;
        // if (isCube) {
        // program.setUniform('hasTextureCube' + (i + 1), true);
        // program.setTexture(texs[i], gl['TEXTURE' + i]);
        // program.setUniform('samplerCube' + (texCube + 1), i);
        // texCube++;
        // } else {
        program.setTexture(texs[i], tex2D);
        program.setUniforms({
          [`hasTexture${i + 1}`]: true,
          [`sampler${tex2D + 1}`]: i
        });
        tex2D++;
      } else {
        program.setUniforms({
          [`hasTextureCube${i + 1}`]: false,
          [`hasTexture${i + 1}`]: false,
          [`sampler${++tex2D}`]: i,
          [`samplerCube${++texCube}`]: i
        });
      }
    }
    return this;
  }

  // TODO - Move into uniforms manager
  _checkUniforms(uniformMap) {
    for (const key in uniformMap) {
      const value = uniformMap[key];
      this._checkUniformValue(key, value);
    }
    return this;
  }

  _checkUniformValue(uniform, value) {
    function isNumber(v) {
      return !isNaN(v) && Number(v) === v && v !== undefined;
    }

    let ok = true;
    if (Array.isArray(value) || value instanceof Float32Array) {
      for (const element of value) {
        if (!isNumber(element)) {
          ok = false;
        }
      }
    } else if (!isNumber(value)) {
      ok = false;
    }
    if (!ok) {
      /* eslint-disable no-console */
      /* global console */
      // Value could be unprintable so write the object on console
      console.error(`${this.id} Bad uniform ${uniform}`, value);
      /* eslint-enable no-console */
      throw new Error(`${this.id} Bad uniform ${uniform}`);
    }
    return this;
  }

  _log() {
    if (log.priority >= 3) {
      let table = this._getAttributesTable(this.geometry.attributes, {
        header: `Attributes for ${this.geometry.id}`,
        program: this.program
      });
      table = this._getAttributesTable(this.attributes, {
        table,
        program: this.program
      });
      log.table(3, table);

      table = this._getUniformsTable(this.uniforms, {
        header: `Uniforms for ${this.geometry.id}`
      });
      log.table(3, table);
    }
  }

  // Todo move to attributes manager
  _getAttributesTable(attributes, {
      header = 'Attributes',
      table = null,
      program
    } = {}) {
    assert(program);
    const {gl} = program;

    table = table || {[header]: {}};
    for (const attributeName in attributes) {
      const attribute = attributes[attributeName];
      let location = program && program.attributeLocations[attributeName];
      if (location === undefined &&
        attribute.bufferType === gl.ELEMENT_ARRAY_BUFFER) {
        location = 'ELEMENT_ARRAY_BUFFER';
      }
      table = table || {};
      table[attributeName] = {
        Name: attribute.value.constructor.name,
        Instanced: attribute.instanced,
        Verts: attribute.value.length / attribute.size,
        Size: attribute.size,
        Bytes: attribute.value.length * attribute.value.BYTES_PER_ELEMENT,
        Location: location
      };
    }
    return table;
  }

  // TODO - Move to uniforms manager
  _getUniformsTable(uniforms, {header = 'Uniforms', table = null} = {}) {
    table = table || {[header]: {}};
    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];
      table[uniformName] = {
        Type: uniform,
        Value: uniform.toString()
      };
    }
    return table;
  }
}