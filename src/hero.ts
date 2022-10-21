import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { ErrorUndefinedProperty } from '@src/errors'

export enum HeroName {
  MrColinCole = 'Mr Colin Cole',
}

export interface HeroConstructor {
  attackDamage?: number
  blockPower?: number
  name: string
}

export default class Hero {
  protected _ready = false
  public get ready() {
    return this._ready
  }

  private _attackDamage: number
  public get attackDamage() {
    return this._attackDamage
  }

  private _blockPower: number
  public get blockPower() {
    return this._blockPower
  }

  private _name: string
  public get name(): string {
    return this._name
  }

  private _mesh?: THREE.Mesh
  public get mesh() {
    if (!this._mesh) {
      throw new ErrorUndefinedProperty('mesh')
    }

    return this._mesh
  }

  private _actor?: THREE.Group
  public get actor() {
    if (!this._actor) {
      throw new ErrorUndefinedProperty('actor')
    }

    return this._actor
  }

  protected _atttackMembersColliders: Array<THREE.Mesh> = []
  public get atttackMembersColliders() {
    return this._atttackMembersColliders
  }

  constructor({
    attackDamage = 5,
    blockPower = 1,
    name,
  }: HeroConstructor) {
    this._attackDamage = attackDamage
    this._blockPower = blockPower
    this._name = name
  }

  public async loadMesh() {
    const loader = new GLTFLoader()
    const model = await loader.loadAsync(`assets/models/${this.name.replaceAll(' ', '-')}.glb`)

    model.scene.traverse(child => {
      if (child instanceof THREE.Mesh && child.isMesh) {
        if (!this._mesh) {
          this._mesh = child
        }

        child.receiveShadow = true
        child.castShadow = true
      }
    })

    this._actor = model.scene
    return model
  }
}
