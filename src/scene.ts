import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Level from '@src/level'
import Player from '@src/player'
import type { HeroName } from '@src/hero'

const scene = new THREE.Scene()

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.domElement.tabIndex = 0
document.body.appendChild(renderer.domElement)

const levelController = new Level()
const level = await levelController.loadLevel('Mayan-Temple')
scene.add(level.scene)

const camera = level.cameras[0] as THREE.PerspectiveCamera
camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()

const player = new Player({
  domElement: renderer.domElement,
  heroName: 'Mr Colin Cole' as HeroName,
  inputType: 'keyboard',
  scene,
  inputs: {
    left: 'a',
    right: 'd',
    jump: ' ',
    attackUp: 'g',
    attackDown: 'v',
    block: 'y',
  },
})

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
  player.update(delta)

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
