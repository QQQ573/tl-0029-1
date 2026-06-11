import Phaser from 'phaser';
import type { LevelConfig } from '../types';

export class MenuScene extends Phaser.Scene {
  private levelConfig!: LevelConfig;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.levelConfig = this.cache.json.get('level1') as LevelConfig;
    const width = this.scale.width;
    const height = this.scale.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x98d98e, 0x98d98e, 1);
    bg.fillRect(0, 0, width, height);

    this.addSunAndClouds();
    this.addGround();

    this.add.text(width / 2, 100, '🐼 实习饲养员 🏥', {
      fontSize: '56px',
      color: '#2d5a3d',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(width / 2, 170, this.levelConfig.name, {
      fontSize: '28px',
      color: '#5a3d2d',
      backgroundColor: 'rgba(255,255,255,0.7)',
      padding: { left: 20, right: 20, top: 8, bottom: 8 }
    }).setOrigin(0.5);

    this.add.text(width / 2, 240, this.levelConfig.description, {
      fontSize: '18px',
      color: '#333333',
      wordWrap: { width: 700 },
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);

    this.add.text(width / 2, 320, `📋 游戏时长：${this.levelConfig.gameDurationMinutes} 分钟（游戏内一整天）`, {
      fontSize: '18px',
      color: '#444444'
    }).setOrigin(0.5);

    this.add.text(width / 2, 350, `⭐ 及格分数：福利分 ≥ ${this.levelConfig.minWelfareScore}`, {
      fontSize: '18px',
      color: '#444444'
    }).setOrigin(0.5);

    this.createOperationGuide(width / 2, 420);

    const startBtn = this.createButton(width / 2, 580, '🎮 开始实习', 0x4caf50, 0x45a049);
    startBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { levelConfig: this.levelConfig });
    });
  }

  private addSunAndClouds(): void {
    this.add.circle(100, 80, 40, 0xffd700).setAlpha(0.9);

    const createCloud = (x: number, y: number, scale: number) => {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(x, y, 25 * scale);
      g.fillCircle(x + 30 * scale, y - 10 * scale, 30 * scale);
      g.fillCircle(x + 60 * scale, y, 25 * scale);
      g.fillCircle(x + 30 * scale, y + 5 * scale, 22 * scale);
    };
    createCloud(300, 100, 1);
    createCloud(700, 70, 0.8);
    createCloud(1100, 120, 1.1);
  }

  private addGround(): void {
    const ground = this.add.graphics();
    ground.fillStyle(0x8b6914, 1);
    ground.fillRect(0, 660, this.scale.width, 60);
    ground.fillStyle(0x6ab04c, 1);
    ground.fillRect(0, 650, this.scale.width, 20);
  }

  private createOperationGuide(x: number, y: number): void {
    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 0.85);
    panel.lineStyle(3, 0xe8b86d, 1);
    panel.fillRoundedRect(x - 380, y - 10, 760, 110, 12);
    panel.strokeRoundedRect(x - 380, y - 10, 760, 110, 12);

    this.add.text(x, y + 15, '操作说明', {
      fontSize: '20px',
      color: '#2d5a3d',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(x - 350, y + 45, '🧹 清洁：点击污渍3次清除', {
      fontSize: '16px',
      color: '#333333'
    });

    this.add.text(x - 350, y + 72, '🍎 投喂：拖拽正确食物到食槽', {
      fontSize: '16px',
      color: '#333333'
    });

    this.add.text(x + 20, y + 45, '🌡️ 记录：点击调整温度到正确范围', {
      fontSize: '16px',
      color: '#333333'
    });

    this.add.text(x + 20, y + 72, '🚶 移动：← → 键或点击左右屏幕边缘', {
      fontSize: '16px',
      color: '#333333'
    });
  }

  private createButton(x: number, y: number, text: string, color: number, hoverColor: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    const w = 260, h = 64;

    bg.fillStyle(color, 1);
    bg.lineStyle(4, 0xffffff, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);

    const txt = this.add.text(0, 0, text, {
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.add([bg, txt]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(hoverColor, 1);
      bg.lineStyle(4, 0xffffff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.lineStyle(4, 0xffffff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    });

    return btn;
  }
}
