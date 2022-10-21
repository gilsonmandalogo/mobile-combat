import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Level from '@src/level'
import Player from '@src/player'
import type { HeroName } from '@src/hero'
import Animations from '@src/animations'

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

const animationController = new Animations()
await animationController.loadAnimations()

const player1 = new Player({
  playerName: 'Player 1',
  domElement: renderer.domElement,
  heroName: 'Mr Colin Cole' as HeroName,
  inputType: 'keyboard',
  scene,
  animations: animationController.animations,
  inputs: {
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    attackUp: 'KeyG',
    attackDown: 'KeyV',
    block: 'KeyY',
  },
})

const player2 = new Player({
  playerName: 'Player 2',
  domElement: renderer.domElement,
  heroName: 'Mr Colin Cole' as HeroName,
  inputType: 'keyboard',
  scene,
  animations: animationController.animations,
  inputs: {
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ControlRight',
    attackUp: 'Equal',
    attackDown: 'BracketRight',
    block: 'Backslash',
  },
})

player1.enemy = player2
player2.enemy = player1

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
  player1.update(delta)
  player2.update(delta)

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
