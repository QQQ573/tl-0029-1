export type TaskType = 'clean' | 'feed' | 'record';
export type FoodType = 'fresh_fruit' | 'overnight_fruit' | 'bamboo' | 'meat' | 'live_fish' | 'nuts' | 'leaves';
export type TimeOfDay = 'morning' | 'afternoon' | 'any';

export interface FoodConfig {
  id: FoodType;
  name: string;
  color: number;
  shape: 'circle' | 'rect' | 'triangle';
}

export type RuleCheckField = 
  | { foodId_eq: FoodType }
  | { foodId_not: FoodType }
  | { foodId_in: FoodType[] }
  | { timeOfDay_eq: TimeOfDay }
  | { temperatureRange: { min: number; max: number } };

export type RuleCheckCondition = Partial<{
  foodId_eq: FoodType;
  foodId_not: FoodType;
  foodId_in: FoodType[];
  timeOfDay_eq: TimeOfDay;
  temperatureRange: { min: number; max: number };
}>;

export interface CageRule {
  description: string;
  check: RuleCheckCondition;
  penalty: number;
  penaltyReason: string;
}

export interface RuleCheckContext {
  foodId?: FoodType;
  timeOfDay: TimeOfDay;
  taskType: TaskType;
  temperature?: number;
}

export interface ScheduleTask {
  id: string;
  cageId: string;
  taskType: TaskType;
  scheduledTime: number;
  windowMinutes: number;
  foodId?: FoodType;
  targetTemperature?: number;
  temperatureTolerance?: number;
  completed?: boolean;
}

export interface CageConfig {
  id: string;
  name: string;
  animalName: string;
  animalEmoji: string;
  color: number;
  accentColor: number;
  position: { x: number; y: number };
  rules: CageRule[];
  acceptedFoods: FoodType[];
  specialHint?: string;
}

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  gameDurationMinutes: number;
  realTimeMultiplier: number;
  startHour: number;
  minWelfareScore: number;
  cages: CageConfig[];
  schedule: ScheduleTask[];
  hintCards: string[];
}

export interface MistakeRecord {
  time: string;
  cageName: string;
  taskType: string;
  reason: string;
  penalty: number;
}

export interface GameResult {
  completed: boolean;
  welfareScore: number;
  maxScore: number;
  timeTaken: number;
  mistakes: MistakeRecord[];
  completedTasks: number;
  totalTasks: number;
}

export const FOODS: FoodConfig[] = [
  { id: 'fresh_fruit', name: '新鲜水果', color: 0xff6b6b, shape: 'circle' },
  { id: 'overnight_fruit', name: '隔夜水果', color: 0x8b7355, shape: 'circle' },
  { id: 'bamboo', name: '新鲜竹子', color: 0x4ecdc4, shape: 'rect' },
  { id: 'meat', name: '切块肉', color: 0xc44569, shape: 'triangle' },
  { id: 'live_fish', name: '活鱼', color: 0x54a0ff, shape: 'rect' },
  { id: 'nuts', name: '坚果', color: 0xa0522d, shape: 'circle' },
  { id: 'leaves', name: '嫩叶', color: 0x6ab04c, shape: 'triangle' }
];
