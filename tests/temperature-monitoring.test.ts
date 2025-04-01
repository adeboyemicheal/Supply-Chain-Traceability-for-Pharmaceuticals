
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("example tests", () => {
  it("ensures simnet is well initalised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
aimport { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  temperatureRecords: new Map(),
  batchThresholds: new Map(),
  temperatureViolations: new Map(),
  blockHeight: 100, // Mock block height
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  
  // Constants
  ERR_NOT_AUTHORIZED: 100,
  ERR_INVALID_PARAMETERS: 101,
  ERR_THRESHOLD_NOT_SET: 102,
  
  // Helper function to create composite keys for maps
  createTempRecordKey(batchId, timestamp) {
    return `batch-${batchId}-temp-${timestamp}`;
  },
  
  createBatchKey(batchId) {
    return `batch-${batchId}`;
  },
  
  // Contract functions
  setBatchThresholds(batchId, minTemp, maxTemp, minHumidity, maxHumidity) {
    if (minTemp >= maxTemp) {
      return { error: this.ERR_INVALID_PARAMETERS };
    }
    
    if (minHumidity >= maxHumidity) {
      return { error: this.ERR_INVALID_PARAMETERS };
    }
    
    const batchKey = this.createBatchKey(batchId);
    
    this.batchThresholds.set(batchKey, {
      minTemp,
      maxTemp,
      minHumidity,
      maxHumidity
    });
    
    // Initialize violation count if not exists
    if (!this.temperatureViolations.has(batchKey)) {
      this.temperatureViolations.set(batchKey, { count: 0 });
    }
    
    return { value: true };
  },
  
  recordTemperature(batchId, temperature, humidity, location) {
    const batchKey = this.createBatchKey(batchId);
    
    if (!this.batchThresholds.has(batchKey)) {
      return { error: this.ERR_THRESHOLD_NOT_SET };
    }
    
    const thresholds = this.batchThresholds.get(batchKey);
    const recordKey = this.createTempRecordKey(batchId, this.blockHeight);
    
    // Record the temperature data
    this.temperatureRecords.set(recordKey, {
      temperature,
      humidity,
      recorder: this.txSender,
      location
    });
    
    // Check for violations
    let violationDetected = false;
    if (temperature < thresholds.minTemp ||
        temperature > thresholds.maxTemp ||
        humidity < thresholds.minHumidity ||
        humidity > thresholds.maxHumidity) {
      
      violationDetected = true;
      const currentViolations = this.temperatureViolations.get(batchKey) || { count: 0 };
      this.temperatureViolations.set(batchKey, {
        count: currentViolations.count + 1
      });
      
      return { value: false }; // Return false to indicate violation
    }
    
    return { value: true };
  },
  
  getTemperatureRecord(batchId, timestamp) {
    const recordKey = this.createTempRecordKey(batchId, timestamp);
    return this.temperatureRecords.get(recordKey);
  },
  
  getBatchThresholds(batchId) {
    const batchKey = this.createBatchKey(batchId);
    return this.batchThresholds.get(batchKey);
  },
  
  getViolationCount(batchId) {
    const batchKey = this.createBatchKey(batchId);
    return this.temperatureViolations.get(batchKey) || { count: 0 };
  },
  
  // Helper to set tx-sender for testing
  setTxSender(sender) {
    this.txSender = sender;
  },
  
  // Helper to advance block height
  advanceBlockHeight(blocks) {
    this.blockHeight += blocks;
  }
};

describe('Temperature Monitoring Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.temperatureRecords = new Map();
    mockContract.batchThresholds = new Map();
    mockContract.temperatureViolations = new Map();
    mockContract.blockHeight = 100;
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  });
  
  it('should set batch thresholds successfully', () => {
    const batchId = 'BATCH001';
    const minTemp = -5;
    const maxTemp = 25;
    const minHumidity = 30;
    const maxHumidity = 60;
    
    const result = mockContract.setBatchThresholds(batchId, minTemp, maxTemp, minHumidity, maxHumidity);
    
    expect(result).toEqual({ value: true });
    
    const thresholds = mockContract.getBatchThresholds(batchId);
    expect(thresholds).toEqual({
      minTemp: -5,
      maxTemp: 25,
      minHumidity: 30,
      maxHumidity: 60
    });
    
    const violations = mockContract.getViolationCount(batchId);
    expect(violations).toEqual({ count: 0 });
  });
  
  it('should fail to set invalid thresholds', () => {
    const batchId = 'BATCH001';
    
    // Min temp greater than max temp
    let result = mockContract.setBatchThresholds(batchId, 30, 25, 30, 60);
    expect(result).toEqual({ error: mockContract.ERR_INVALID_PARAMETERS });
    
    // Min humidity greater than max humidity
    result = mockContract.setBatchThresholds(batchId, -5, 25, 70, 60);
    expect(result).toEqual({ error: mockContract.ERR_INVALID_PARAMETERS });
  });
  
  it('should record temperature within thresholds', () => {
    const batchId = 'BATCH001';
    const minTemp = -5;
    const maxTemp = 25;
    const minHumidity = 30;
    const maxHumidity = 60;
    
    // Set thresholds
    mockContract.setBatchThresholds(batchId, minTemp, maxTemp, minHumidity, maxHumidity);
    
    // Record temperature within thresholds
    const result = mockContract.recordTemperature(batchId, 15, 45, 'Warehouse A');
    
    expect(result).toEqual({ value: true });
    
    const record = mockContract.getTemperatureRecord(batchId, 100);
    expect(record).toEqual({
      temperature: 15,
      humidity: 45,
      recorder: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      location: 'Warehouse A'
    });
    
    const violations = mockContract.getViolationCount(batchId);
    expect(violations).toEqual({ count: 0 });
  });
  
  it('should detect temperature violations', () => {
    const batchId = 'BATCH001';
    const minTemp = -5;
    const maxTemp = 25;
    const minHumidity = 30;
    const maxHumidity = 60;
    
    // Set thresholds
    mockContract.setBatchThresholds(batchId, minTemp, maxTemp, minHumidity, maxHumidity);
    
    // Record temperature above max threshold
    let result = mockContract.recordTemperature(batchId, 30, 45, 'Warehouse A');
    expect(result).toEqual({ value: false });
    
    // Advance block height
    mockContract.advanceBlockHeight(1);
    
    // Record humidity below min threshold
    result = mockContract.recordTemperature(batchId, 15, 25, 'Warehouse B');
    expect(result).toEqual({ value: false });
    
    const violations = mockContract.getViolationCount(batchId);
    expect(violations).toEqual({ count: 2 });
  });
  
  it('should fail to record temperature without thresholds set', () => {
    const batchId = 'BATCH001';
    
    const result = mockContract.recordTemperature(batchId, 15, 45, 'Warehouse A');
    
    expect(result).toEqual({ error: mockContract.ERR_THRESHOLD_NOT_SET });
  });
});
