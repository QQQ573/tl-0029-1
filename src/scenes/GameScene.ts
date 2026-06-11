import Phaser from 'phaser';
import { LevelConfig, CageConfig, ScheduleTask, FOODS, TimeOfDay, GameResult, MistakeRecord, FoodConfig } from '../types';

type ActiveTaskState = {
  task: ScheduleTask;
  cage: CageConfig;
  type: 'clean' | 'feed' | 'record';
  cleanClicks?: { x: number; y: number; cleaned: boolean }[];
  recordTemp?: number;
};

export class GameScene extends Phaser.Scene {
  private levelConfig!: LevelConfig;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private playerSpeed: number = 280;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private worldWidth: number = 1400;
  private worldHeight: number = 720;

  private welfareScore: number = 100;
  private maxScore: number = 100;
  private gameTimeElapsed: number = 0;
  private currentGameHour: number = 8;
  private schedule: ScheduleTask[] = [];
  private mistakes: MistakeRecord[] = [];
  private completedTasksCount: number = 0;

  private hudTimeText!: Phaser.GameObjects.Text;
  private hudScoreText!: Phaser.GameObjects.Text;
  private hudNextTaskText!: Phaser.GameObjects.Text;
  private scoreFlashTween?: Phaser.Tweens.Tween;

  private cages: Map<string, { config: CageConfig; container: Phaser.GameObjects.Container; graphics: Phaser.GameObjects.Graphics }> = new Map();
  private activeTask: ActiveTaskState | null = null;
  private taskPanel?: Phaser.GameObjects.Container;
  private dragFood: { item: Phaser.GameObjects.Container; foodConfig: FoodConfig } | null = null;

  private hintCardsQueue: string[] = [];
  private isPaused: boolean = false;
  private gameEnded: boolean = false;

  constructor() {
    super('GameScene');
  }

  init(data: { levelConfig?: LevelConfig }): void {
    if (data.levelConfig) {
      this.levelConfig = data.levelConfig;
    } else {
      this.levelConfig = this.cache.json.get('level1') as LevelConfig;
    }
    this.schedule = JSON.parse(JSON.stringify(this.levelConfig.schedule));
    this.welfareScore = 100;
    this.mistakes = [];
    this.completedTasksCount = 0;
    this.gameEnded = false;
    this.gameTimeElapsed = 0;
    this.currentGameHour = this.levelConfig.startHour;
    this.hintCardsQueue = [...this.levelConfig.hintCards];
  }

  create(): void {
    this.camera = this.cameras.main;
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

    this.createBackground();
    this.createCages();
    this.createPlayer();
    this.createHUD();
    this.createMovementZones();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasdKeys = this.input.keyboard!.addKeys('W,A,S,D') as unknown as { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

    this.currentGameHour = this.levelConfig.startHour;
    this.gameTimeElapsed = 0;

    this.time.delayedCall(1000, () => this.showNextHintCard());
  }

  update(_time: number, delta: number): void {
    if (this.isPaused || this.gameEnded) return;
    if (!this.levelConfig) return;

    const clampedDelta = Math.min(delta, 50);
    this.updateGameTime(clampedDelta);
    this.updatePlayerMovement();
    this.updateTaskAvailability();
    this.updateHUD();
    this.checkProximityTasks();

    if (Phaser.Input.Keyboard.JustDown(this.cursors.space!) && !this.activeTask && this.lastPromptCageId) {
      const cage = this.levelConfig.cages.find(c => c.id === this.lastPromptCageId);
      const task = this.findAvailableTaskForCage(this.lastPromptCageId);
      if (cage && task) {
        this.startTask(task, cage);
      }
    }

    if (this.gameTimeElapsed >= this.levelConfig.gameDurationMinutes * 60) {
      this.endGame(true);
    }
    if (this.welfareScore < this.levelConfig.minWelfareScore) {
      this.endGame(false);
    }
  }

  // ==================== 背景创建 ====================
  private createBackground(): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x87ceeb, 0x87ceeb, 0xb8e6b8, 0x90c695, 1);
    sky.fillRect(0, 0, this.worldWidth, this.worldHeight);

    for (let i = 0; i < 5; i++) {
      this.createCloud(100 + i * 300 + Phaser.Math.Between(-40, 40), 60 + Phaser.Math.Between(0, 40));
    }

    this.add.circle(this.worldWidth - 100, 70, 35, 0xffd700, 0.9);

    const ground = this.add.graphics();
    ground.fillStyle(0x8b6914, 1);
    ground.fillRect(0, 660, this.worldWidth, 60);
    ground.fillStyle(0x6ab04c, 1);
    ground.fillRect(0, 650, this.worldWidth, 18);

    for (let x = 50; x < this.worldWidth; x += 120) {
      if (this.shouldSkipTree(x)) continue;
      this.createTree(x, 650);
    }

