import * as Phaser from "phaser";

const RADIUS = 16;
const FRICTION = 0.01;
const BOUNCE = 0.1;

const DROPPING_SECONDS = 1;
const INIT_BALL_Y = 40;
const MAX_COLOR = 4;

export default class Game extends Phaser.Scene {
  nextBall: Phaser.GameObjects.Image = null;
  isDropping: boolean = false;

  constructor() {
    super("game");
  }

  preload() {
    this.load.image("ball", "assets/sprites/pangball.png");
  }

  create() {
    this.matter.world.setBounds(0, 0, 360, 640, 32, true, true, false, true);

    // 最初のボール
    this.createNextBall();

    // クリックで落とす
    this.input.on("pointerdown", this.handlePointerdown, this);

    this.matter.world.on(
      "collisionstart",
      (event: any, bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType) => {
        // 壁との衝突は無視
        if (bodyA.gameObject === null || bodyB.gameObject === null) {
          return;
        }

        // ボール同士
        const ballA: Phaser.Physics.Matter.Image = bodyA.gameObject;
        const ballB: Phaser.Physics.Matter.Image = bodyB.gameObject;

        const colorA: number = ballA.getData("color");
        const colorB: number = ballB.getData("color");
        if (colorA === colorB) {
          const centerX = (ballA.x + ballB.x) / 2;
          const centerY = (ballA.y + ballB.y) / 2;

          // 既存のボールを削除
          ballA.setVisible(false);
          ballB.setVisible(false);
          this.matter.world.remove([ballA, ballB]);

          // 結合したボールを追加
          if (colorA === MAX_COLOR) {
            return;
          }

          const ball = this.createBall(centerX, centerY, colorA + 1);
        }
      },
      this
    );
  }

  update() {
    const pointer = this.input.activePointer;

    if (this.nextBall !== null) {
      this.nextBall.setPosition(pointer.x, INIT_BALL_Y);
    }
  }

  createNextBall() {
    const nextBallColor = Phaser.Math.Between(0, 2);

    let tint;
    let scale;

    switch (nextBallColor) {
      case 0:
        tint = 0xff0000;
        scale = 1;
        break;
      case 1:
        tint = 0xffff00;
        scale = 2;
        break;
      case 2:
        tint = 0x00ff00;
        scale = 3;
        break;
      case 3:
        tint = 0x00ffff;
        scale = 4;
        break;
      case 4:
        tint = 0x0000ff;
        scale = 5;
        break;
    }

    this.nextBall = this.add
      .image(160, INIT_BALL_Y, "ball")
      .setData("color", nextBallColor)
      .setTint(tint)
      .setScale(scale);
  }

  createBall(x: number, y: number, color: number) {
    let tint;
    let scale;

    switch (color) {
      case 0:
        tint = 0xff0000;
        scale = 1;
        break;
      case 1:
        tint = 0xffff00;
        scale = 2;
        break;
      case 2:
        tint = 0x00ff00;
        scale = 3;
        break;
      case 3:
        tint = 0x00ffff;
        scale = 4;
        break;
      case 4:
        tint = 0x0000ff;
        scale = 5;
        break;
    }

    const ball = this.matter.add
      .image(x, y, "ball")
      .setCircle(RADIUS)
      .setFriction(FRICTION)
      .setBounce(BOUNCE)

      .setData("color", color)
      .setTint(tint)
      .setScale(scale);

    return ball;
  }

  handlePointerdown() {
    if (this.isDropping) {
      return;
    }

    // ボールを実体化
    this.createBall(
      this.nextBall.x,
      this.nextBall.y,
      this.nextBall.getData("color")
    );

    this.nextBall.setVisible(false);
    this.nextBall = null;

    // 次のボールを出す
    this.isDropping = true;

    this.time.addEvent({
      delay: DROPPING_SECONDS * 1000,
      callback: function () {
        this.isDropping = false;
        this.createNextBall();
      },
      callbackScope: this,
    });
  }
}

const config = {
  type: Phaser.AUTO,
  backgroundColor: "#eeeeee",
  width: 360,
  height: 640,
  physics: {
    default: "matter",
    matter: {
      enableSleeping: true,
    },
  },
  scene: Game,
};

const game = new Phaser.Game(config);
