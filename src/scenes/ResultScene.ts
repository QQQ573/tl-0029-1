import Phaser from 'phaser';
import type { GameResult, MistakeRecord } from '../types';

export class ResultScene extends Phaser.Scene {
  private result!: GameResult;

  constructor() {
    super('ResultScene');
  }

  init(data: { result: GameResult }): void {
    this.result = data.result;
  }

  create(): void {
    const width = this.scale.width;

    this.cameras.main.setBackgroundColor(0x1a1a2e);

    const isPass = this.result.welfareScore >= 60;

    this.add.text(width / 2, 80, isPass ? '🎉 实习考核通过！' : '💔 实习考核未通过', {
      fontSize: '48px',
      color: isPass ? '#4ade80' : '#f87171',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.createScorePanel(width / 2, 180);
    this.createStatsPanel(width / 2, 310);
    this.createMistakesPanel(width / 2, 460);

    const menuBtn = this.createButton(width / 2 - 160, 660, '🏠 返回菜单', 0x6366f1, 0x4f46e5);
    menuBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    const retryBtn = this.createButton(width / 2 + 160, 660, '🔄 再试一次', 0xf59e0b, 0xd97706);
    retryBtn.on('pointerdown', () => {
      this.scene.start('GameScene');
    });
  }

  private createScorePanel(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.lineStyle(3, 0xe8b86d, 1);
    g.fillRoundedRect(x - 300, y, 600, 100, 12);
    g.strokeRoundedRect(x - 300, y, 600, 100, 12);

    this.add.text(x - 250, y + 30, '动物福利分', {
      fontSize: '22px',
      color: '#333333'
    });

    const scoreColor = this.result.welfareScore >= 80 ? '#16a34a' :
                       this.result.welfareScore >= 60 ? '#f59e0b' : '#dc2626';

    this.add.text(x + 150, y + 30, `${this.result.welfareScore} / ${this.result.maxScore}`, {
      fontSize: '36px',
      color: scoreColor,
      fontStyle: 'bold'
    }).setOrigin(1, 0);

    const barWidth = 500;
    const barX = x - barWidth / 2;
    const barY = y + 65;
    const pct = Math.max(0, this.result.welfareScore / this.result.maxScore);

    const bgBar = this.add.graphics();
    bgBar.fillStyle(0xe5e7eb, 1);
    bgBar.fillRoundedRect(barX, barY, barWidth, 18, 9);

    const scoreBar = this.add.graphics();
    scoreBar.fillStyle(this.result.welfareScore >= 80 ? 0x22c55e :
                       this.result.welfareScore >= 60 ? 0xf59e0b : 0xef4444, 1);
    scoreBar.fillRoundedRect(barX, barY, barWidth * pct, 18, 9);

    const passX = barX + barWidth * (60 / this.result.maxScore);
    const passLine = this.add.graphics();
    passLine.lineStyle(3, 0xef4444, 1);
    passLine.beginPath();
    passLine.moveTo(passX, barY - 4);
    passLine.lineTo(passX, barY + 22);
    passLine.strokePath();
  }

  private createStatsPanel(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.lineStyle(2, 0xc4b5fd, 1);
    g.fillRoundedRect(x - 300, y, 600, 130, 12);
    g.strokeRoundedRect(x - 300, y, 600, 130, 12);

    this.add.text(x - 260, y + 20, '📊 数据统计', {
      fontSize: '22px',
      color: '#4f46e5',
      fontStyle: 'bold'
    });

    const mins = Math.floor(this.result.timeTaken / 60);
    const secs = Math.floor(this.result.timeTaken % 60);

    this.add.text(x - 260, y + 60, `⏱️ 耗时：${mins}分${secs.toString().padStart(2, '0')}秒`, {
      fontSize: '18px',
      color: '#333333'
    });

    this.add.text(x + 20, y + 60, `✅ 完成任务：${this.result.completedTasks} / ${this.result.totalTasks}`, {
      fontSize: '18px',
      color: '#333333'
    });

    const taskPct = Math.round(this.result.completedTasks / this.result.totalTasks * 100);
    this.add.text(x - 260, y + 90, `📈 任务完成率：${taskPct}%`, {
      fontSize: '18px',
      color: '#333333'
    });

    this.add.text(x + 20, y + 90, `⚠️ 失误次数：${this.result.mistakes.length}`, {
      fontSize: '18px',
      color: '#333333'
    });
  }

  private createMistakesPanel(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.95);
    g.lineStyle(2, 0xfca5a5, 1);
    g.fillRoundedRect(x - 400, y, 800, 170, 12);
    g.strokeRoundedRect(x - 400, y, 800, 170, 12);

    this.add.text(x - 370, y + 18, '❌ 失误记录', {
      fontSize: '22px',
      color: '#dc2626',
      fontStyle: 'bold'
    });

    if (this.result.mistakes.length === 0) {
      this.add.text(x, y + 90, '✨ 完美！没有任何失误 ✨', {
        fontSize: '24px',
        color: '#16a34a',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      return;
    }

    const mistakes = this.result.mistakes.slice(0, 5);
    mistakes.forEach((m: MistakeRecord, i: number) => {
      const rowY = y + 50 + i * 24;
      this.add.text(x - 370, rowY, `[${m.time}] ${m.cageName} - ${m.taskType}`, {
        fontSize: '14px',
        color: '#1f2937'
      });
      this.add.text(x - 80, rowY, `${m.reason}`, {
        fontSize: '14px',
        color: '#dc2626'
      });
      this.add.text(x + 330, rowY, `-${m.penalty}分`, {
        fontSize: '14px',
        color: '#dc2626',
        fontStyle: 'bold'
      }).setOrigin(1, 0);
    });

    if (this.result.mistakes.length > 5) {
      this.add.text(x, y + 150, `...还有 ${this.result.mistakes.length - 5} 条失误未显示`, {
        fontSize: '14px',
        color: '#6b7280'
      }).setOrigin(0.5);
    }
  }

  private createButton(x: number, y: number, text: string, color: number, hoverColor: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    const w = 240, h = 56;

    bg.fillStyle(color, 1);
    bg.lineStyle(3, 0xffffff, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);

    const txt = this.add.text(0, 0, text, {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.add([bg, txt]);
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(hoverColor, 1);
      bg.lineStyle(3, 0xffffff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.lineStyle(3, 0xffffff, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    });

    return btn;
  }
}
