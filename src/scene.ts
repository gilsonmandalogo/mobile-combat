import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Game from '@src/game'
import { contextStore } from '@stores/context'
import { getLevelClassByName } from '@src/utils'

const scene = new THREE.Scene()
contextStore.setKey('scene', scene)

const renderer = new THREE.WebGLRenderer()
contextStore.setKey('canvas', renderer.domElement)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.tabIndex = 0
document.body.appendChild(renderer.domElement)

const levelClass = getLevelClassByName('Mayan-Temple')
const levelController = new levelClass()
const level = await levelController.loadLevel()
scene.add(level.scene)

const camera = level.cameras[0] as THREE.PerspectiveCamera
camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()

const gameController = new Game({
  roundTime: 90,
})
await gameController.init()

const controls = new OrbitControls(camera, renderer.domElement)

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
  levelController.update(delta)

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
