import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { arenaById } from '@src/content/catalog'
import Game from '@src/game'
import { Shell } from '@src/ui/shell'
import { contextStore } from '@stores/context'
import { mountArena } from '@src/view/arena'
import type { ArenaView } from '@src/view/arena'

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

const fallbackCamera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
)
fallbackCamera.position.set(0, 2.4, 9.2)
fallbackCamera.lookAt(0, 1.1, 0)
let camera: THREE.PerspectiveCamera = fallbackCamera
let arenaView: ArenaView | null = null

async function enterArena(id: string): Promise<void> {
  const def = arenaById(id)
  arenaView?.dispose()
  arenaView = await mountArena(def, scene)
  if (arenaView.camera) {
    arenaView.camera.aspect = window.innerWidth / window.innerHeight
    arenaView.camera.updateProjectionMatrix()
    camera = arenaView.camera
    return
  }
  fallbackCamera.aspect = window.innerWidth / window.innerHeight
  fallbackCamera.position.set(0, 2.4, 9.2)
  fallbackCamera.lookAt(0, 1.1, 0)
  fallbackCamera.updateProjectionMatrix()
  camera = fallbackCamera
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
  arenaView?.update(delta)

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
