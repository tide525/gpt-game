import * as Phaser from "phaser";

const MAX_RADIUS = 120;
const IMAGE_RADIUS = 160;

const FRICTION = 0.01;
const BOUNCE = 0.1;

const DROPPING_SECONDS = 1;
const INIT_BALL_Y = 40;

// GPT族のパラメータ数
// 後半は噂でしかないから適当
const PARAMS = [0.117, 1.5, 175, 355, 1000];

const TEXTURES = ["ball1", "ball2", "ball3", "ball4", "ball5"];

function expWeightedRandom(n: number) {
  const weights = [];
  for (let i = 0; i < n; i++) {
    const weight = Math.pow(2, -i);
    weights.push(weight);
  }
  const sumWeights = weights.reduce((acc, weight) => acc + weight, 0);

  const r = Math.random() * sumWeights;

  let cumWeights = 0;
  for (let i = 0; i < n; i++) {
    cumWeights += weights[i];
    if (r <= cumWeights) {
      return i;
    }
  }
}

export default class Game extends Phaser.Scene {
  nextBall: Phaser.GameObjects.Image = null;
  isDropping: boolean = false;
  maxColor: number = 0;

  constructor() {
    super("game");
  }

  preload() {
    for (const texture of TEXTURES) {
      this.load.image(texture, `assets/sprites/${texture}.png`);
    }
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
          if (colorA === PARAMS.length) {
            return;
          }

          const newColor = colorA + 1;
          const ball = this.createBall(centerX, centerY, newColor);

          if (newColor > this.maxColor) {
            this.maxColor = newColor;
          }
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

  calcScales() {
    // スイカは球だし、球を想定して三乗根をかけてみる
    const cbrtParams = PARAMS.map((param, index) => Math.cbrt(param));

    // [0,1]に収める
    const maxCbrtParam = Math.max(...cbrtParams);
    const normCbrtParams = cbrtParams.map(
      (cbrtParam, index) => cbrtParam / maxCbrtParam
    );

    const scales = normCbrtParams.map(
      (normCbrtParam, index) => normCbrtParam * (MAX_RADIUS / IMAGE_RADIUS)
    );

    return scales;
  }

  createNextBall() {
    const nextBallColor = expWeightedRandom(Math.max(this.maxColor, 1));

    const texture = TEXTURES[nextBallColor];
    const scale = this.calcScales()[nextBallColor];

    this.nextBall = this.add
      .image(160, INIT_BALL_Y, texture)

      .setData("color", nextBallColor)
      .setScale(scale);
  }

  createBall(x: number, y: number, color: number) {
    const texture = TEXTURES[color];
    const scale = this.calcScales()[color];

    const ball = this.matter.add
      .image(x, y, texture)

      .setCircle(IMAGE_RADIUS)
      .setFriction(FRICTION)
      .setBounce(BOUNCE)

      .setData("color", color)
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
