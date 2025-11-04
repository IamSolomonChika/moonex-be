import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  encodeFunctionData,
  decodeFunctionResult,
  parseABIString,
  validateABI,
  getFunctionSelector,
  getEventTopic,
  encodeEventLog,
  decodeEventLog,
  batchEncodeFunctionData,
  batchDecodeFunctionResults,
  formatABI,
  minifyABI,
  compareABIs,
  ABICache,
  abiCache
} from '../bsc/utils/abi-utils';
import { Abi } from 'viem';

/**
 * Test ABI Encoding/Decoding Utilities for Viem
 * These tests validate that ABI utilities are properly migrated to Viem
 * and functioning as expected during the Ethers.js to Viem migration.
 */

describe('ABI Encoding/Decoding Utilities Viem Tests', () => {
  const mockABI: Abi = [
    {
      type: 'function',
      name: 'balanceOf',
      inputs: [{ type: 'address', name: 'account' }],
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view'
    },
    {
      type: 'function',
      name: 'transfer',
      inputs: [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'amount' }
      ],
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable'
    },
    {
      type: 'event',
      name: 'Transfer',
      inputs: [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' },
        { type: 'uint256', indexed: false, name: 'value' }
      ]
    }
  ] as const;

  beforeEach(() => {
    // Clear cache before each test
    abiCache.clear();
  });

  afterEach(() => {
    // Clean up after each test
    abiCache.clear();
  });

  describe('Function Encoding', () => {
    it('should encode function data with ABI', () => {
      const result = encodeFunctionData(
        'balanceOf',
        ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
        mockABI
      );

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(result.length).toBeGreaterThan(10);
    });

    it('should encode function data without ABI', () => {
      const result = encodeFunctionData('testFunction', ['arg1', 'arg2']);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should handle empty arguments', () => {
      const result = encodeFunctionData('noArgsFunction', [], mockABI);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should throw on invalid function name', () => {
      expect(() => {
        encodeFunctionData('', ['arg1'], mockABI);
      }).toThrow();
    });
  });

  describe('Function Decoding', () => {
    it('should decode function result with ABI', () => {
      const mockData = '0x0000000000000000000000000000000000000000000000000000000000000001' as const;

      const result = decodeFunctionResult('balanceOf', mockData, mockABI);

      expect(result).toBeDefined();
    });

    it('should decode function result without ABI', () => {
      const mockData = '0x0000000000000000000000000000000000000000000000000000000000000001' as const;

      const result = decodeFunctionResult('testFunction', mockData);

      expect(result).toBeDefined();
    });

    it('should handle empty data', () => {
      const result = decodeFunctionResult('testFunction', '0x');

      expect(result).toBeDefined();
    });

    it('should throw on invalid data', () => {
      expect(() => {
        decodeFunctionResult('testFunction', '0xinvalid');
      }).toThrow();
    });
  });

  describe('ABI Parsing', () => {
    it('should parse ABI string', () => {
      const abiString = 'function balanceOf(address account) view returns (uint256)';

      const result = parseABIString(abiString);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle complex ABI string', () => {
      const abiString = 'function transfer(address to, uint256 amount) nonpayable returns (bool)';

      const result = parseABIString(abiString);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw on invalid ABI string', () => {
      expect(() => {
        parseABIString('invalid abi string');
      }).toThrow();
    });

    it('should throw on empty ABI string', () => {
      expect(() => {
        parseABIString('');
      }).toThrow();
    });
  });

  describe('ABI Validation', () => {
    it('should validate correct ABI', () => {
      const result = validateABI(mockABI);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid ABI structure', () => {
      const invalidABI = 'not an array' as any;

      const result = validateABI(invalidABI);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing function properties', () => {
      const invalidABI = [
        {
          type: 'function',
          inputs: [],
          outputs: []
          // Missing name
        }
      ] as any;

      const result = validateABI(invalidABI);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing name'))).toBe(true);
    });

    it('should detect missing event properties', () => {
      const invalidABI = [
        {
          type: 'event',
          inputs: []
          // Missing name
        }
      ] as any;

      const result = validateABI(invalidABI);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing name'))).toBe(true);
    });

    it('should generate warnings for optional properties', () => {
      const abiWithWarnings = [
        {
          type: 'function',
          name: 'testFunction',
          inputs: [],
          outputs: []
          // Missing stateMutability
        }
      ] as any;

      const result = validateABI(abiWithWarnings);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('stateMutability'))).toBe(true);
    });
  });

  describe('Function Selectors', () => {
    it('should generate function selector', () => {
      const inputs = [{ type: 'address', name: 'account' }];

      const result = getFunctionSelector('balanceOf', inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{8}$/);
    });

    it('should handle function with no inputs', () => {
      const result = getFunctionSelector('noArgs', []);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{8}$/);
    });

    it('should handle multiple inputs', () => {
      const inputs = [
        { type: 'address', name: 'to' },
        { type: 'uint256', name: 'amount' }
      ];

      const result = getFunctionSelector('transfer', inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{8}$/);
    });

    it('should handle unnamed inputs', () => {
      const inputs = [{ type: 'uint256' }];

      const result = getFunctionSelector('mint', inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{8}$/);
    });
  });

  describe('Event Topics', () => {
    it('should generate event topic', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' },
        { type: 'uint256', indexed: false, name: 'value' }
      ];

      const result = getEventTopic('Transfer', inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should handle event with no inputs', () => {
      const result = getEventTopic('Approval', []);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should handle all indexed inputs', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'owner' },
        { type: 'address', indexed: true, name: 'spender' }
      ];

      const result = getEventTopic('Approval', inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Event Encoding', () => {
    it('should encode event log with mixed inputs', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' },
        { type: 'uint256', indexed: false, name: 'value' }
      ];
      const values = [
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        '1000000000000000000'
      ];

      const result = encodeEventLog('Transfer', inputs, values);

      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(3); // Event topic + 2 indexed
      expect(result.data).toMatch(/^0x[a-fA-F0-9]*$/);
    });

    it('should encode event log with only non-indexed inputs', () => {
      const inputs = [
        { type: 'uint256', indexed: false, name: 'value' },
        { type: 'string', indexed: false, name: 'message' }
      ];
      const values = ['1000000000000000000', 'Hello'];

      const result = encodeEventLog('Message', inputs, values);

      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(1); // Only event topic
      expect(result.data).toMatch(/^0x[a-fA-F0-9]*$/);
    });

    it('should encode event log with only indexed inputs', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' }
      ];
      const values = [
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
      ];

      const result = encodeEventLog('Transfer', inputs, values);

      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(3); // Event topic + 2 indexed
      expect(result.data).toBe('0x');
    });
  });

  describe('Event Decoding', () => {
    it('should decode event log with mixed inputs', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' },
        { type: 'uint256', indexed: false, name: 'value' }
      ];
      const data = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const topics = [
        '0x' + '0'.repeat(64), // Event topic
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
      ];

      const result = decodeEventLog('Transfer', inputs, data, topics);

      expect(result).toBeDefined();
      expect(result.from).toBeDefined();
      expect(result.to).toBeDefined();
      expect(result.value).toBeDefined();
    });

    it('should decode event log with no indexed inputs', () => {
      const inputs = [
        { type: 'uint256', indexed: false, name: 'value' },
        { type: 'string', indexed: false, name: 'message' }
      ];
      const data = '0x' + '0'.repeat(128);
      const topics = ['0x' + '0'.repeat(64)];

      const result = decodeEventLog('Message', inputs, data, topics);

      expect(result).toBeDefined();
      expect(result.value).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should handle empty data', () => {
      const inputs = [
        { type: 'address', indexed: true, name: 'from' },
        { type: 'address', indexed: true, name: 'to' }
      ];
      const data = '0x';
      const topics = [
        '0x' + '0'.repeat(64),
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
      ];

      const result = decodeEventLog('Transfer', inputs, data, topics);

      expect(result).toBeDefined();
    });
  });

  describe('Batch Function Encoding', () => {
    it('should encode multiple function calls', () => {
      const calls = [
        {
          functionName: 'balanceOf',
          args: ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
          abi: mockABI
        },
        {
          functionName: 'transfer',
          args: ['0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', '1000'],
          abi: mockABI
        }
      ];

      const results = batchEncodeFunctionData(calls);

      expect(results).toHaveLength(2);
      expect(results[0].functionName).toBe('balanceOf');
      expect(results[0].data).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(results[0].error).toBeUndefined();
      expect(results[1].functionName).toBe('transfer');
      expect(results[1].data).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(results[1].error).toBeUndefined();
    });

    it('should handle mixed success and failure', () => {
      const calls = [
        {
          functionName: 'balanceOf',
          args: ['0x742d35Cc6634C0532925a3b844Bc454e4438f44e'],
          abi: mockABI
        },
        {
          functionName: '', // Invalid function name
          args: ['invalid'],
          abi: mockABI
        }
      ];

      const results = batchEncodeFunctionData(calls);

      expect(results).toHaveLength(2);
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeDefined();
    });

    it('should handle empty calls array', () => {
      const results = batchEncodeFunctionData([]);

      expect(results).toHaveLength(0);
    });

    it('should handle calls without ABI', () => {
      const calls = [
        {
          functionName: 'testFunction',
          args: ['arg1']
        }
      ];

      const results = batchEncodeFunctionData(calls);

      expect(results).toHaveLength(1);
      expect(results[0].data).toMatch(/^0x[a-fA-F0-9]+$/);
    });
  });

  describe('Batch Function Decoding', () => {
    it('should decode multiple function results', () => {
      const calls = [
        {
          functionName: 'balanceOf',
          data: '0x0000000000000000000000000000000000000000000000000000000000000001' as const,
          abi: mockABI
        },
        {
          functionName: 'transfer',
          data: '0x0000000000000000000000000000000000000000000000000000000000000001' as const,
          abi: mockABI
        }
      ];

      const results = batchDecodeFunctionResults(calls);

      expect(results).toHaveLength(2);
      expect(results[0].functionName).toBe('balanceOf');
      expect(results[0].result).toBeDefined();
      expect(results[0].error).toBeUndefined();
      expect(results[1].functionName).toBe('transfer');
      expect(results[1].result).toBeDefined();
      expect(results[1].error).toBeUndefined();
    });

    it('should handle invalid data', () => {
      const calls = [
        {
          functionName: 'balanceOf',
          data: '0xinvalid' as const,
          abi: mockABI
        }
      ];

      const results = batchDecodeFunctionResults(calls);

      expect(results).toHaveLength(1);
      expect(results[0].error).toBeDefined();
    });

    it('should handle empty calls array', () => {
      const results = batchDecodeFunctionResults([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('ABI Formatting', () => {
    it('should format ABI for readability', () => {
      const result = formatABI(mockABI);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('"type"');
      expect(result).toContain('"name"');
      expect(result.split('\n').length).toBeGreaterThan(mockABI.length);
    });

    it('should minify ABI', () => {
      const result = minifyABI(mockABI);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('"type"');
      expect(result).toContain('"name"');
      expect(result.split('\n').length).toBe(1); // Single line
    });

    it('should handle different ABI structures', () => {
      const complexABI: Abi = [
        {
          type: 'function',
          name: 'complexFunction',
          inputs: [
            { type: 'address', name: 'user' },
            { type: 'uint256', name: 'amount' },
            { type: 'bool', name: 'flag' },
            { type: 'bytes32', name: 'data' }
          ],
          outputs: [
            { type: 'bool' },
            { type: 'uint256' },
            { type: 'string' }
          ],
          stateMutability: 'view'
        }
      ] as const;

      const formatted = formatABI(complexABI);
      const minified = minifyABI(complexABI);

      expect(formatted).toBeDefined();
      expect(minified).toBeDefined();
      expect(formatted.length).toBeGreaterThan(minified.length);
    });
  });

  describe('ABI Comparison', () => {
    it('should detect compatible ABIs', () => {
      const identicalABI = [...mockABI];

      const result = compareABIs(mockABI, identicalABI);

      expect(result.compatible).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect different lengths', () => {
      const shorterABI = mockABI.slice(0, 1);

      const result = compareABIs(mockABI, shorterABI);

      expect(result.compatible).toBe(false);
      expect(result.differences.some(d => d.includes('Different length'))).toBe(true);
    });

    it('should detect missing functions', () => {
      const abiWithoutTransfer = mockABI.filter(item =>
        !(item.type === 'function' && item.name === 'transfer')
      );

      const result = compareABIs(mockABI, abiWithoutTransfer);

      expect(result.compatible).toBe(false);
      expect(result.differences.some(d => d.includes('transfer') && d.includes('missing'))).toBe(true);
    });

    it('should detect missing events', () => {
      const abiWithoutEvents = mockABI.filter(item =>
        !(item.type === 'event' && item.name === 'Transfer')
      );

      const result = compareABIs(mockABI, abiWithoutEvents);

      expect(result.compatible).toBe(false);
      expect(result.differences.some(d => d.includes('Transfer') && d.includes('missing'))).toBe(true);
    });

    it('should detect different input counts', () => {
      const abiWithDifferentInputs: Abi = [
        {
          type: 'function',
          name: 'balanceOf',
          inputs: [
            { type: 'address', name: 'account' },
            { type: 'uint256', name: 'extraParam' } // Extra parameter
          ],
          outputs: [{ type: 'uint256' }],
          stateMutability: 'view'
        }
      ] as const;

      const result = compareABIs(mockABI, abiWithDifferentInputs);

      expect(result.compatible).toBe(false);
      expect(result.differences.some(d => d.includes('balanceOf') && d.includes('input count'))).toBe(true);
    });

    it('should handle empty ABIs', () => {
      const emptyABI: Abi = [];

      const result = compareABIs(mockABI, emptyABI);

      expect(result.compatible).toBe(false);
      expect(result.differences.length).toBeGreaterThan(0);
    });
  });

  describe('ABI Cache', () => {
    let cache: ABICache;

    beforeEach(() => {
      cache = new ABICache();
    });

    afterEach(() => {
      cache.clear();
    });

    it('should store and retrieve ABI', () => {
      const key = 'test-abi';

      expect(cache.has(key)).toBe(false);
      expect(cache.get(key)).toBeUndefined();

      cache.set(key, mockABI);

      expect(cache.has(key)).toBe(true);
      expect(cache.get(key)).toBe(mockABI);
    });

    it('should report correct size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', mockABI);
      expect(cache.size()).toBe(1);

      cache.set('key2', mockABI);
      expect(cache.size()).toBe(2);
    });

    it('should clear cache', () => {
      cache.set('key1', mockABI);
      cache.set('key2', mockABI);

      expect(cache.size()).toBe(2);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });

    it('should overwrite existing entries', () => {
      const key = 'test-abi';
      const newABI: Abi = [
        {
          type: 'function',
          name: 'newFunction',
          inputs: [],
          outputs: [{ type: 'bool' }],
          stateMutability: 'view'
        }
      ] as const;

      cache.set(key, mockABI);
      expect(cache.get(key)).toBe(mockABI);

      cache.set(key, newABI);
      expect(cache.get(key)).toBe(newABI);
      expect(cache.size()).toBe(1);
    });

    it('should handle many entries', () => {
      const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);

      keys.forEach(key => {
        cache.set(key, mockABI);
      });

      expect(cache.size()).toBe(100);

      keys.forEach(key => {
        expect(cache.has(key)).toBe(true);
        expect(cache.get(key)).toBe(mockABI);
      });
    });
  });

  describe('Global ABI Cache', () => {
    it('should use global cache instance', () => {
      const key = 'global-test';

      expect(abiCache.has(key)).toBe(false);

      abiCache.set(key, mockABI);
      expect(abiCache.has(key)).toBe(true);
      expect(abiCache.get(key)).toBe(mockABI);

      abiCache.clear();
      expect(abiCache.has(key)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle null arguments gracefully', () => {
      expect(() => {
        encodeFunctionData('test', null as any);
      }).toThrow();
    });

    it('should handle undefined ABI gracefully', () => {
      const result = encodeFunctionData('test', ['arg1'], undefined);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]+$/);
    });

    it('should handle circular ABI references', () => {
      const circularABI: any = {};
      circularABI.self = circularABI;

      const result = validateABI(circularABI);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large ABI arrays', () => {
      const largeABI: Abi = Array.from({ length: 1000 }, (_, i) => ({
        type: 'function',
        name: `function${i}`,
        inputs: [],
        outputs: [{ type: 'bool' }],
        stateMutability: 'view'
      })) as any;

      const result = validateABI(largeABI);

      expect(result).toBeDefined();
      // Should handle large arrays without crashing
    });

    it('should handle special characters in function names', () => {
      const specialNames = ['function-with-dashes', 'function_with_underscores', 'function$with$symbols'];

      specialNames.forEach(name => {
        const result = encodeFunctionData(name, []);
        expect(result).toBeDefined();
        expect(result).toMatch(/^0x[a-fA-F0-9]+$/);
      });
    });

    it('should handle Unicode in event names', () => {
      const unicodeName = 'Transfer🚀';
      const inputs = [{ type: 'address', indexed: true, name: 'from' }];

      const result = getEventTopic(unicodeName, inputs);

      expect(result).toBeDefined();
      expect(result).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Performance Tests', () => {
    it('should handle rapid encoding/decoding', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const encoded = encodeFunctionData('balanceOf', [`0x${i.toString(16).padStart(40, '0')}`], mockABI);
        const decoded = decodeFunctionResult('balanceOf', encoded, mockABI);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large batch operations', () => {
      const largeBatch = Array.from({ length: 100 }, (_, i) => ({
        functionName: 'balanceOf',
        args: [`0x${i.toString(16).padStart(40, '0')}`],
        abi: mockABI
      }));

      const startTime = Date.now();
      const results = batchEncodeFunctionData(largeBatch);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle cache performance', () => {
      const cache = new ABICache();

      // Test cache write performance
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, mockABI);
      }
      const writeTime = Date.now() - startTime;

      // Test cache read performance
      const readStartTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(`key-${i}`);
      }
      const readTime = Date.now() - readStartTime;

      expect(writeTime).toBeLessThan(1000); // 1 second for 1000 writes
      expect(readTime).toBeLessThan(500); // 0.5 seconds for 1000 reads

      cache.clear();
    });
  });
});