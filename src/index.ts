import * as Phaser from "phaser";

const WIDTH = 360;
const HEIGHT = 640;

const SCORE_MARGIN = 20;

const INIT_BALL_Y = 80;
const DROPPING_SECONDS = 1;

const IMAGE_RADIUS = 160;
const MAX_RADIUS = 120;
const FRICTION = 0.01;
const BOUNCE = 0.1;

const UPPER_BOUND_Y = 100;

// GPT族のパラメータ数
// 後半は噂でしかないから適当
const PARAMS = [0.117, 1.5, 175, 355, 1000];

const TEXTURES = ["gpt", "gpt2", "gpt3", "gpt3_5", "gpt4"];

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
  scales: number[];
  nextBall: Phaser.GameObjects.Image;

  isDropping: boolean = false;

  currentBalls: Phaser.Physics.Matter.Image[] = [];
  maxLevel: number = 0;

  score: number = 0;
  scoreText: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  preload() {
    for (const texture of TEXTURES) {
      this.load.image(texture, `assets/sprites/${texture}.png`);
    }
  }

  create() {
    this.scales = this.calcScales();

    this.add.rectangle(
      WIDTH / 2,
      UPPER_BOUND_Y / 2,
      WIDTH,
      UPPER_BOUND_Y,
      0x202123
    );
    this.add.rectangle(
      WIDTH / 2,
      (HEIGHT - UPPER_BOUND_Y) / 2 + UPPER_BOUND_Y,
      WIDTH,
      HEIGHT - UPPER_BOUND_Y,
      0xf7f7f8
    );

    // 操作説明
    this.scoreText = this.add
      .text(WIDTH / 2, HEIGHT / 2, "クリックでGPTを落とす")
      .setColor("#111827")
      .setAlpha(0.5)
      .setOrigin(0.5, 0.5);
    this.scoreText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + UPPER_BOUND_Y, "同じGPTがぶつかると進化")
      .setColor("#111827")
      .setAlpha(0.5)
      .setOrigin(0.5, 0.5);

    // スコア表示
    this.add
      .text(SCORE_MARGIN, SCORE_MARGIN, "スコア")
      .setColor("#ececf1")
      .setOrigin(0, 0);
    this.scoreText = this.add
      .text(WIDTH - SCORE_MARGIN, SCORE_MARGIN, `${this.score}パラメータ`)
      .setColor("#ececf1")
      .setOrigin(1, 0);
    this.add
      .text(SCORE_MARGIN, UPPER_BOUND_Y, "メモリここまで↓")
      .setColor("#ececf1")
      .setOrigin(0, 1);

    this.matter.world.setBounds(
      0,
      0,
      WIDTH,
      HEIGHT,
      32,
      true,
      true,
      false,
      true
    );

    // 最初のボール
    this.createNextBall();

    // クリックで落とす
    this.input.on("pointerup", this.handlePointerup, this);

    this.matter.world.on("collisionstart", this.handleCollision, this);
  }

  update() {
    this.updateNextBall();
    this.scoreText.setText(`${this.score}パラメータ`);
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

  handleCollision(
    event: any,
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType
  ) {
    // 壁との衝突は無視
    if (bodyA.gameObject === null || bodyB.gameObject === null) {
      return;
    }

    // ボール同士
    const ballA: Phaser.GameObjects.Image = bodyA.gameObject;
    const ballB: Phaser.GameObjects.Image = bodyB.gameObject;

    const levelA: number = ballA.getData("level");
    const levelB: number = ballB.getData("level");
    if (levelA !== levelB) {
      return;
    }

    const centerX = (ballA.x + ballB.x) / 2;
    const centerY = (ballA.y + ballB.y) / 2;

    // 既存のボールを削除
    this.score += PARAMS[levelA] * 1000000000;

    this.matter.world.remove([ballA, ballB]);
    ballA.setVisible(false);
    ballB.setVisible(false);

    // 結合したボールを追加
    if (levelA === PARAMS.length - 1) {
      return;
    }
    this.createBall(centerX, centerY, levelA + 1);
  }

  createNextBall() {
    // 今ある最大よりも一回り小さいボール
    const nextBallLevel = expWeightedRandom(Math.max(this.maxLevel, 1));

    const texture = TEXTURES[nextBallLevel];
    const scale = this.scales[nextBallLevel];

    this.nextBall = this.add
      .image(WIDTH / 2, INIT_BALL_Y, texture)
      .setScale(scale)
      .setData("level", nextBallLevel);
  }

  updateNextBall() {
    const pointer = this.input.activePointer;
    this.nextBall.setPosition(pointer.x, INIT_BALL_Y);
  }

  createBall(x: number, y: number, level: number) {
    const texture = TEXTURES[level];
    const scale = this.scales[level];

    const ball = this.matter.add
      .image(x, y, texture)
      .setCircle(IMAGE_RADIUS)
      .setFriction(FRICTION)
      .setBounce(BOUNCE)
      .setScale(scale)
      .setData("level", level);

    this.currentBalls.push(ball);

    if (level > this.maxLevel) {
      this.maxLevel = level;
    }
  }

  handlePointerup() {
    if (this.isDropping) {
      return;
    }

    // ボールを実体化
    this.nextBall.setVisible(false);

    this.createBall(
      this.nextBall.x,
      this.nextBall.y,
      this.nextBall.getData("level")
    );

    // 次のボールを出す
    this.isDropping = true;

    this.time.addEvent({
      delay: DROPPING_SECONDS * 1000,
      callback: this.dropCallback,
      callbackScope: this,
    });
  }

  dropCallback() {
    // ゲームオーバー確認
    for (const ball of this.currentBalls) {
      if (ball.y < UPPER_BOUND_Y) {
        this.handleOver();
        return;
      }
    }

    // クリック制限解除
    this.isDropping = false;

    this.createNextBall();
  }

  handleOver() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xffffff, 0.8);

    this.add
      .text(WIDTH / 2, HEIGHT / 2, "ゲームオーバー")
      .setColor("#111827")
      .setFontSize(24)
      .setFontStyle("bold")
      .setOrigin(0.5, 0.5);
    this.input.off("pointerup", this.handlePointerup, this);

    // スコア表示
    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 + UPPER_BOUND_Y * 0.5,
        `${this.score}パラメータが載っかった`
      )
      .setColor("#111827")
      .setOrigin(0.5, 0.5);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 + UPPER_BOUND_Y * 1.5, "結果をXで共有")
      .setColor("#111827")
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .on(
        "pointerup",
        function () {
          window.open(
            `https://twitter.com/intent/tweet?text=${this.score}パラメータをメモリに載っけたよ&url=https://tide525.github.io/gpt-game/&hashtags=GPTゲーム`,
            "_blank",
            "noopener,noreferrer"
          );
        },
        this
      );

    this.add
      .text(WIDTH / 2, HEIGHT / 2 + UPPER_BOUND_Y * 2, "リロードでリトライ")
      .setColor("#111827")
      .setOrigin(0.5, 0.5);
  }
}

const config = {
  type: Phaser.AUTO,
  backgroundColor: "#ffffff",
  width: WIDTH,
  height: HEIGHT,
  physics: {
    default: "matter",
    matter: {
      enableSleeping: true,
    },
  },
  scene: Game,
};

const game = new Phaser.Game(config);
