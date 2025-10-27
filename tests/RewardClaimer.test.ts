import { describe, it, expect, beforeEach } from "vitest";
import {
  ClarityValue,
  stringUtf8CV,
  uintCV,
  tupleCV,
} from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INVALID_USER = 102;
const ERR_INVALID_STREAK = 103;
const ERR_COOLDOWN_ACTIVE = 104;
const ERR_AUTHORITY_NOT_VERIFIED = 106;
const ERR_INVALID_REWARD_RATE = 107;
const ERR_INVALID_COOLDOWN = 108;
const ERR_REWARD_CAP_EXCEEDED = 111;
const ERR_INVALID_UPDATE_PARAM = 112;

interface Result<T> {
  ok: boolean;
  value: T;
}

interface Streak {
  currentLength: number;
  multiplier: number;
  status: boolean;
}

class RewardClaimerMock {
  state: {
    streakContract: string;
    tokenContract: string;
    authorityContract: string | null;
    rewardRate: number;
    cooldownPeriod: number;
    minReward: number;
    maxReward: number;
    rewardCap: number;
    claimRecords: Map<string, { amount: number; timestamp: number }>;
    lastClaim: Map<string, number>;
    streaks: Map<string, Streak>;
    tokenBalances: Map<string, number>;
  } = {
    streakContract: "SP000000000000000000002Q6VF78",
    tokenContract: "SP000000000000000000002Q6VF78",
    authorityContract: null,
    rewardRate: 100,
    cooldownPeriod: 144,
    minReward: 10,
    maxReward: 10000,
    rewardCap: 50000,
    claimRecords: new Map(),
    lastClaim: new Map(),
    streaks: new Map(),
    tokenBalances: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      streakContract: "SP000000000000000000002Q6VF78",
      tokenContract: "SP000000000000000000002Q6VF78",
      authorityContract: null,
      rewardRate: 100,
      cooldownPeriod: 144,
      minReward: 10,
      maxReward: 10000,
      rewardCap: 50000,
      claimRecords: new Map(),
      lastClaim: new Map(),
      streaks: new Map(),
      tokenBalances: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
  }

  private getKey(user: string, activityType: string): string {
    return `${user}-${activityType}`;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.state.authorityContract !== null)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setStreakContract(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.streakContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setTokenContract(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.tokenContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRewardRate(newRate: number): Result<boolean> {
    if (newRate <= 0) return { ok: false, value: ERR_INVALID_REWARD_RATE };
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.rewardRate = newRate;
    return { ok: true, value: true };
  }

  setCooldownPeriod(newPeriod: number): Result<boolean> {
    if (newPeriod <= 0) return { ok: false, value: ERR_INVALID_COOLDOWN };
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.cooldownPeriod = newPeriod;
    return { ok: true, value: true };
  }

  setRewardCap(newCap: number): Result<boolean> {
    if (newCap <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (!this.state.authorityContract)
      return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.rewardCap = newCap;
    return { ok: true, value: true };
  }

  getClaimRecord(
    user: string,
    activityType: string
  ): Result<{ amount: number; timestamp: number }> {
    return {
      ok: true,
      value: this.state.claimRecords.get(this.getKey(user, activityType)) || {
        amount: 0,
        timestamp: 0,
      },
    };
  }

  getLastClaim(user: string, activityType: string): Result<number> {
    return {
      ok: true,
      value: this.state.lastClaim.get(this.getKey(user, activityType)) || 0,
    };
  }

  getRewardRate(): Result<number> {
    return { ok: true, value: this.state.rewardRate };
  }

  getCooldownPeriod(): Result<number> {
    return { ok: true, value: this.state.cooldownPeriod };
  }

  setMockStreak(user: string, activityType: string, streak: Streak) {
    this.state.streaks.set(this.getKey(user, activityType), streak);
  }

  setMockBalance(user: string, balance: number) {
    this.state.tokenBalances.set(user, balance);
  }

  getStreak(user: string, activityType: string): Result<Streak | null> {
    const streak = this.state.streaks.get(this.getKey(user, activityType));
    return { ok: true, value: streak || null };
  }

  mint(amount: number, receiver: string): Result<boolean> {
    this.state.tokenBalances.set(
      receiver,
      (this.state.tokenBalances.get(receiver) || 0) + amount
    );
    return { ok: true, value: true };
  }

  claimReward(activityType: string): Result<number> {
    if (this.caller !== this.caller)
      return { ok: false, value: ERR_INVALID_USER };
    const key = this.getKey(this.caller, activityType);
    const streak = this.state.streaks.get(key);
    if (!streak || !streak.status)
      return { ok: false, value: ERR_INVALID_STREAK };
    const lastClaim = this.state.lastClaim.get(key) || 0;
    if (this.blockHeight < lastClaim + this.state.cooldownPeriod)
      return { ok: false, value: ERR_COOLDOWN_ACTIVE };
    const rewardAmount =
      streak.currentLength * streak.multiplier * this.state.rewardRate;
    if (
      rewardAmount < this.state.minReward ||
      rewardAmount > this.state.maxReward
    )
      return { ok: false, value: ERR_INVALID_AMOUNT };
    if (rewardAmount > this.state.rewardCap)
      return { ok: false, value: ERR_REWARD_CAP_EXCEEDED };
    this.state.tokenBalances.set(
      this.caller,
      (this.state.tokenBalances.get(this.caller) || 0) + rewardAmount
    );
    this.state.claimRecords.set(key, {
      amount: rewardAmount,
      timestamp: this.blockHeight,
    });
    this.state.lastClaim.set(key, this.blockHeight);
    return { ok: true, value: rewardAmount };
  }
}

describe("RewardClaimer", () => {
  let contract: RewardClaimerMock;

  beforeEach(() => {
    contract = new RewardClaimerMock();
    contract.reset();
  });

  it("rejects claim with invalid streak", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.claimReward("meditation");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STREAK);
  });

  it("rejects claim during cooldown", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMockStreak("ST1TEST", "meditation", {
      currentLength: 7,
      multiplier: 2,
      status: true,
    });
    contract.claimReward("meditation");
    contract.blockHeight += 100;
    const result = contract.claimReward("meditation");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_COOLDOWN_ACTIVE);
  });

  it("sets reward rate successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRewardRate(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getRewardRate().value).toBe(200);
  });

  it("rejects invalid reward rate", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRewardRate(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REWARD_RATE);
  });

  it("sets cooldown period successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCooldownPeriod(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getCooldownPeriod().value).toBe(200);
  });

  it("rejects invalid cooldown period", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCooldownPeriod(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_COOLDOWN);
  });

  it("sets streak contract successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setStreakContract("ST3TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.streakContract).toBe("ST3TEST");
  });

  it("rejects streak contract without authority", () => {
    const result = contract.setStreakContract("ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("sets token contract successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setTokenContract("ST4TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.tokenContract).toBe("ST4TEST");
  });

  it("rejects token contract without authority", () => {
    const result = contract.setTokenContract("ST4TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("sets reward cap successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRewardCap(100000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.rewardCap).toBe(100000);
  });
});
