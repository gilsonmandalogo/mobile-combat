import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { ErrorUndefinedProperty } from '@src/errors'
import { assetUrl } from '@src/utils'

export enum HeroName {
  MrColinCole = 'Mr Colin Cole',
}

export interface HeroConstructor {
  name: string
}

export default abstract class Hero {
  protected _ready = false
  public get ready() {
    return this._ready
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

  constructor({ name }: HeroConstructor) {
    this._name = name
  }

  public async loadMesh() {
    const loader = new GLTFLoader()
    const model = await loader.loadAsync(assetUrl(`assets/models/${this.name.replaceAll(' ', '-')}.glb`))

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
