import * as THREE from 'three'
import type Hero from '@src/hero'
import type { HeroName } from '@src/hero'
import { getHeroClassByName } from '@src/utils'
import { updateDebug } from '@src/debug'
import { ErrorUndefinedProperty } from '@src/errors'

type InputType = 'keyboard' | 'touch'
type HitCallback = (player: Player) => void

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
  animations: Record<string, THREE.AnimationClip>
  playerName: string
  leftSide: boolean
  hitCallback: HitCallback
}

export default class Player {
  private _maxLife = 100
  public get maxLife() {
    return this._maxLife
  }

  private _life = this.maxLife
  public get life() {
    return this._life
  }
  public set life(value) {
    this._life = value
    updateDebug(`${this.playerName} life`, value)
    this.hitCallback(this)
  }

  private _hero?: Hero
  public get hero() {
    if (!this._hero) {
      throw new ErrorUndefinedProperty('hero')
    }

    return this._hero
  }

  private _ready = false
  public get ready() {
    return this._ready
  }

  private _enemy?: Player
  public get enemy() {
    if (!this._enemy) {
      throw new ErrorUndefinedProperty('enemy')
    }

    return this._enemy
  }
  public set enemy(value: Player) {
    this._enemy = value
  }

  private _playerName: string
  public get playerName() {
    return this._playerName
  }

  private _score = 0
  public get score() {
    return this._score
  }
  public set score(value) {
    this._score = value
    updateDebug(`${this.playerName} score`, value)
  }

  private velocityX = 0
  private velocityY = 0
  private inputs: Inputs
  private inputType: InputType
  private domElement: HTMLElement
  private heroName: HeroName
  private scene: THREE.Scene
  private animations: Record<string, THREE.AnimationClip>
  private animationMixer?: THREE.AnimationMixer
  private animationsActions: Record<string, THREE.AnimationAction> = {}
  private currentAnimation = 'Idle'
  private isPunching = false
  private isHitting = false
  private leftSide: boolean
  private hitCallback: HitCallback
  private boxCollider = {
    my: new THREE.Box3(),
    enemy: new THREE.Box3(),
  }
  private boxColliderHelper = {
    my: new THREE.Box3Helper(this.boxCollider.my, new THREE.Color('red')),
    enemy: new THREE.Box3Helper(this.boxCollider.enemy, new THREE.Color('red')),
  }

  constructor({
    heroName,
    inputs,
    inputType,
    domElement,
    scene,
    animations,
    playerName,
    leftSide,
    hitCallback,
  }: PlayerConstructor) {
    this.inputs = inputs
    this.inputType = inputType
    this.domElement = domElement
    this.heroName = heroName
    this.scene = scene
    this.animations = animations
    this._playerName = playerName
    this.leftSide = leftSide
    this.hitCallback = hitCallback

    this.life = this._life
  }

  public async loadData() {
    const heroClass = getHeroClassByName(this.heroName)
    this._hero = new heroClass({})
    const heroMesh = await this.hero.loadMesh()
    this.scene.add(heroMesh.scene)
    this.scene.add(this.boxColliderHelper.my)
    this.scene.add(this.boxColliderHelper.enemy)

    if (this.inputType === 'keyboard') {
      this.domElement.addEventListener('keydown', this.onKeyDown)
      this.domElement.addEventListener('keyup', this.onKeyUp)
    }

    this.animationMixer = new THREE.AnimationMixer(heroMesh.scene)

    this.animationMixer.addEventListener('finished', (e) => {
      if (
        e.action === this.animationsActions['PunchUp'] ||
        e.action === this.animationsActions['PunchDown']
      ) {
        this.changeAnimation('Idle')
        this.isPunching = false
        this.isHitting = false
      }
    })

    for (const [animationName, animationClip] of Object.entries(this.animations)) {
      const animationAction = this.animationMixer.clipAction(animationClip)
      this.animationsActions = {
        ...this.animationsActions,
        [animationName]: animationAction,
      }
    }

    this.animationsActions['WalkForward'].timeScale = 1.5
    this.animationsActions['WalkBackward'].timeScale = 1.1
    this.animationsActions['PunchUp'].clampWhenFinished = true
    this.animationsActions['PunchUp'].setLoop(THREE.LoopOnce, 1)
    this.animationsActions['PunchDown'].clampWhenFinished = true
    this.animationsActions['PunchDown'].setLoop(THREE.LoopOnce, 1)

    this.animationsActions[this.currentAnimation].play()

    this._ready = true
  }

  private changeAnimation(actionName: string) {
    if (actionName === this.currentAnimation) {
      return
    }

    this.isPunching = false

    this.animationsActions[this.currentAnimation].fadeOut(0.2)
    this.animationsActions[actionName].reset()
    this.animationsActions[actionName].fadeIn(0.2)
    this.animationsActions[actionName].play()
    this.currentAnimation = actionName
  }

  private canPunch() {
    return this.velocityX === 0 && this.isPunching === false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case this.inputs.left:
        this.changeAnimation(this.leftSide ? 'WalkBackward' : 'WalkForward')
        this.velocityX = -1
        break
      case this.inputs.right:
        this.changeAnimation(this.leftSide ? 'WalkForward' : 'WalkBackward')
        this.velocityX = 1
        break
      case this.inputs.jump:
        if (this.velocityY === 0) {
          this.velocityY = 1
        }
        break
      case this.inputs.attackUp:
        if (!this.canPunch()) {
          return
        }
        this.changeAnimation('PunchUp')
        this.isPunching = true
        break;
      case this.inputs.attackDown:
        if (!this.canPunch()) {
          return
        }
        this.changeAnimation('PunchDown')
        this.isPunching = true
        break
      default:
        break
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case this.inputs.left:
        if (this.velocityX === -1) {
          this.changeAnimation('Idle')
          this.velocityX = 0
        }
        break;
      case this.inputs.right:
        if (this.velocityX === 1) {
          this.changeAnimation('Idle')
          this.velocityX = 0
        }
        break;
      default:
        break;
    }
  }

  public hit(damage: number) {
    this.life -= damage
  }

  public update(delta: number) {
    if (!this.ready || !this.hero.ready || !this._enemy) {
      return
    }

    this.animationMixer!.update(delta)
    updateDebug(`${this.playerName} velocityX`, this.velocityX)

    const newPosition = new THREE.Vector3(this.velocityX * 0.1, this.velocityY * delta)
    this.hero.actor.position.add(newPosition)

    if (this.velocityY > 0) {
      this.velocityY = Math.max(this.velocityY - (9.8 * 2 * delta), 0)
    }

    if (this.isPunching) {
      this.boxCollider.enemy.setFromObject(this.enemy.hero.actor)

      for (const collider of this.hero.atttackMembersColliders) {
        this.boxCollider.my.setFromObject(collider)

        if (this.boxCollider.my.intersectsBox(this.boxCollider.enemy)) {
          if (!this.isHitting) {
            this.isHitting = true
            this.enemy.hit(this.hero.attackDamage)
            break
          }
        }
      }
    }
  }
}
