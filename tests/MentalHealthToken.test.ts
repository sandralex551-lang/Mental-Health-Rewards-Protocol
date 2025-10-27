import { describe, it, expect, beforeEach } from "vitest";
import { ClarityValue, stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_AMOUNT = 101;
const ERR_INSUFFICIENT_BALANCE = 102;
const ERR_INVALID_RECEIVER = 103;
const ERR_INVALID_MINTER = 104;
const ERR_INVALID_BURNER = 105;
const ERR_AUTHORITY_NOT_VERIFIED = 106;
const ERR_INVALID_MINT_CAP = 107;
const ERR_INVALID_BURN_CAP = 108;
const ERR_TRANSFER_DISABLED = 109;
const ERR_MAX_SUPPLY_EXCEEDED = 111;
const ERR_INVALID_METADATA = 112;

interface Result<T> {
  ok: boolean;
  value: T;
}

class MentalHealthTokenMock {
  state: {
    totalSupply: number;
    mintCap: number;
    burnCap: number;
    transferEnabled: boolean;
    authorityContract: string | null;
    tokenUri: string;
    minters: Map<string, boolean>;
    balances: Map<string, number>;
    allowances: Map<string, number>;
    mintRecords: Map<string, number>;
    burnRecords: Map<string, number>;
  } = {
    totalSupply: 0,
    mintCap: 1000000,
    burnCap: 500000,
    transferEnabled: true,
    authorityContract: null,
    tokenUri: "https://x.ai/mht",
    minters: new Map(),
    balances: new Map(),
    allowances: new Map(),
    mintRecords: new Map(),
    burnRecords: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  maxSupply: number = 1000000000;

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      totalSupply: 0,
      mintCap: 1000000,
      burnCap: 500000,
      transferEnabled: true,
      authorityContract: null,
      tokenUri: "https://x.ai/mht",
      minters: new Map(),
      balances: new Map(),
      allowances: new Map(),
      mintRecords: new Map(),
      burnRecords: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
  }

  private getAllowanceKey(owner: string, spender: string): string {
    return `${owner}-${spender}`;
  }

  private getRecordKey(user: string, timestamp: number): string {
    return `${user}-${timestamp}`;
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMinter(minter: string, enabled: boolean): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (minter === this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.minters.set(minter, enabled);
    return { ok: true, value: true };
  }

  setMintCap(newCap: number): Result<boolean> {
    if (newCap <= 0) return { ok: false, value: ERR_INVALID_MINT_CAP };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.mintCap = newCap;
    return { ok: true, value: true };
  }

  setBurnCap(newCap: number): Result<boolean> {
    if (newCap <= 0) return { ok: false, value: ERR_INVALID_BURN_CAP };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.burnCap = newCap;
    return { ok: true, value: true };
  }

  setTransferEnabled(enabled: boolean): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.transferEnabled = enabled;
    return { ok: true, value: true };
  }

  setTokenUri(newUri: string): Result<boolean> {
    if (!newUri) return { ok: false, value: ERR_INVALID_METADATA };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.tokenUri = newUri;
    return { ok: true, value: true };
  }

  getBalance(account: string): Result<number> {
    return { ok: true, value: this.state.balances.get(account) || 0 };
  }

  getTotalSupply(): Result<number> {
    return { ok: true, value: this.state.totalSupply };
  }

  getName(): Result<string> {
    return { ok: true, value: "MentalHealthToken" };
  }

  getSymbol(): Result<string> {
    return { ok: true, value: "MHT" };
  }

  getDecimals(): Result<number> {
    return { ok: true, value: 6 };
  }

  getTokenUri(): Result<string | null> {
    return { ok: true, value: this.state.tokenUri };
  }

  getAllowance(owner: string, spender: string): Result<number> {
    return { ok: true, value: this.state.allowances.get(this.getAllowanceKey(owner, spender)) || 0 };
  }

  getMintRecord(minter: string, timestamp: number): Result<number> {
    return { ok: true, value: this.state.mintRecords.get(this.getRecordKey(minter, timestamp)) || 0 };
  }

  getBurnRecord(burner: string, timestamp: number): Result<number> {
    return { ok: true, value: this.state.burnRecords.get(this.getRecordKey(burner, timestamp)) || 0 };
  }

  transfer(amount: number, sender: string, receiver: string): Result<boolean> {
    if (!this.state.transferEnabled) return { ok: false, value: ERR_TRANSFER_DISABLED };
    if (sender !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (receiver === sender) return { ok: false, value: ERR_INVALID_RECEIVER };
    const senderBalance = this.state.balances.get(sender) || 0;
    if (senderBalance < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.balances.set(sender, senderBalance - amount);
    this.state.balances.set(receiver, (this.state.balances.get(receiver) || 0) + amount);
    return { ok: true, value: true };
  }

  approve(spender: string, amount: number): Result<boolean> {
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (spender === this.caller) return { ok: false, value: ERR_INVALID_RECEIVER };
    this.state.allowances.set(this.getAllowanceKey(this.caller, spender), amount);
    return { ok: true, value: true };
  }

  transferFrom(owner: string, receiver: string, amount: number): Result<boolean> {
    if (!this.state.transferEnabled) return { ok: false, value: ERR_TRANSFER_DISABLED };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (receiver === owner) return { ok: false, value: ERR_INVALID_RECEIVER };
    const allowance = this.state.allowances.get(this.getAllowanceKey(owner, this.caller)) || 0;
    if (allowance < amount) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const ownerBalance = this.state.balances.get(owner) || 0;
    if (ownerBalance < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.allowances.set(this.getAllowanceKey(owner, this.caller), allowance - amount);
    this.state.balances.set(owner, ownerBalance - amount);
    this.state.balances.set(receiver, (this.state.balances.get(receiver) || 0) + amount);
    return { ok: true, value: true };
  }

  mint(amount: number, receiver: string): Result<boolean> {
    if (!this.state.minters.get(this.caller)) return { ok: false, value: ERR_INVALID_MINTER };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (receiver === this.caller) return { ok: false, value: ERR_INVALID_RECEIVER };
    if (amount > this.state.mintCap) return { ok: false, value: ERR_INVALID_MINT_CAP };
    const newSupply = this.state.totalSupply + amount;
    if (newSupply > this.maxSupply) return { ok: false, value: ERR_MAX_SUPPLY_EXCEEDED };
    this.state.balances.set(receiver, (this.state.balances.get(receiver) || 0) + amount);
    this.state.totalSupply = newSupply;
    this.state.mintRecords.set(this.getRecordKey(this.caller, this.blockHeight), amount);
    return { ok: true, value: true };
  }

  burn(amount: number, owner: string): Result<boolean> {
    if (owner !== this.caller) return { ok: false, value: ERR_INVALID_BURNER };
    if (amount <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (amount > this.state.burnCap) return { ok: false, value: ERR_INVALID_BURN_CAP };
    const ownerBalance = this.state.balances.get(owner) || 0;
    if (ownerBalance < amount) return { ok: false, value: ERR_INSUFFICIENT_BALANCE };
    this.state.balances.set(owner, ownerBalance - amount);
    this.state.totalSupply -= amount;
    this.state.burnRecords.set(this.getRecordKey(owner, this.blockHeight), amount);
    return { ok: true, value: true };
  }
}

describe("MentalHealthToken", () => {
  let contract: MentalHealthTokenMock;

  beforeEach(() => {
    contract = new MentalHealthTokenMock();
    contract.reset();
  });

  it("rejects mint by non-minter", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.mint(1000, "ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MINTER);
  });

  it("rejects burn by non-owner", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMinter("ST1TEST", true);
    contract.mint(1000, "ST3TEST");
    contract.caller = "ST2TEST";
    const result = contract.burn(500, "ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_BURNER);
  });

  it("rejects transfer when disabled", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMinter("ST1TEST", true);
    contract.mint(1000, "ST1TEST");
    contract.setTransferEnabled(false);
    const result = contract.transfer(500, "ST1TEST", "ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_TRANSFER_DISABLED);
  });

  it("rejects transfer with insufficient balance", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMinter("ST1TEST", true);
    contract.mint(100, "ST1TEST");
    const result = contract.transfer(500, "ST1TEST", "ST3TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INSUFFICIENT_BALANCE);
  });

  it("rejects transfer-from with insufficient allowance", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMinter("ST1TEST", true);
    contract.mint(1000, "ST1TEST");
    contract.approve("ST2TEST", 200);
    contract.caller = "ST2TEST";
    const result = contract.transferFrom("ST1TEST", "ST3TEST", 300);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets token URI successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setTokenUri("https://new-uri.com");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.getTokenUri().value).toBe("https://new-uri.com");
  });

  it("rejects invalid token URI", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setTokenUri("");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_METADATA);
  });

  it("returns correct metadata", () => {
    expect(contract.getName().value).toBe("MentalHealthToken");
    expect(contract.getSymbol().value).toBe("MHT");
    expect(contract.getDecimals().value).toBe(6);
    expect(contract.getTokenUri().value).toBe("https://x.ai/mht");
  });
});