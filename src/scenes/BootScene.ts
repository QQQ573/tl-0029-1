import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.load.json('level1', 'levels/level1.json');

    const progress = this.add.graphics();
    const width = this.scale.width;
    const height = this.scale.height;

    this.load.on('progress', (value: number) => {
      progress.clear();
      progress.fillStyle(0xe8b86d, 1);
      progress.fillRect(width / 2 - 200, height / 2 - 15, 400 * value, 30);
      progress.lineStyle(4, 0x8b6914, 1);
      progress.strokeRect(width / 2 - 200, height / 2 - 15, 400, 30);
    });

    this.load.on('complete', () => {
      progress.destroy();
    });
  }

  create(): void {
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 60, '🐼 珍奇动物园', {
      fontSize: '48px',
      color: '#2d5a3d',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(this.scale.width / 2, this.scale.height / 2, '实习饲养员培训', {
      fontSize: '32px',
      color: '#5a3d2d'
    }).setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      this.scene.start('MenuScene');
    });
  }
}