    const path = this.add.graphics();
    path.fillStyle(0xc9a96e, 1);
    path.fillRect(0, 600, this.worldWidth, 52);
    path.fillStyle(0xb8956a, 1);
    for (let x = 0; x < this.worldWidth; x += 40) {
      path.fillRect(x, 600, 2, 52);
    }
  }

  private shouldSkipTree(x: number): boolean {
    return this.levelConfig.cages.some(c => Math.abs(c.position.x - x) < 100);
  }

  private createCloud(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x, y, 22);
    g.fillCircle(x + 28, y - 8, 26);
    g.fillCircle(x + 55, y, 22);
    g.fillCircle(x + 28, y + 4, 20);
    g.setScrollFactor(0.3);
  }

  private createTree(x: number, y: number): void {
    const trunk = this.add.graphics();
    trunk.fillStyle(0x8b5a2b, 1);
    trunk.fillRect(x - 6, y - 60, 12, 60);

    const leaves = this.add.graphics();
    leaves.fillStyle(0x2d5a3d, 1);
    leaves.fillCircle(x, y - 70, 28);
    leaves.fillCircle(x - 20, y - 55, 22);
    leaves.fillCircle(x + 20, y - 55, 22);
  }

  // ==================== 笼舍创建 ====================
  private createCages(): void {
    this.levelConfig.cages.forEach(cage => {
      this.createSingleCage(cage);
    });
  }

  private createSingleCage(cage: CageConfig): void {
    const container = this.add.container(cage.position.x, cage.position.y);
    const g = this.add.graphics();

    g.fillStyle(cage.color, 1);
    g.lineStyle(5, cage.accentColor, 1);
    g.fillRoundedRect(-110, -180, 220, 200, 10);
    g.strokeRoundedRect(-110, -180, 220, 200, 10);

    const roof = this.add.graphics();
    roof.fillStyle(cage.accentColor, 1);
    roof.beginPath();
    roof.moveTo(-120, -180);
    roof.lineTo(0, -230);
    roof.lineTo(120, -180);
    roof.closePath();
    roof.fillPath();

    for (let i = -80; i <= 80; i += 40) {
      const bar = this.add.graphics();
      bar.lineStyle(4, 0x4a4a4a, 0.8);
      bar.beginPath();
      bar.moveTo(i, -160);
      bar.lineTo(i, 10);
      bar.strokePath();
    }
    const hbar = this.add.graphics();
    hbar.lineStyle(4, 0x4a4a4a, 0.8);
    hbar.beginPath();
    hbar.moveTo(-90, -80);
    hbar.lineTo(90, -80);
    hbar.strokePath();

    const animalTxt = this.add.text(0, -100, cage.animalEmoji, {
      fontSize: '64px'
    }).setOrigin(0.5);

    const nameBg = this.add.graphics();
    nameBg.fillStyle(0xffffff, 0.9);
    nameBg.lineStyle(2, cage.accentColor, 1);
    nameBg.fillRoundedRect(-90, -45, 180, 40, 6);
    nameBg.strokeRoundedRect(-90, -45, 180, 40, 6);

    const nameTxt = this.add.text(0, -25, `${cage.name} ${cage.animalName}`, {
      fontSize: '16px',
      color: '#333333',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const bowl = this.add.graphics();
    bowl.fillStyle(0xc0c0c0, 1);
    bowl.lineStyle(3, 0x808080, 1);
    bowl.beginPath();
    bowl.arc(60, 0, 22, Math.PI, 0);
    bowl.closePath();
    bowl.fillPath();
    bowl.strokePath();
    bowl.fillStyle(0x909090, 1);
    bowl.fillEllipse(60, -2, 40, 8);

    container.add([g, roof, animalTxt, nameBg, nameTxt, bowl]);
    container.setName(`cage_${cage.id}`);
    container.setSize(240, 280);
    container.setDepth(10);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      this.movePlayerToX(cage.position.x - 50);
    });

    this.cages.set(cage.id, { config: cage, container, graphics: g });
  }

  // ==================== 玩家创建 ====================
  private createPlayer(): void {
    const startX = this.levelConfig.cages[0].position.x - 50;
    this.player = this.add.container(startX, 550);
    this.player.setDepth(80);

    const body = this.add.graphics();
    body.fillStyle(0x2563eb, 1);
    body.fillRoundedRect(-18, -8, 36, 40, 6);
    body.fillStyle(0xfbbf24, 1);
    body.fillCircle(0, -24, 16);
    body.fillStyle(0x000000, 1);
    body.fillCircle(-5, -26, 2.5);
    body.fillCircle(5, -26, 2.5);
    body.lineStyle(2, 0x000000, 1);
    body.beginPath();
    body.arc(0, -20, 5, 0, Math.PI);
    body.strokePath();
    body.fillStyle(0x1e3a8a, 1);
    body.fillRoundedRect(-16, 28, 12, 20, 3);
    body.fillRoundedRect(4, 28, 12, 20, 3);
    body.fillStyle(0x22c55e, 1);
    body.fillRoundedRect(-12, -50, 24, 8, 4);
    body.fillStyle(0xfbbf24, 1);
    body.fillRoundedRect(-6, -58, 12, 10, 2);

    const outline = this.add.graphics();
    outline.lineStyle(2, 0xffffff, 0.8);
    outline.strokeRoundedRect(-19, -9, 38, 42, 6);

    this.player.add([body, outline]);
    this.player.setSize(44, 80);

    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setSize(40, 70);
    this.playerBody.setOffset(-20, -35);

    this.camera.startFollow(this.player, false, 0.1, 0.1, 0, 30);
    this.camera.setFollowOffset(0, 0);
  }

  // ==================== HUD 创建 ====================
  private createHUD(): void {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x1e293b, 0.88);
    hudBg.fillRoundedRect(20, 16, 340, 92, 10);
    hudBg.lineStyle(2, 0xe8b86d, 1);
    hudBg.strokeRoundedRect(20, 16, 340, 92, 10);
    hudBg.setScrollFactor(0);
    hudBg.setDepth(100);

    this.hudTimeText = this.add.text(40, 32, '🕐 08:00', {
      fontSize: '22px',
      color: '#fbbf24',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(101);

    this.hudScoreText = this.add.text(40, 62, '⭐ 福利分：100', {
      fontSize: '22px',
      color: '#4ade80',
      fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(101);

    this.hudNextTaskText = this.add.text(40, 92, '📋 待办：加载中...', {
      fontSize: '16px',
      color: '#e2e8f0'
    }).setScrollFactor(0).setDepth(101);

    const minimapBg = this.add.graphics();
    minimapBg.fillStyle(0x1e293b, 0.88);
    minimapBg.fillRoundedRect(920, 16, 340, 50, 8);
    minimapBg.lineStyle(2, 0xe8b86d, 1);
    minimapBg.strokeRoundedRect(920, 16, 340, 50, 8);
    minimapBg.setScrollFactor(0).setDepth(100);

    this.levelConfig.cages.forEach((cage, i) => {
      const mx = 940 + i * 54;
      const dot = this.add.graphics();
      dot.fillStyle(cage.color, 1);
      dot.lineStyle(2, cage.accentColor, 1);
      dot.fillCircle(mx, 41, 16);
      dot.strokeCircle(mx, 41, 16);
      dot.setScrollFactor(0).setDepth(101);

      const hitArea = this.add.zone(mx, 41, 36, 36);
      hitArea.setScrollFactor(0).setDepth(103);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        this.movePlayerToX(cage.position.x - 50);
      });

      const label = this.add.text(mx, 41, cage.animalEmoji, {
        fontSize: '18px'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(102);
    });
  }

  // ==================== 移动区域点击 ====================
  private createMovementZones(): void {
    const leftZone = this.add.zone(0, 0, 150, this.worldHeight);
    leftZone.setOrigin(0).setInteractive();
    leftZone.on('pointerdown', () => {
      this.movePlayerToX(Math.max(100, this.player.x - 200));
    });

    const rightZone = this.add.zone(this.worldWidth - 150, 0, 150, this.worldHeight);
    rightZone.setOrigin(0).setInteractive();
    rightZone.on('pointerdown', () => {
      this.movePlayerToX(Math.min(this.worldWidth - 100, this.player.x + 200));
    });
  }

  private movePlayerToX(targetX: number): void {
    if (this.activeTask) return;
    const clampedX = Phaser.Math.Clamp(targetX, 50, this.worldWidth - 50);

    if (this.playerBody) {
      this.playerBody.setVelocity(0);
    }

    if (clampedX < this.player.x) {
      this.player.setScale(-1, 1);
    } else if (clampedX > this.player.x) {
      this.player.setScale(1, 1);
    }

    this.tweens.add({
      targets: this.player,
      x: clampedX,
      duration: Math.abs(clampedX - this.player.x) / this.playerSpeed * 1000,
      ease: 'Linear'
    });
  }

  // ==================== 时间更新 ====================
  private updateGameTime(delta: number): void {
    const realDelta = delta / 1000;
    this.gameTimeElapsed += realDelta;
    const gameMinutes = this.gameTimeElapsed * this.levelConfig.realTimeMultiplier;
    this.currentGameHour = this.levelConfig.startHour + gameMinutes / 60;
  }

  private getTimeOfDay(): TimeOfDay {
    return this.currentGameHour < 12 ? 'morning' : 'afternoon';
  }

  private formatGameTime(): string {
    const h = Math.floor(this.currentGameHour);
    const m = Math.floor((this.currentGameHour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // ==================== 玩家移动 ====================
  private updatePlayerMovement(): void {
    if (this.activeTask) {
      this.playerBody.setVelocity(0);
      return;
    }

    let vx = 0;
    if (this.cursors.left!.isDown || this.wasdKeys.A.isDown) vx = -this.playerSpeed;
    if (this.cursors.right!.isDown || this.wasdKeys.D.isDown) vx = this.playerSpeed;

    this.playerBody.setVelocityX(vx);

    if (vx < 0) this.player.setScale(-1, 1);
    else if (vx > 0) this.player.setScale(1, 1);
  }

  // ==================== 任务系统 ====================
  private updateTaskAvailability(): void {
    if (!this.levelConfig) return;

    this.schedule.forEach(task => {
      if (task.completed) return;
      const timeDiff = this.currentGameHour - task.scheduledTime;
      const windowHours = task.windowMinutes / 60;
      if (timeDiff > windowHours * 1.5) {
        task.completed = true;
        const cage = this.levelConfig.cages.find(c => c.id === task.cageId);
        if (cage) {
          this.addMistake(cage.name, this.getTaskTypeName(task.taskType), `错过${task.windowMinutes}分钟时间窗口`, 8);
        }
      }
    });
  }

  private getTaskTypeName(type: string): string {
    return type === 'clean' ? '清洁' : type === 'feed' ? '投喂' : '记录';
  }

  private checkProximityTasks(): void {
    if (this.activeTask) return;

    for (const cage of this.levelConfig.cages) {
      const dist = Math.abs(this.player.x - cage.position.x);
      if (dist < 120) {
        const availableTask = this.findAvailableTaskForCage(cage.id);
        if (availableTask) {
          this.showTaskPrompt(cage, availableTask);
        }
        return;
      }
    }
    this.hideTaskPrompt();
  }

  private findAvailableTaskForCage(cageId: string): ScheduleTask | null {
    return this.schedule.find(t =>
      t.cageId === cageId && !t.completed &&
      Math.abs(this.currentGameHour - t.scheduledTime) <= t.windowMinutes / 60 * 1.2
    ) || null;
  }

  private taskPrompt?: Phaser.GameObjects.Container;
  private lastPromptCageId?: string;

  private showTaskPrompt(cage: CageConfig, task: ScheduleTask): void {
    if (this.lastPromptCageId === cage.id && this.taskPrompt) return;
    this.hideTaskPrompt();
    this.lastPromptCageId = cage.id;

    const c = this.add.container(cage.position.x, cage.position.y - 290);
    const g = this.add.graphics();
    const typeEmoji = task.taskType === 'clean' ? '🧹' : task.taskType === 'feed' ? '🍽️' : '🌡️';
    const label = `${typeEmoji} ${this.getTaskTypeName(task.taskType)}任务 [按空格/点击]`;

    const text = this.add.text(0, 0, label, {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#dc2626',
      padding: { left: 14, right: 14, top: 8, bottom: 8 },
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const w = text.width + 20, h = text.height + 16;
    g.fillStyle(0xdc2626, 1);
    g.lineStyle(3, 0xffffff, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

    c.add([g, text]);
    c.setDepth(50);

    this.tweens.add({
      targets: c,
      y: cage.position.y - 310,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.startTask(task, cage));

    this.taskPrompt = c;
  }

  private hideTaskPrompt(): void {
    if (this.taskPrompt) {
      this.tweens.killTweensOf(this.taskPrompt);
      this.taskPrompt.destroy();
      this.taskPrompt = undefined;
    }
    this.lastPromptCageId = undefined;
  }

  // ==================== 启动任务 ====================
  private startTask(task: ScheduleTask, cage: CageConfig): void {
    this.hideTaskPrompt();
    this.isPaused = true;
    this.activeTask = { task, cage, type: task.taskType };

    if (task.taskType === 'clean') {
      this.activeTask.cleanClicks = Array.from({ length: 3 }, () => ({
        x: Phaser.Math.Between(cage.position.x - 90, cage.position.x + 90),
        y: Phaser.Math.Between(cage.position.y - 150, cage.position.y - 40),
        cleaned: false
      }));
    } else if (task.taskType === 'record') {
      this.activeTask.recordTemp = Phaser.Math.Between(10, 35);
    }

    this.showTaskPanel();
  }

  private showTaskPanel(): void {
    if (!this.activeTask) return;
    const { cage, type } = this.activeTask;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.taskPanel = this.add.container(cx, cy);
    this.taskPanel.setDepth(200);
    this.taskPanel.setScrollFactor(0);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55);
    dim.fillRect(-cx, -cy, this.scale.width, this.scale.height);
    dim.setScrollFactor(0);

    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.lineStyle(5, cage.accentColor, 1);
    panel.fillRoundedRect(-320, -250, 640, 500, 16);
    panel.strokeRoundedRect(-320, -250, 640, 500, 16);

    const title = this.add.text(0, -210, `${cage.animalEmoji} ${cage.name} - ${this.getTaskTypeName(type)}任务`, {
      fontSize: '26px',
      color: '#1f2937',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const hint = this.add.text(0, -170, cage.specialHint || '请认真完成任务！', {
      fontSize: '16px',
      color: '#dc2626',
      wordWrap: { width: 560 },
      align: 'center'
    }).setOrigin(0.5);

    this.taskPanel.add([dim, panel, title, hint]);

    if (type === 'clean') this.renderCleanTask();
    else if (type === 'feed') this.renderFeedTask();
    else if (type === 'record') this.renderRecordTask();

    this.taskPanel.add(this.createCloseButton(290, -220));
  }

  private createCloseButton(x: number, y: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0xef4444, 1);
    bg.lineStyle(2, 0xffffff, 1);
    bg.fillCircle(0, 0, 22);
    bg.strokeCircle(0, 0, 22);
    const txt = this.add.text(0, 0, '✕', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    btn.add([bg, txt]);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.cancelTask());
    return btn;
  }

  private cancelTask(): void {
    this.closeTaskPanel();
    this.activeTask = null;
    this.isPaused = false;
  }

  private closeTaskPanel(): void {
    if (this.taskPanel) {
      this.taskPanel.destroy();
      this.taskPanel = undefined;
    }
    this.dragFood = null;
  }

  // ==================== 清洁任务 ====================
  private renderCleanTask(): void {
    if (!this.activeTask || !this.activeTask.cleanClicks) return;
    const area = this.add.container(0, 10);

    const areaBg = this.add.graphics();
    areaBg.fillStyle(0xfef3c7, 1);
    areaBg.lineStyle(3, 0xf59e0b, 1);
    areaBg.fillRoundedRect(-260, -150, 520, 300, 12);
    areaBg.strokeRoundedRect(-260, -150, 520, 300, 12);

    const progressText = this.add.text(0, -130, '🧹 点击污渍进行清洁 (0/3)', {
      fontSize: '20px',
      color: '#92400e',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    area.add([areaBg, progressText]);

    const cageEmoji = this.add.text(0, 40, this.activeTask.cage.animalEmoji, {
      fontSize: '100px'
    }).setOrigin(0.5).setAlpha(0.25);
    area.add(cageEmoji);

    this.activeTask.cleanClicks.forEach((spot, idx) => {
      const scaledX = (spot.x - (this.activeTask!.cage.position.x)) * 2;
      const scaledY = (spot.y - (this.activeTask!.cage.position.y - 80)) * 1.8;
      const stain = this.createStain(scaledX, scaledY, idx);
      area.add(stain);
    });

    area.setName('cleanArea');
    this.taskPanel!.add(area);
  }

  private createStain(x: number, y: number, idx: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const colors = [0x5c4033, 0x4a3728, 0x6b4423];
    const color = colors[idx % colors.length];
    g.fillStyle(color, 0.85);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 18 + Math.sin(i * 2.3) * 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();

    for (let i = 0; i < 3; i++) {
      g.fillStyle(color, 0.6);
      g.fillCircle(Phaser.Math.Between(-18, 18), Phaser.Math.Between(-18, 18), 6);
    }

    c.add(g);
    c.setSize(50, 50);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({
        targets: c,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 300,
        ease: 'Back.easeIn',
        onComplete: () => {
          c.destroy();
          this.onStainCleaned(idx);
        }
      });
    });

    c.on('pointerover', () => {
      this.tweens.add({ targets: c, scaleX: 1.15, scaleY: 1.15, duration: 150 });
    });
    c.on('pointerout', () => {
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 150 });
    });

    return c;
  }

  private onStainCleaned(idx: number): void {
    if (!this.activeTask || !this.activeTask.cleanClicks) return;
    this.activeTask.cleanClicks[idx].cleaned = true;
    const cleaned = this.activeTask.cleanClicks.filter(s => s.cleaned).length;

    const area = this.taskPanel!.getByName('cleanArea') as Phaser.GameObjects.Container;
    if (area) {
      const pt = area.list.find(o => (o as Phaser.GameObjects.Text).text && (o as Phaser.GameObjects.Text).text.startsWith('🧹')) as Phaser.GameObjects.Text;
      if (pt) pt.setText(`🧹 点击污渍进行清洁 (${cleaned}/3)`);
    }

    if (cleaned >= 3) {
      this.time.delayedCall(400, () => this.completeTask(true));
    }
  }

  // ==================== 投喂任务 ====================
  private renderFeedTask(): void {
    if (!this.activeTask) return;
    const area = this.add.container(0, 30);

    const feedBg = this.add.graphics();
    feedBg.fillStyle(0xfce7f3, 1);
    feedBg.lineStyle(3, 0xec4899, 1);
    feedBg.fillRoundedRect(-260, -170, 520, 340, 12);
    feedBg.strokeRoundedRect(-260, -170, 520, 340, 12);

    const label = this.add.text(0, -150, '🍽️ 拖拽正确的食物到食槽中', {
      fontSize: '20px',
      color: '#9d174d',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    area.add([feedBg, label]);

    const bowlArea = this.createBowlDropZone(0, 70);
    area.add(bowlArea);

    const trayBg = this.add.graphics();
    trayBg.fillStyle(0x94a3b8, 1);
    trayBg.fillRoundedRect(-230, 80, 460, 60, 8);
    trayBg.lineStyle(2, 0x64748b, 1);
    trayBg.strokeRoundedRect(-230, 80, 460, 60, 8);
    area.add(trayBg);

    const availableFoods = this.getAvailableFoodOptions();
    availableFoods.forEach((food, i) => {
      const fx = -195 + i * 85;
      const foodItem = this.createFoodItem(food, fx, 110);
      area.add(foodItem);
    });

    area.setName('feedArea');
    this.taskPanel!.add(area);
  }

  private getAvailableFoodOptions(): FoodConfig[] {
    if (!this.activeTask) return [];
    const cage = this.activeTask.cage;
    const options = [...cage.acceptedFoods];

    const allFoods = FOODS.filter(f => !options.includes(f.id));
    while (options.length < 5 && allFoods.length > 0) {
      const idx = Phaser.Math.Between(0, allFoods.length - 1);
      options.push(allFoods[idx].id);
      allFoods.splice(idx, 1);
    }

    Phaser.Utils.Array.Shuffle(options);
    return options.map(id => FOODS.find(f => f.id === id)!).filter(Boolean);
  }

  private createFoodItem(food: FoodConfig, x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(food.color, 1);
    g.lineStyle(3, 0x1f2937, 1);

    if (food.shape === 'circle') {
      g.fillCircle(0, 0, 22);
      g.strokeCircle(0, 0, 22);
    } else if (food.shape === 'rect') {
      g.fillRoundedRect(-20, -16, 40, 32, 6);
      g.strokeRoundedRect(-20, -16, 40, 32, 6);
    } else {
      g.beginPath();
      g.moveTo(0, -22);
      g.lineTo(20, 18);
      g.lineTo(-20, 18);
      g.closePath();
      g.fillPath();
      g.strokePath();
    }

    const name = this.add.text(0, 38, food.name, {
      fontSize: '13px',
      color: '#1f2937',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    c.add([g, name]);
    c.setSize(50, 70);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.setName(`food_${food.id}`);
    c.setData('origX', x);
    c.setData('origY', y);

    this.input.setDraggable(c);
    c.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      const feedArea = c.parentContainer as Phaser.GameObjects.Container;
      const point = new Phaser.Geom.Point(dx, dy);
      feedArea.getLocalPoint(point, point);
      c.x = point.x;
      c.y = point.y;
      this.dragFood = { item: c, foodConfig: food };
    });
    c.on('dragend', () => {
      this.checkFoodDrop();
    });

    return c;
  }

  private createBowlDropZone(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0xc0c0c0, 1);
    g.lineStyle(5, 0x64748b, 1);
    g.beginPath();
    g.arc(0, 0, 55, Math.PI, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(0x9ca3af, 1);
    g.fillEllipse(0, -5, 100, 18);

    const hint = this.add.text(0, 25, '拖拽到这里 →', {
      fontSize: '15px',
      color: '#64748b',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    c.add([g, hint]);
    c.setName('dropBowl');
    c.setSize(120, 80);
    return c;
  }

  private checkFoodDrop(): void {
    if (!this.dragFood || !this.taskPanel) return;
    const { item, foodConfig } = this.dragFood;

    const feedArea = this.taskPanel.getByName('feedArea') as Phaser.GameObjects.Container;
    if (!feedArea) { this.dragFood = null; return; }

    const bowl = feedArea.getByName('dropBowl') as Phaser.GameObjects.Container;
    if (!bowl) { this.dragFood = null; return; }

    const dist = Phaser.Math.Distance.Between(item.x, item.y, bowl.x, bowl.y);

    if (dist < 80) {
      this.validateFeedChoice(foodConfig);
    } else {
      this.tweens.add({
        targets: item,
        x: item.getData('origX'),
        y: item.getData('origY'),
        duration: 250
      });
    }
    this.dragFood = null;
  }

  private validateFeedChoice(food: FoodConfig): void {
    if (!this.activeTask) return;
    const task = this.activeTask.task;
    const cage = this.activeTask.cage;
    const timeOfDay = this.getTimeOfDay();

    let isCorrect = true;
    let penalty = 0;
    let reason = '';

    for (const rule of cage.rules) {
      const check = rule.check;
      let ruleApplies = true;

      if (check.timeOfDay_eq !== undefined) {
        ruleApplies = check.timeOfDay_eq === timeOfDay;
      }

      if (!ruleApplies) continue;

      let ruleBroken = false;

      if (check.foodId_eq !== undefined && check.foodId_eq !== food.id) {
        ruleBroken = true;
      }
      if (check.foodId_not !== undefined && check.foodId_not === food.id) {
        ruleBroken = true;
      }
      if (check.foodId_in instanceof Array && !check.foodId_in.includes(food.id)) {
        ruleBroken = true;
      }

      if (ruleBroken) {
        isCorrect = false;
        if (rule.penalty > penalty) {
          penalty = rule.penalty;
          reason = rule.penaltyReason;
        }
      }
    }

    if (task.foodId && food.id !== task.foodId && isCorrect) {
      isCorrect = false;
      penalty = Math.max(penalty, 6);
      const correctFood = FOODS.find(f => f.id === task.foodId);
      reason = `未按时间表要求投喂${correctFood?.name || '指定食物'}`;
    }

    if (!isCorrect) {
      this.addMistake(cage.name, '投喂', reason, penalty);
      this.completeTask(false);
    } else {
      this.completeTask(true);
    }
  }

  // ==================== 记录任务 ====================
  private renderRecordTask(): void {
    if (!this.activeTask) return;
    const area = this.add.container(0, 20);

    const recBg = this.add.graphics();
    recBg.fillStyle(0xdbeafe, 1);
    recBg.lineStyle(3, 0x3b82f6, 1);
    recBg.fillRoundedRect(-260, -170, 520, 340, 12);
    recBg.strokeRoundedRect(-260, -170, 520, 340, 12);

    const label = this.add.text(0, -150, '🌡️ 调节温度到正确范围并点击确认', {
      fontSize: '20px',
      color: '#1e40af',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    area.add([recBg, label]);

    const thermometer = this.createThermometer(0, -20);
    area.add(thermometer);

    const target = this.activeTask.task.targetTemperature!;
    const tol = this.activeTask.task.temperatureTolerance || 2;
    const targetTxt = this.add.text(0, 60, `目标温度：${target}°C (±${tol}°C)`, {
      fontSize: '22px',
      color: '#1e40af',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    area.add(targetTxt);

    const btnMinus = this.createTempButton(-140, 110, '−', () => this.adjustTemp(-1));
    const btnPlus = this.createTempButton(140, 110, '+', () => this.adjustTemp(1));
    area.add([btnMinus, btnPlus]);

    const confirmBtn = this.createConfirmButton(0, 170, '✅ 确认记录', 0x22c55e);
    confirmBtn.on('pointerdown', () => this.validateRecordTemp());
    area.add(confirmBtn);

    area.setName('recordArea');
    this.taskPanel!.add(area);
  }

  private createThermometer(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();

    g.lineStyle(5, 0x1f2937, 1);
    g.strokeRoundedRect(-18, -80, 36, 130, 18);
    g.fillStyle(0xfecaca, 1);
    g.fillRoundedRect(-14, -76, 28, 122, 14);

    g.fillStyle(0x1f2937, 1);
    g.fillCircle(0, 58, 28);
    g.fillStyle(0xef4444, 1);
    g.fillCircle(0, 58, 20);

    const mercury = this.add.graphics();
    mercury.setName('mercury');
    c.add([g, mercury]);

    for (let i = 0; i <= 6; i++) {
      const ly = -70 + i * 22;
      const line = this.add.graphics();
      line.lineStyle(2, 0x64748b, 1);
      line.beginPath();
      line.moveTo(-14, ly);
      line.lineTo(-5, ly);
      line.strokePath();
      c.add(line);
    }

    const tempTxt = this.add.text(50, 0, `${this.activeTask!.recordTemp}°C`, {
      fontSize: '36px',
      color: '#dc2626',
      fontStyle: 'bold'
    }).setName('tempText');
    c.add(tempTxt);

    this.updateThermometerDisplay(c);
    c.setName('thermometer');
    return c;
  }

  private updateThermometerDisplay(container: Phaser.GameObjects.Container): void {
    if (!this.activeTask) return;
    const temp = this.activeTask.recordTemp!;
    const t = Phaser.Math.Clamp((temp - 10) / 30, 0, 1);

    const mercury = container.getByName('mercury') as Phaser.GameObjects.Graphics;
    mercury.clear();
    mercury.fillStyle(0xef4444, 1);
    const h = t * 110;
    mercury.fillRoundedRect(-10, 46 - h, 20, h, 10);

    const txt = container.getByName('tempText') as Phaser.GameObjects.Text;
    txt.setText(`${temp}°C`);
  }

  private adjustTemp(delta: number): void {
    if (!this.activeTask) return;
    this.activeTask.recordTemp = Phaser.Math.Clamp((this.activeTask.recordTemp || 20) + delta, 5, 40);

    const area = this.taskPanel!.getByName('recordArea') as Phaser.GameObjects.Container;
    if (!area) return;
    const thermo = area.getByName('thermometer') as Phaser.GameObjects.Container;
    if (thermo) this.updateThermometerDisplay(thermo);
  }

  private createTempButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x6366f1, 1);
    g.lineStyle(3, 0xffffff, 1);
    g.fillCircle(0, 0, 32);
    g.strokeCircle(0, 0, 32);
    const t = this.add.text(0, 0, label, {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    c.add([g, t]);
    c.setSize(64, 64);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', onClick);

    c.on('pointerover', () => {
      this.tweens.add({ targets: c, scaleX: 1.1, scaleY: 1.1, duration: 120 });
    });
    c.on('pointerout', () => {
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120 });
    });
    return c;
  }

  private createConfirmButton(x: number, y: number, text: string, color: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const w = 200, h = 46;
    g.fillStyle(color, 1);
    g.lineStyle(3, 0xffffff, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);

    const t = this.add.text(0, 0, text, {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    c.add([g, t]);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });

    c.on('pointerover', () => g.setAlpha(0.85));
    c.on('pointerout', () => g.setAlpha(1));
    return c;
  }

  private validateRecordTemp(): void {
    if (!this.activeTask || !this.activeTask.task) return;
    const task = this.activeTask.task;
    const cage = this.activeTask.cage;
    const temp = this.activeTask.recordTemp || 0;
    const target = task.targetTemperature!;
    const tol = task.temperatureTolerance || 2;

    if (Math.abs(temp - target) <= tol) {
      this.completeTask(true);
    } else {
      const diff = Math.abs(temp - target);
      const penalty = diff <= tol * 2 ? 6 : 12;
      this.addMistake(cage.name, '记录', `温度偏差过大 (${temp}°C 应为 ${target}°C±${tol}°C)`, penalty);
      this.completeTask(false);
    }
  }

  // ==================== 任务完成 ====================
  private completeTask(success: boolean): void {
    if (!this.activeTask) return;
    const task = this.activeTask.task;
    const cage = this.activeTask.cage;

    if (success) {
      task.completed = true;
      this.completedTasksCount++;
      this.showFeedbackPopup('✅ 任务完成！', '#16a34a', cage.position.x, cage.position.y - 200);
    } else {
      task.completed = true;
      this.showFeedbackPopup('❌ 任务失误', '#dc2626', cage.position.x, cage.position.y - 200);
    }

    this.time.delayedCall(500, () => {
      this.closeTaskPanel();
      this.activeTask = null;
      this.isPaused = false;
    });
  }

  private showFeedbackPopup(text: string, color: string, x: number, y: number): void {
    const t = this.add.text(x, y, text, {
      fontSize: '28px',
      color,
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: t,
      y: y - 50,
      alpha: { from: 1, to: 0 },
      duration: 1400,
      onComplete: () => t.destroy()
    });
  }

  // ==================== 扣分与失误 ====================
  private addMistake(cageName: string, taskType: string, reason: string, penalty: number): void {
    this.welfareScore = Math.max(0, this.welfareScore - penalty);
    this.mistakes.push({
      time: this.formatGameTime(),
      cageName,
      taskType,
      reason,
      penalty
    });
    this.flashScorePenalty();
  }

  private flashScorePenalty(): void {
    if (this.scoreFlashTween) this.scoreFlashTween.remove();
    this.hudScoreText.setColor('#ef4444');
    this.cameras.main.shake(200, 0.006);
    this.scoreFlashTween = this.tweens.add({
      targets: this.hudScoreText,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 150,
      yoyo: true,
      onComplete: () => {
        const c = this.welfareScore >= 80 ? '#4ade80' : this.welfareScore >= 60 ? '#fbbf24' : '#ef4444';
        this.hudScoreText.setColor(c);
      }
    });
  }

  // ==================== HUD 更新 ====================
  private updateHUD(): void {
    this.hudTimeText.setText(`🕐 ${this.formatGameTime()} ${this.getTimeOfDay() === 'morning' ? '☀️' : '🌤️'}`);

    const scoreColor = this.welfareScore >= 80 ? '#4ade80' : this.welfareScore >= 60 ? '#fbbf24' : '#ef4444';
    this.hudScoreText.setText(`⭐ 福利分：${this.welfareScore}`);
    this.hudScoreText.setColor(scoreColor);

    const nextTask = this.schedule.find(t => !t.completed);
    if (nextTask) {
      const cage = this.levelConfig.cages.find(c => c.id === nextTask.cageId);
      const h = Math.floor(nextTask.scheduledTime);
      const m = Math.floor((nextTask.scheduledTime - h) * 60);
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const emoji = nextTask.taskType === 'clean' ? '🧹' : nextTask.taskType === 'feed' ? '🍽️' : '🌡️';
      this.hudNextTaskText.setText(`📋 待办：${timeStr} ${cage?.name} ${emoji}${this.getTaskTypeName(nextTask.taskType)}`);
    } else {
      this.hudNextTaskText.setText('📋 待办：全部完成！');
    }
  }

  // ==================== 提示卡片 ====================
  private showNextHintCard(): void {
    if (this.hintCardsQueue.length === 0) return;
    const hint = this.hintCardsQueue.shift()!;
    this.showHintCard(hint);

    if (this.hintCardsQueue.length > 0) {
      this.time.delayedCall(6500, () => this.showNextHintCard());
    }
  }

  private showHintCard(text: string): void {
    const cx = this.camera.midPoint.x;
    const card = this.add.container(cx, 130);
    card.setDepth(150);

    const g = this.add.graphics();
    const pad = 24;
    const tempText = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#1f2937',
      wordWrap: { width: 540 },
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);

    const w = Math.max(500, tempText.width + pad * 2);
    const h = tempText.height + pad * 2;

    g.fillStyle(0xfef9c3, 1);
    g.lineStyle(4, 0xf59e0b, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(0xfde68a, 1);
    for (let i = 0; i < 5; i++) {
      g.fillTriangle(-w / 2 + 10 + i * 25, -h / 2 + 6, -w / 2 + 18 + i * 25, -h / 2 - 3, -w / 2 + 26 + i * 25, -h / 2 + 6);
    }
    tempText.destroy();

    const content = this.add.text(0, 0, text, {
      fontSize: '18px',
      color: '#1f2937',
      wordWrap: { width: 540 },
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);

    card.add([g, content]);
    card.setAlpha(0).setY(60);

    this.tweens.add({
      targets: card,
      alpha: 1,
      y: 130,
      duration: 400,
      ease: 'Back.easeOut'
    });

    this.time.delayedCall(5500, () => {
      this.tweens.add({
        targets: card,
        alpha: 0,
        y: 60,
        duration: 400,
        onComplete: () => card.destroy()
      });
    });
  }

  // ==================== 游戏结束 ====================
  private endGame(completed: boolean): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    this.isPaused = true;

    const uncompletedTasks = this.schedule.filter(t => !t.completed).length;
    if (!completed && uncompletedTasks > 0) {
      this.schedule.forEach(t => {
        if (!t.completed) {
          const cage = this.levelConfig.cages.find(c => c.id === t.cageId);
          if (cage) {
            this.mistakes.push({
              time: this.formatGameTime(),
              cageName: cage.name,
              taskType: this.getTaskTypeName(t.taskType),
              reason: '任务未完成（福利分过低提前终止）',
              penalty: 0
            });
          }
        }
      });
    }

    const result: GameResult = {
      completed: completed && this.welfareScore >= 60,
      welfareScore: this.welfareScore,
      maxScore: this.maxScore,
      timeTaken: this.gameTimeElapsed,
      mistakes: this.mistakes,
      completedTasks: this.completedTasksCount,
      totalTasks: this.schedule.length
    };

    this.time.delayedCall(800, () => {
      this.scene.start('ResultScene', { result });
    });
  }
}
