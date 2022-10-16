import * as THREE from 'three'
import type Hero from '@src/hero'
import type { HeroName } from '@src/hero'
import { getHeroClassByName } from '@src/utils'
import { updateDebug } from '@src/debug'

type InputType = 'keyboard' | 'touch'

interface Inputs {
  left: string
  right: string
  jump: string
  attackUp: string
  attackDown: string
  block: string
}

interface PlayerConstructor {
  heroName: HeroName
  inputs: Inputs
  inputType: InputType
  domElement: HTMLElement
  scene: THREE.Scene
}

export default class Player {
  private _life = 100
  public get life() {
    return this._life
  }

  private _hero?: Hero
  public get hero() {
    return this._hero
  }

  private _ready = false
  public get ready() {
    return this._ready
  }

  private velocityX = 0
  private velocityY = 0
  private inputs: Inputs
  private inputType: InputType
  private domElement: HTMLElement
  private heroName: HeroName
  private scene: THREE.Scene

  constructor({
    heroName,
    inputs,
    inputType,
    domElement,
    scene,
  }: PlayerConstructor) {
    this.inputs = inputs
    this.inputType = inputType
    this.domElement = domElement
    this.heroName = heroName
    this.scene = scene

    this.loadData()
  }

  private loadData = async () => {
    const heroClass = getHeroClassByName(this.heroName)
    this._hero = new heroClass({})
    const heroMesh = await this._hero.loadMesh()
    this.scene.add(heroMesh.scene)

    if (this.inputType === 'keyboard') {
      this.domElement.addEventListener('keydown', this.onKeyDown)
      this.domElement.addEventListener('keyup', this.onKeyUp)
    }

    this._ready = true
  }

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case this.inputs.left:
        this.velocityX = -1
        break;
      case this.inputs.right:
        this.velocityX = 1
        break;
      case this.inputs.jump:
        if (this.velocityY === 0) {
          this.velocityY = 1
        }
        break;
      default:
        break;
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case this.inputs.left:
      case this.inputs.right:
        this.velocityX = 0
        break;
      default:
        break;
    }
  }

  public hit = (damage: number) => {
    this._life -= damage
  }

  public update = (delta: number) => {
    if (!this.ready) {
      return
    }

    updateDebug('velocityX', this.velocityX)

    const newPosition = new THREE.Vector3(this.velocityX, this.velocityY * delta)
    this._hero!.position.add(newPosition)

    if (this.velocityY > 0) {
      this.velocityY = Math.max(this.velocityY - (9.8 * 2 * delta), 0)
    }
  }
}
