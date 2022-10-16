import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export enum HeroName {
  MrColinCole = 'Mr Colin Cole',
}

export interface HeroConstructor {
  attackDamage?: number
  blockPower?: number
  name: string
}

export default class Hero {
  private _attackDamage: number
  public get attackDamage(): number {
    return this._attackDamage
  }
  public set attackDamage(value: number) {
    this._attackDamage = value
  }

  private _blockPower: number
  public get blockPower(): number {
    return this._blockPower
  }
  public set blockPower(value: number) {
    this._blockPower = value
  }

  private _name: string
  public get name(): string {
    return this._name
  }
  public set name(value: string) {
    this._name = value
  }

  private _position = new THREE.Vector3()
  public get position(): THREE.Vector3 {
    return this._position
  }
  public set position(value: THREE.Vector3) {
    this._position = value
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

  public loadMesh = async () => {
    const loader = new GLTFLoader()
    const model = await loader.loadAsync(`assets/models/${this.name.replaceAll(' ', '-')}.glb`)
    model.scene.traverse(child => {
      if (child instanceof THREE.Mesh && child.isMesh) {
        child.receiveShadow = true
        child.castShadow = true
      }
    })
    this._position = model.scene.children[0].position
    return model
  }
}
