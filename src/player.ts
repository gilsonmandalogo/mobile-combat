import * as THREE from 'three'

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
  mesh: THREE.Object3D
  position: THREE.Vector3
  inputs: Inputs
  inputType: InputType
  domElement: HTMLElement
}

export default class Player {
  private _life = 100
  public get life() {
    return this._life
  }

  private _mesh: THREE.Object3D
  public get mesh() {
    return this._mesh
  }

  private velocityX = 0
  private velocityY = 0
  private inputs: Inputs

  constructor(props: PlayerConstructor) {
    const {
      mesh,
      position = new THREE.Vector3(),
      inputs,
      inputType,
      domElement,
    } = props

    mesh.position.copy(position)

    this._mesh = mesh
    this.inputs = inputs

    if (inputType === 'keyboard') {
      domElement.addEventListener('keydown', this.onKeyDown)
      domElement.addEventListener('keyup', this.onKeyUp)
    }
  }

  private onKeyDown(e: KeyboardEvent) {
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

  private onKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case this.inputs.left, this.inputs.right:
        this.velocityX = 0
        break;
      default:
        break;
    }
  }

  public hit(damage: number) {
    this._life -= damage
  }

  public update(delta: number) {
    const newPosition = new THREE.Vector3(this.velocityX, this.velocityY * delta)
    this._mesh.position.add(newPosition)

    if (this.velocityY > 0) {
      this.velocityY = Math.max(this.velocityY - (9.8 * 2 * delta), 0)
    }
  }
}
