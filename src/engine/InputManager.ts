export type PointerState = {
  x: number;
  y: number;
  isDown: boolean;
  justPressed: boolean;
  justReleased: boolean;
};

export class InputManager {
  private readonly keys = new Set<string>();
  private pointer: PointerState = {
    x: 0,
    y: 0,
    isDown: false,
    justPressed: false,
    justReleased: false,
  };

  private keyDownHandler = (event: KeyboardEvent) => {
    this.keys.add(event.code);
  };

  private keyUpHandler = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private pointerDownHandler = (event: PointerEvent) => {
    this.pointer.isDown = true;
    this.pointer.justPressed = true;
    this.updatePointerPosition(event);
  };

  private pointerUpHandler = (event: PointerEvent) => {
    this.pointer.isDown = false;
    this.pointer.justReleased = true;
    this.updatePointerPosition(event);
  };

  private pointerMoveHandler = (event: PointerEvent) => {
    this.updatePointerPosition(event);
  };

  bind() {
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("pointerdown", this.pointerDownHandler);
    window.addEventListener("pointerup", this.pointerUpHandler);
    window.addEventListener("pointermove", this.pointerMoveHandler);
  }

  unbind() {
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    window.removeEventListener("pointerdown", this.pointerDownHandler);
    window.removeEventListener("pointerup", this.pointerUpHandler);
    window.removeEventListener("pointermove", this.pointerMoveHandler);
  }

  updateFrame() {
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
  }

  isKeyDown(code: string) {
    return this.keys.has(code);
  }

  getPointer() {
    return { ...this.pointer };
  }

  private updatePointerPosition(event: PointerEvent) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
  }
}

