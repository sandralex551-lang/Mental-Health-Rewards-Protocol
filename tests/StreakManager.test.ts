import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_ACTIVITY_TYPE = 102;
const ERR_INVALID_MIN_STREAK = 110;
const ERR_INVALID_MAX_STREAK = 111;
const ERR_INVALID_REWARD_THRESHOLD = 116;
const ERR_INVALID_GRACE_PERIOD = 117;
const ERR_INVALID_PROOF_HASH = 119;
const ERR_STREAK_ALREADY_EXISTS = 106;
const ERR_STREAK_NOT_FOUND = 107;
const ERR_MAX_ACTIVITIES_EXCEEDED = 114;
const ERR_INVALID_STATUS = 120;
const ERR_INVALID_RESET_REASON = 108;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_INVALID_UPDATE_PARAM = 113;

interface Streak {
  currentLength: number;
  maxLength: number;
  lastTimestamp: number;
  multiplier: number;
  timestamp: number;
  status: boolean;
  minStreak: number;
  maxStreak: number;
  rewardThreshold: number;
  gracePeriod: number;
  proofHash: Uint8Array;
}

interface StreakUpdate {
  updateLength: number;
  updateMultiplier: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class StreakManagerMock {
  state: {
    nextStreakId: number;
    maxActivities: number;
    updateFee: number;
    authorityContract: string | null;
    streaks: Map<string, Streak>;
    streakUpdates: Map<string, StreakUpdate>;
    streaksByUser: Map<string, Array<{ activityType: string; streakId: number }>>;
  } = {
    nextStreakId: 0,
    maxActivities: 100,
    updateFee: 100,
    authorityContract: null,
    streaks: new Map(),
    streakUpdates: new Map(),
    streaksByUser: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextStreakId: 0,
      maxActivities: 100,
      updateFee: 100,
      authorityContract: null,
      streaks: new Map(),
      streakUpdates: new Map(),
      streaksByUser: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  private getKey(user: string, activityType: string): string {
    return `${user}-${activityType}`;
  }

  private calculateMultiplier(length: number): number {
    if (length >= 30) return 5;
    if (length >= 14) return 3;
    if (length >= 7) return 2;
    return 1;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxActivities(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.maxActivities = newMax;
    return { ok: true, value: true };
  }

  setUpdateFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.updateFee = newFee;
    return { ok: true, value: true };
  }

  startStreak(
    activityType: string,
    minStreak: number,
    maxStreak: number,
    rewardThreshold: number,
    gracePeriod: number,
    proofHash: Uint8Array
  ): Result<boolean> {
    const key = this.getKey(this.caller, activityType);
    if (!activityType || activityType.length > 50) return { ok: false, value: ERR_INVALID_ACTIVITY_TYPE };
    if (minStreak < 1) return { ok: false, value: ERR_INVALID_MIN_STREAK };
    if (maxStreak <= 0) return { ok: false, value: ERR_INVALID_MAX_STREAK };
    if (rewardThreshold < 1) return { ok: false, value: ERR_INVALID_REWARD_THRESHOLD };
    if (gracePeriod > 7) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (proofHash.length !== 32) return { ok: false, value: ERR_INVALID_PROOF_HASH };
    if (this.state.streaks.has(key)) return { ok: false, value: ERR_STREAK_ALREADY_EXISTS };
    const userActivities = this.state.streaksByUser.get(this.caller) || [];
    if (userActivities.length >= this.state.maxActivities) return { ok: false, value: ERR_MAX_ACTIVITIES_EXCEEDED };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.updateFee, from: this.caller, to: this.state.authorityContract });

    const streak: Streak = {
      currentLength: 1,
      maxLength: 1,
      lastTimestamp: this.blockHeight,
      multiplier: 1,
      timestamp: this.blockHeight,
      status: true,
      minStreak,
      maxStreak,
      rewardThreshold,
      gracePeriod,
      proofHash,
    };
    this.state.streaks.set(key, streak);
    userActivities.push({ activityType, streakId: this.state.nextStreakId });
    this.state.streaksByUser.set(this.caller, userActivities);
    this.state.nextStreakId++;
    return { ok: true, value: true };
  }

  getStreak(user: string, activityType: string): Streak | null {
    return this.state.streaks.get(this.getKey(user, activityType)) || null;
  }

