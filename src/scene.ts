import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Game from '@src/game'
import { Shell } from '@src/ui/shell'
import { contextStore } from '@stores/context'
import MayanTempleLevel from '@levels/mayanTemple'

const scene = new THREE.Scene()
scene.background = new THREE.Color('#07060a')
contextStore.setKey('scene', scene)

const renderer = new THREE.WebGLRenderer()
contextStore.setKey('canvas', renderer.domElement)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.tabIndex = 0
renderer.domElement.dataset.testid = 'game-canvas'
document.body.appendChild(renderer.domElement)

let camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
)
camera.position.set(0, 2.2, 8.5)
camera.lookAt(0, 1.1, 0)

let levelController: MayanTempleLevel | null = null
let arenaPromise: Promise<void> | null = null

function enterArena(): Promise<void> {
  if (!arenaPromise) {
    arenaPromise = mountTemple()
  }
  return arenaPromise
}

async function mountTemple() {
  levelController = new MayanTempleLevel()
  const model = await levelController.loadLevel()
  scene.add(model.scene)
  const embedded = model.cameras[0]
  if (embedded instanceof THREE.PerspectiveCamera) {
    embedded.aspect = window.innerWidth / window.innerHeight
    embedded.updateProjectionMatrix()
    camera = embedded
  }
}

const gameController = new Game({
  roundTime: 60,
  enterArena,
})
const shell = new Shell(gameController)
gameController.attachShell(shell)
await gameController.init()

const controls = new OrbitControls(camera, renderer.domElement)
controls.enabled = false

window.addEventListener('resize', onWindowResize, false)

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  render()
}

const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)

  const delta = clock.getDelta()

  controls.update()
  gameController.update(delta)
  levelController?.update(delta)

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
