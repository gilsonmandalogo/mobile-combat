import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Level from '@src/level'

const scene = new THREE.Scene()

const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
document.body.appendChild(renderer.domElement)

const levelController = new Level()
const level = await levelController.loadLevel('Mayan-Temple')
scene.add(level.scene)

const camera = level.cameras[0] as THREE.PerspectiveCamera
camera.aspect = window.innerWidth / window.innerHeight
camera.updateProjectionMatrix()

const controls = new OrbitControls(camera, renderer.domElement)

window.addEventListener('resize', onWindowResize, false)

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  render()
}

function animate() {
  requestAnimationFrame(animate)

  controls.update()

  render()
}

function render() {
  renderer.render(scene, camera)
}

animate()