  updateStreak(activityType: string, proofHash: Uint8Array): Result<number> {
    const key = this.getKey(this.caller, activityType);
    const streak = this.state.streaks.get(key);
    if (!streak) return { ok: false, value: ERR_STREAK_NOT_FOUND };
    if (proofHash.length !== 32) return { ok: false, value: ERR_INVALID_PROOF_HASH };
    if (!streak.status) return { ok: false, value: ERR_INVALID_STATUS };

    const diff = this.blockHeight - streak.lastTimestamp;
    const newLength = diff <= 1 + streak.gracePeriod ? streak.currentLength + 1 : 1;
    const newMax = Math.max(newLength, streak.maxLength);
    const newMultiplier = this.calculateMultiplier(newLength);

    const updated: Streak = {
      ...streak,
      currentLength: newLength,
      maxLength: newMax,
      lastTimestamp: this.blockHeight,
      multiplier: newMultiplier,
      timestamp: this.blockHeight,
    };
    this.state.streaks.set(key, updated);
    this.state.streakUpdates.set(key, {
      updateLength: newLength,
      updateMultiplier: newMultiplier,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: newLength };
  }

  resetStreak(activityType: string, reason: string): Result<boolean> {
    const key = this.getKey(this.caller, activityType);
    const streak = this.state.streaks.get(key);
    if (!streak) return { ok: false, value: ERR_STREAK_NOT_FOUND };
    if (!reason) return { ok: false, value: ERR_INVALID_RESET_REASON };

    const updated: Streak = {
      ...streak,
      currentLength: 0,
      status: false,
      timestamp: this.blockHeight,
    };
    this.state.streaks.set(key, updated);
    return { ok: true, value: true };
  }

  getUserActivityCount(user: string): Result<number> {
    const activities = this.state.streaksByUser.get(user) || [];
    return { ok: true, value: activities.length };
  }
}

describe("StreakManager", () => {
  let contract: StreakManagerMock;

  beforeEach(() => {
    contract = new StreakManagerMock();
    contract.reset();
  });

  it("starts a streak successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    const result = contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const streak = contract.getStreak("ST1TEST", "meditation");
    expect(streak?.currentLength).toBe(1);
    expect(streak?.maxLength).toBe(1);
    expect(streak?.multiplier).toBe(1);
    expect(streak?.status).toBe(true);
    expect(streak?.minStreak).toBe(1);
    expect(streak?.maxStreak).toBe(100);
    expect(streak?.rewardThreshold).toBe(7);
    expect(streak?.gracePeriod).toBe(1);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate streak", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    const result = contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_STREAK_ALREADY_EXISTS);
  });

  it("rejects without authority contract", () => {
    const proofHash = new Uint8Array(32).fill(0);
    const result = contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid activity type", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    const longType = "a".repeat(51);
    const result = contract.startStreak(longType, 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ACTIVITY_TYPE);
  });

  it("rejects invalid min streak", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    const result = contract.startStreak("meditation", 0, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MIN_STREAK);
  });

  it("rejects invalid proof hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(31).fill(0);
    const result = contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PROOF_HASH);
  });

  it("updates streak successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    contract.blockHeight += 1;
    const result = contract.updateStreak("meditation", proofHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
    const streak = contract.getStreak("ST1TEST", "meditation");
    expect(streak?.currentLength).toBe(2);
    expect(streak?.maxLength).toBe(2);
    expect(streak?.multiplier).toBe(1);
  });

  it("resets streak on break", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    contract.blockHeight += 3;
    contract.updateStreak("meditation", proofHash);
    const streak = contract.getStreak("ST1TEST", "meditation");
    expect(streak?.currentLength).toBe(1);
  });

  it("applies multiplier correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 0, proofHash);
    for (let i = 1; i < 8; i++) {
      contract.blockHeight += 1;
      contract.updateStreak("meditation", proofHash);
    }
    const streak = contract.getStreak("ST1TEST", "meditation");
    expect(streak?.currentLength).toBe(8);
    expect(streak?.multiplier).toBe(2);
  });

  it("resets streak successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    const result = contract.resetStreak("meditation", "missed day");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const streak = contract.getStreak("ST1TEST", "meditation");
    expect(streak?.currentLength).toBe(0);
    expect(streak?.status).toBe(false);
  });

  it("rejects reset without reason", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    const result = contract.resetStreak("meditation", "");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RESET_REASON);
  });

  it("sets update fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setUpdateFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.updateFee).toBe(200);
  });

  it("rejects update fee without authority", () => {
    const result = contract.setUpdateFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("returns correct user activity count", () => {
    contract.setAuthorityContract("ST2TEST");
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    contract.startStreak("journaling", 1, 100, 7, 1, proofHash);
    const result = contract.getUserActivityCount("ST1TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("rejects max activities exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMaxActivities(1);
    const proofHash = new Uint8Array(32).fill(0);
    contract.startStreak("meditation", 1, 100, 7, 1, proofHash);
    const result = contract.startStreak("journaling", 1, 100, 7, 1, proofHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_ACTIVITIES_EXCEEDED);
  });

  it("parses activity type with Clarity", () => {
    const cv = stringUtf8CV("meditation") as ClarityValue & { value: string };
    expect(cv.value).toBe("meditation");
  });

  it("parses streak length with Clarity", () => {
    const cv = uintCV(10) as ClarityValue & { value: bigint };
    expect(cv.value).toEqual(BigInt(10));
  });
});