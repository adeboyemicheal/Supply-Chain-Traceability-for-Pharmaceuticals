import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract environment
const mockContract = {
  verifiedManufacturers: new Map(),
  admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Mock admin address
  txSender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Initial sender is admin
  
  // Constants
  ERR_NOT_AUTHORIZED: 100,
  ERR_ALREADY_VERIFIED: 101,
  ERR_NOT_FOUND: 102,
  
  // Contract functions
  verifyManufacturer(manufacturer) {
    if (this.txSender !== this.admin) {
      return { error: this.ERR_NOT_AUTHORIZED };
    }
    
    if (this.verifiedManufacturers.has(manufacturer)) {
      return { error: this.ERR_ALREADY_VERIFIED };
    }
    
    this.verifiedManufacturers.set(manufacturer, true);
    return { value: true };
  },
  
  revokeVerification(manufacturer) {
    if (this.txSender !== this.admin) {
      return { error: this.ERR_NOT_AUTHORIZED };
    }
    
    if (!this.verifiedManufacturers.has(manufacturer)) {
      return { error: this.ERR_NOT_FOUND };
    }
    
    this.verifiedManufacturers.delete(manufacturer);
    return { value: true };
  },
  
  isVerified(manufacturer) {
    return this.verifiedManufacturers.has(manufacturer);
  },
  
  transferAdmin(newAdmin) {
    if (this.txSender !== this.admin) {
      return { error: this.ERR_NOT_AUTHORIZED };
    }
    
    this.admin = newAdmin;
    return { value: true };
  },
  
  // Helper to set tx-sender for testing
  setTxSender(sender) {
    this.txSender = sender;
  }
};

describe('Manufacturer Verification Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    mockContract.verifiedManufacturers.clear();
    mockContract.admin = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
    mockContract.txSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  });
  
  it('should verify a manufacturer successfully', () => {
    const manufacturer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const result = mockContract.verifyManufacturer(manufacturer);
    
    expect(result).toEqual({ value: true });
    expect(mockContract.isVerified(manufacturer)).toBe(true);
  });
  
  it('should fail to verify a manufacturer if not admin', () => {
    mockContract.setTxSender('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    const manufacturer = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7WZ5S';
    
    const result = mockContract.verifyManufacturer(manufacturer);
    
    expect(result).toEqual({ error: mockContract.ERR_NOT_AUTHORIZED });
    expect(mockContract.isVerified(manufacturer)).toBe(false);
  });
  
  it('should fail to verify an already verified manufacturer', () => {
    const manufacturer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // First verification should succeed
    mockContract.verifyManufacturer(manufacturer);
    
    // Second verification should fail
    const result = mockContract.verifyManufacturer(manufacturer);
    
    expect(result).toEqual({ error: mockContract.ERR_ALREADY_VERIFIED });
  });
  
  it('should revoke verification successfully', () => {
    const manufacturer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    // First verify the manufacturer
    mockContract.verifyManufacturer(manufacturer);
    expect(mockContract.isVerified(manufacturer)).toBe(true);
    
    // Then revoke verification
    const result = mockContract.revokeVerification(manufacturer);
    
    expect(result).toEqual({ value: true });
    expect(mockContract.isVerified(manufacturer)).toBe(false);
  });
  
  it('should fail to revoke verification if manufacturer not found', () => {
    const manufacturer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = mockContract.revokeVerification(manufacturer);
    
    expect(result).toEqual({ error: mockContract.ERR_NOT_FOUND });
  });
  
  it('should transfer admin rights successfully', () => {
    const newAdmin = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    
    const result = mockContract.transferAdmin(newAdmin);
    
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe(newAdmin);
    
    // Test that the new admin can verify manufacturers
    mockContract.setTxSender(newAdmin);
    const manufacturer = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7WZ5S';
    const verifyResult = mockContract.verifyManufacturer(manufacturer);
    
    expect(verifyResult).toEqual({ value: true });
  });
});
