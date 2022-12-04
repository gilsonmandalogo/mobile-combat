import * as THREE from 'three'
import vertexShader from './vertex.glsl?raw'
import fragmentShader from './fragment.glsl?raw'

interface FireParticleSystemConstructor {
  camera: THREE.PerspectiveCamera
  parent: THREE.Object3D
}

export default class FireParticleSystem {
  private material: THREE.ShaderMaterial
  private camera: THREE.PerspectiveCamera
  private particles: Array<{
    position: THREE.Vector3,
    size: number,
    colour: THREE.Color,
    alpha: number,
    life: number,
    maxLife: number,
    rotation: number,
    velocity: THREE.Vector3,
    currentSize?: number,
  }> = []
  private geometry = new THREE.BufferGeometry()
  private points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  private alphaSpline = new LinearSpline<number>((t, a, b) => {
    return a + t * (b - a)
  })
  private colourSpline = new LinearSpline<THREE.Color>((t, a, b) => {
    const c = a.clone()
    return c.lerp(b, t)
  })
  private sizeSpline = new LinearSpline<number>((t, a, b) => {
    return a + t * (b - a)
  })
  private gdfsghk = 0

  constructor(params: FireParticleSystemConstructor) {
    const uniforms = {
      diffuseTexture: {
        value: new THREE.TextureLoader().load('assets/textures/fire.png')
      },
      pointMultiplier: {
        value: window.innerHeight / (2.0 * Math.tan(0.5 * 120.0 * Math.PI / 180.0))
      }
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      vertexColors: true
    })

    this.camera = params.camera

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3))
    this.geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1))
    this.geometry.setAttribute('colour', new THREE.Float32BufferAttribute([], 4))
    this.geometry.setAttribute('angle', new THREE.Float32BufferAttribute([], 1))

    this.points = new THREE.Points(this.geometry, this.material)

    const base = new THREE.Object3D()
    base.position.set(0.9, 0.9, 0.9)
    base.add(this.points)
    params.parent.add(base)

    this.alphaSpline.addPoint(0.0, 0.0)
    this.alphaSpline.addPoint(0.1, 1.0)
    this.alphaSpline.addPoint(0.6, 1.0)
    this.alphaSpline.addPoint(1.0, 0.0)

    this.colourSpline.addPoint(0.0, new THREE.Color(0xFFFF80))
    this.colourSpline.addPoint(1.0, new THREE.Color(0xFF8080))

    this.sizeSpline.addPoint(0.0, 1.0)
    this.sizeSpline.addPoint(0.5, 5.0)
    this.sizeSpline.addPoint(1.0, 1.0)

    this.updateGeometry()
  }

  private addParticles(timeElapsed: number) {
    this.gdfsghk += timeElapsed
    const n = Math.floor(this.gdfsghk * 75.0)
    this.gdfsghk -= n / 75.0

    for (let i = 0; i < n; i++) {
      const life = (Math.random() * 0.75 + 0.25) * 1.4
      this.particles.push({
        position: new THREE.Vector3(
          (Math.random() * 0.2 - 1) * 1.0,
          (Math.random() * 0.2 - 1) * 1.0,
          (Math.random() * 0.2 - 1) * 1.0),
        size: (Math.random() * 0.5 + 0.5) * 1.8,
        colour: new THREE.Color(),
        alpha: 1.0,
        life: life,
        maxLife: life,
        rotation: Math.random() * 2.0 * Math.PI,
        velocity: new THREE.Vector3(0, 1.2, 0),
      })
    }
  }

  private updateGeometry() {
    const positions = []
    const sizes = []
    const colours = []
    const angles = []

    for (const p of this.particles) {
      positions.push(p.position.x, p.position.y, p.position.z)
      colours.push(p.colour.r, p.colour.g, p.colour.b, p.alpha)
      sizes.push(p.currentSize || 0)
      angles.push(p.rotation)
    }

    this.geometry.setAttribute(
      'position', new THREE.Float32BufferAttribute(positions, 3))
    this.geometry.setAttribute(
      'size', new THREE.Float32BufferAttribute(sizes, 1))
    this.geometry.setAttribute(
      'colour', new THREE.Float32BufferAttribute(colours, 4))
    this.geometry.setAttribute(
      'angle', new THREE.Float32BufferAttribute(angles, 1))

    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.size.needsUpdate = true
    this.geometry.attributes.colour.needsUpdate = true
    this.geometry.attributes.angle.needsUpdate = true
  }

  private updateParticles(timeElapsed: number) {
    for (const p of this.particles) {
      p.life -= timeElapsed
    }

    this.particles = this.particles.filter(p => {
      return p.life > 0.0
    })

    for (const p of this.particles) {
      const t = 1.0 - p.life / p.maxLife

      p.rotation += timeElapsed * 0.5
      p.alpha = this.alphaSpline.get(t)
      p.currentSize = p.size * this.sizeSpline.get(t)
      p.colour.copy(this.colourSpline.get(t))

      p.position.add(p.velocity.clone().multiplyScalar(timeElapsed))

      const drag = p.velocity.clone()
      drag.multiplyScalar(timeElapsed * 0.1)
      drag.x = Math.sign(p.velocity.x) * Math.min(Math.abs(drag.x), Math.abs(p.velocity.x))
      drag.y = Math.sign(p.velocity.y) * Math.min(Math.abs(drag.y), Math.abs(p.velocity.y))
      drag.z = Math.sign(p.velocity.z) * Math.min(Math.abs(drag.z), Math.abs(p.velocity.z))
      p.velocity.sub(drag)
    }

    this.particles.sort((a, b) => {
      const d1 = this.camera.position.distanceTo(a.position)
      const d2 = this.camera.position.distanceTo(b.position)

      if (d1 > d2) {
        return -1
      }

      if (d1 < d2) {
        return 1
      }

      return 0
    })
  }

  public update(timeElapsed: number) {
    this.addParticles(timeElapsed)
    this.updateParticles(timeElapsed)
    this.updateGeometry()
  }
}

type Lerp<T> = (a: number, b: T, c: T) => T

class LinearSpline<T> {
  private points: Array<[number, T]> = []
  private lerp: Lerp<T>

  constructor(lerp: Lerp<T>) {
    this.lerp = lerp
  }

  public addPoint(t: number, d: T) {
    this.points.push([t, d])
  }

  public get(t: number) {
    let p1 = 0

    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i][0] >= t) {
        break
      }
      p1 = i
    }

    const p2 = Math.min(this.points.length - 1, p1 + 1)

    if (p1 == p2) {
      return this.points[p1][1]
    }

    return this.lerp(
      (t - this.points[p1][0]) / (
        this.points[p2][0] - this.points[p1][0]),
      this.points[p1][1], this.points[p2][1])
  }
}
