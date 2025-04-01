import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  batches: new Map(),
  batchHistory: new Map(),
  historyCounts: new Map(),
  blockHeight: 100, // Mock block height
  
  // Constants
  ERR_NOT_AUTHORIZED: 100,
  ERR_BATCH_EXISTS: 101,
  ERR_BATCH_NOT_FOUND: 102,
  ERR_NOT_CURRENT_CUSTODIAN: 103,
  
  // Helper function to create a composite key for maps
  createBatchKey(batchId) {
    return `batch-${batchId}`;
  },
  
  createHistoryKey(batchId, index) {
    return `batch-${batchId}-history-${index}`;
  },
  
  // Contract functions
  registerBatch(batchId, productId, productionDate, expiryDate) {
    const manufacturer = this.txSender;
    const batchKey = this.createBatchKey(batchId);
    
    if (this.batches.has(batchKey)) {
      return { error: this.ERR_BATCH_EXISTS };
    }
    
    // Set initial batch data
    this.batches.set(batchKey, {
      manufacturer,
      productId,
      productionDate,
      expiryDate,
      currentCustodian: manufacturer,
      status: 'produced'
    });
    
    // Initialize history count
    this.historyCounts.set(batchKey, { count: 1 });
    
    // Record first history entry
    this.batchHistory.set(this.createHistoryKey(batchId, 0), {
      timestamp: this.blockHeight,
      custodian: manufacturer,
      action: 'produced'
    });
    
    return { value: true };
  },
  
  transferBatch(batchId, newCustodian, action) {
    const batchKey = this.createBatchKey(batchId);
    
    if (!this.batches.has(batchKey)) {
      return { error: this.ERR_BATCH_NOT_FOUND };
    }
    
    const batchData = this.batches.get(batchKey);
    
    // Verify sender is current custodian
    if (this.txSender !== batchData.currentCustodian) {
      return { error: this.ERR_NOT_CURRENT_CUSTODIAN };
    }
    
    // Get current history count
    const historyData = this.historyCounts.get(batchKey);
    const currentCount = historyData.count;
    
    // Update batch data
    this.batches.set(batchKey, {
      ...batchData,
      currentCustodian: newCustodian,
      status: action
    });
    
    // Add history entry
    this.batchHistory.set(this.createHistoryKey(batchId, currentCount), {
      timestamp: this.blockHeight,
      custodian: newCustodian,
      action
    });
    
    // Update history count
    this.historyCounts.set(batchKey, { count: currentCount + 1 });
    
    return { value: true };
  },
  
  getBatchInfo(batchId) {
    const batchKey = this.createBatchKey(batchId);
    return this.batches.get(batchKey);
  },
  
  getBatchHistoryEntry(batchId, index) {
    return this.batchHistory.get(this.createHistoryKey(batchId, index));
  },
  
  getHistoryCount(batchId) {
    const batchKey = this.createBatchKey(batchId);
    return this.historyCounts.get(batchKey) || { count: 0 };
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

describe('Batch Tracking Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.batches = new Map();
    mockContract.batchHistory = new Map();
    mockContract.historyCounts = new Map();
    mockContract.blockHeight = 100;
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'; // Manufacturer
  });
  
  it('should register a new batch successfully', () => {
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const productionDate = 20230101;
    const expiryDate = 20250101;
    
    const result = mockContract.registerBatch(batchId, productId, productionDate, expiryDate);
    
    expect(result).toEqual({ value: true });
    
    const batchInfo = mockContract.getBatchInfo(batchId);
    expect(batchInfo).toEqual({
      manufacturer: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      productId: 'PROD001',
      productionDate: 20230101,
      expiryDate: 20250101,
      currentCustodian: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      status: 'produced'
    });
    
    const historyCount = mockContract.getHistoryCount(batchId);
    expect(historyCount).toEqual({ count: 1 });
    
    const historyEntry = mockContract.getBatchHistoryEntry(batchId, 0);
    expect(historyEntry).toEqual({
      timestamp: 100,
      custodian: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      action: 'produced'
    });
  });
  
  it('should fail to register a batch that already exists', () => {
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const productionDate = 20230101;
    const expiryDate = 20250101;
    
    // First registration should succeed
    mockContract.registerBatch(batchId, productId, productionDate, expiryDate);
    
    // Second registration should fail
    const result = mockContract.registerBatch(batchId, productId, productionDate, expiryDate);
    
    expect(result).toEqual({ error: mockContract.ERR_BATCH_EXISTS });
  });
  
  it('should transfer batch custody successfully', () => {
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const productionDate = 20230101;
    const expiryDate = 20250101;
    const distributor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // First register the batch
    mockContract.registerBatch(batchId, productId, productionDate, expiryDate);
    
    // Advance block height
    mockContract.advanceBlockHeight(10);
    
    // Transfer custody
    const result = mockContract.transferBatch(batchId, distributor, 'shipped');
    
    expect(result).toEqual({ value: true });
    
    const batchInfo = mockContract.getBatchInfo(batchId);
    expect(batchInfo.currentCustodian).toBe(distributor);
    expect(batchInfo.status).toBe('shipped');
    
    const historyCount = mockContract.getHistoryCount(batchId);
    expect(historyCount).toEqual({ count: 2 });
    
    const historyEntry = mockContract.getBatchHistoryEntry(batchId, 1);
    expect(historyEntry).toEqual({
      timestamp: 110,
      custodian: distributor,
      action: 'shipped'
    });
  });
  
  it('should fail to transfer batch if sender is not current custodian', () => {
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const productionDate = 20230101;
    const expiryDate = 20250101;
    const distributor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // First register the batch
    mockContract.registerBatch(batchId, productId, productionDate, expiryDate);
    
    // Set a different sender who is not the custodian
    mockContract.setTxSender('ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7WZ5S');
    
    // Attempt to transfer custody
    const result = mockContract.transferBatch(batchId, distributor, 'shipped');
    
    expect(result).toEqual({ error: mockContract.ERR_NOT_CURRENT_CUSTODIAN });
    
    // Verify batch data hasn't changed
    const batchInfo = mockContract.getBatchInfo(batchId);
    expect(batchInfo.currentCustodian).toBe('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    expect(batchInfo.status).toBe('produced');
  });
  
  it('should fail to transfer a non-existent batch', () => {
    const batchId = 'NONEXISTENT';
    const distributor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = mockContract.transferBatch(batchId, distributor, 'shipped');
    
    expect(result).toEqual({ error: mockContract.ERR_BATCH_NOT_FOUND });
  });
});
