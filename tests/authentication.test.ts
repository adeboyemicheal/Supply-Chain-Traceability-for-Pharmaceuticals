import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  authenticationCodes: new Map(),
  verificationHistory: new Map(),
  verificationCounts: new Map(),
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
  blockHeight: 100, // Mock block height
  
  // Constants
  ERR_NOT_AUTHORIZED: 100,
  ERR_CODE_EXISTS: 101,
  ERR_CODE_NOT_FOUND: 102,
  ERR_CODE_INVALID: 103,
  
  // Helper function to create composite keys for maps
  createCodeKey(code) {
    return `code-${code}`;
  },
  
  createHistoryKey(code, index) {
    return `code-${code}-history-${index}`;
  },
  
  // Contract functions
  generateAuthenticationCode(code, batchId, productId) {
    const codeKey = this.createCodeKey(code);
    
    if (this.authenticationCodes.has(codeKey)) {
      return { error: this.ERR_CODE_EXISTS };
    }
    
    // Set authentication code data
    this.authenticationCodes.set(codeKey, {
      batchId,
      productId,
      isValid: true,
      verificationCount: 0
    });
    
    // Initialize verification count
    this.verificationCounts.set(codeKey, { count: 0 });
    
    return { value: true };
  },
  
  verifyAuthenticationCode(code, location) {
    const codeKey = this.createCodeKey(code);
    
    if (!this.authenticationCodes.has(codeKey)) {
      return { error: this.ERR_CODE_NOT_FOUND };
    }
    
    const codeData = this.authenticationCodes.get(codeKey);
    
    // Check if code is valid
    if (!codeData.isValid) {
      return { error: this.ERR_CODE_INVALID };
    }
    
    const historyData = this.verificationCounts.get(codeKey);
    const currentCount = historyData.count;
    
    // Update verification count
    this.authenticationCodes.set(codeKey, {
      ...codeData,
      verificationCount: codeData.verificationCount + 1
    });
    
    // Add verification history
    this.verificationHistory.set(this.createHistoryKey(code, currentCount), {
      verifier: this.txSender,
      timestamp: this.blockHeight,
      location
    });
    
    // Update history count
    this.verificationCounts.set(codeKey, { count: currentCount + 1 });
    
    return {
      value: {
        batchId: codeData.batchId,
        productId: codeData.productId,
        verificationCount: codeData.verificationCount + 1
      }
    };
  },
  
  invalidateAuthenticationCode(code) {
    const codeKey = this.createCodeKey(code);
    
    if (!this.authenticationCodes.has(codeKey)) {
      return { error: this.ERR_CODE_NOT_FOUND };
    }
    
    if (this.txSender !== this.admin) {
      return { error: this.ERR_NOT_AUTHORIZED };
    }
    
    const codeData = this.authenticationCodes.get(codeKey);
    
    // Mark code as invalid
    this.authenticationCodes.set(codeKey, {
      ...codeData,
      isValid: false
    });
    
    return { value: true };
  },
  
  getAuthenticationInfo(code) {
    const codeKey = this.createCodeKey(code);
    return this.authenticationCodes.get(codeKey);
  },
  
  getVerificationHistory(code, index) {
    return this.verificationHistory.get(this.createHistoryKey(code, index));
  },
  
  getVerificationCount(code) {
    const codeKey = this.createCodeKey(code);
    return this.verificationCounts.get(codeKey) || { count: 0 };
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

describe('Authentication Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.authenticationCodes = new Map();
    mockContract.verificationHistory = new Map();
    mockContract.verificationCounts = new Map();
    mockContract.blockHeight = 100;
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  });
  
  it('should generate authentication code successfully', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    
    const result = mockContract.generateAuthenticationCode(code, batchId, productId);
    
    expect(result).toEqual({ value: true });
    
    const codeInfo = mockContract.getAuthenticationInfo(code);
    expect(codeInfo).toEqual({
      batchId: 'BATCH001',
      productId: 'PROD001',
      isValid: true,
      verificationCount: 0
    });
    
    const verificationCount = mockContract.getVerificationCount(code);
    expect(verificationCount).toEqual({ count: 0 });
  });
  
  it('should fail to generate duplicate authentication code', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    
    // First generation should succeed
    mockContract.generateAuthenticationCode(code, batchId, productId);
    
    // Second generation should fail
    const result = mockContract.generateAuthenticationCode(code, batchId, productId);
    
    expect(result).toEqual({ error: mockContract.ERR_CODE_EXISTS });
  });
  
  it('should verify authentication code successfully', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const location = 'Pharmacy A';
    
    // Generate the code
    mockContract.generateAuthenticationCode(code, batchId, productId);
    
    // Verify the code
    const result = mockContract.verifyAuthenticationCode(code, location);
    
    expect(result).toEqual({
      value: {
        batchId: 'BATCH001',
        productId: 'PROD001',
        verificationCount: 1
      }
    });
    
    const codeInfo = mockContract.getAuthenticationInfo(code);
    expect(codeInfo.verificationCount).toBe(1);
    
    const verificationCount = mockContract.getVerificationCount(code);
    expect(verificationCount).toEqual({ count: 1 });
    
    const historyEntry = mockContract.getVerificationHistory(code, 0);
    expect(historyEntry).toEqual({
      verifier: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      timestamp: 100,
      location: 'Pharmacy A'
    });
  });
  
  it('should fail to verify non-existent code', () => {
    const code = 'NONEXISTENT';
    const location = 'Pharmacy A';
    
    const result = mockContract.verifyAuthenticationCode(code, location);
    
    expect(result).toEqual({ error: mockContract.ERR_CODE_NOT_FOUND });
  });
  
  it('should fail to verify invalidated code', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    const location = 'Pharmacy A';
    
    // Generate the code
    mockContract.generateAuthenticationCode(code, batchId, productId);
    
    // Invalidate the code
    mockContract.invalidateAuthenticationCode(code);
    
    // Try to verify the code
    const result = mockContract.verifyAuthenticationCode(code, location);
    
    expect(result).toEqual({ error: mockContract.ERR_CODE_INVALID });
  });
  
  it('should invalidate authentication code successfully', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    
    // Generate the code
    mockContract.generateAuthenticationCode(code, batchId, productId);
    
    // Invalidate the code
    const result = mockContract.invalidateAuthenticationCode(code);
    
    expect(result).toEqual({ value: true });
    
    const codeInfo = mockContract.getAuthenticationInfo(code);
    expect(codeInfo.isValid).toBe(false);
  });
  
  it('should fail to invalidate code if not admin', () => {
    const code = 'AUTH123456789';
    const batchId = 'BATCH001';
    const productId = 'PROD001';
    
    // Generate the code
    mockContract.generateAuthenticationCode(code, batchId, productId);
    
    // Set a different sender who is not admin
    mockContract.setTxSender('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    
    // Try to invalidate the code
    const result = mockContract.invalidateAuthenticationCode(code);
    
    expect(result).toEqual({ error: mockContract.ERR_NOT_AUTHORIZED });
    
    const codeInfo = mockContract.getAuthenticationInfo(code);
    expect(codeInfo.isValid).toBe(true);
  });
});
