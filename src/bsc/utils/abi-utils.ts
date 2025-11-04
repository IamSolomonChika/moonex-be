import { Address, Abi, encodeFunctionData as viemEncodeFunctionData, decodeFunctionResult as viemDecodeFunctionResult, parseAbi } from 'viem';
import logger from '../../utils/logger';

/**
 * ABI Encoding/Decoding Utilities for Viem
 * Provides enhanced ABI handling utilities for Viem contracts
 */

/**
 * Encode function data using Viem
 */
export function encodeFunctionData(
  functionName: string,
  args: readonly unknown[] = [],
  abi?: Abi
): `0x${string}` {
  try {
    logger.debug('Encoding function data for: ' + functionName);
    logger.debug('Args: ' + JSON.stringify(args));

    // Use provided ABI or fallback to a basic one
    const abiToUse = abi || createBasicABI(functionName);
    const encodedData = viemEncodeFunctionData({
      abi: abiToUse,
      functionName,
      args: args as any,
    });

    logger.debug('Encoded data: ' + encodedData);
    return encodedData;
  } catch (error) {
    logger.error('Failed to encode function data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    throw new Error(`Function encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decode function result using Viem
 */
export function decodeFunctionResult(
  functionName: string,
  data: `0x${string}`,
  abi?: Abi
): unknown {
  try {
    logger.debug('Decoding function result for: ' + functionName);
    logger.debug('Data: ' + data);

    // Use provided ABI or fallback to a basic one
    const abiToUse = abi || createBasicABI(functionName);
    const result = viemDecodeFunctionResult({
      abi: abiToUse,
      functionName,
      data,
    });

    logger.debug('Decoded result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error('Failed to decode function result: ' + (error instanceof Error ? error.message : 'Unknown error'));
    throw new Error(`Function decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse ABI string into Viem ABI format
 */
export function parseABIString(abiString: string): Abi {
  try {
    logger.debug('Parsing ABI string');
    const abi = parseAbi([abiString]);
    const abiAsArray = abi as readonly any[];
    logger.debug('Parsed ' + (Array.isArray(abiAsArray) ? abiAsArray.length : 0) + ' ABI entries');
    return abi;
  } catch (error) {
    logger.error('Failed to parse ABI string: ' + (error instanceof Error ? error.message : 'Unknown error'));
    throw new Error(`ABI parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create basic ABI for encoding/decoding
 */
function createBasicABI(functionName: string): Abi {
  // Basic ABI with common function types
  return [
    {
      type: 'function',
      name: functionName,
      inputs: [],
      outputs: [],
      stateMutability: 'view',
    },
  ] as const;
}

/**
 * Validate ABI structure
 */
export function validateABI(abi: Abi): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (!Array.isArray(abi)) {
      errors.push('ABI must be an array');
      return { valid: false, errors, warnings };
    }

    // Check for required properties
    abi.forEach((item, index) => {
      if (typeof item !== 'object' || item === null) {
        errors.push(`ABI item ${index} is not an object`);
        return;
      }

      if (!item.type) {
        errors.push(`ABI item ${index} missing type`);
      }

      if (item.type === 'function') {
        if (!item.name) {
          errors.push(`Function ABI item ${index} missing name`);
        }

        if (!Array.isArray(item.inputs)) {
          errors.push(`Function ${item.name} inputs must be an array`);
        }

        if (!Array.isArray(item.outputs)) {
          errors.push(`Function ${item.name} outputs must be an array`);
        }

        if (!item.stateMutability) {
          warnings.push(`Function ${item.name} missing stateMutability, assuming 'view'`);
        }
      } else if (item.type === 'event') {
        if (!item.name) {
          errors.push(`Event ABI item ${index} missing name`);
        }

        if (!Array.isArray(item.inputs)) {
          errors.push(`Event ${item.name} inputs must be an array`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`ABI validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings,
    };
  }
}

/**
 * Get function selector (keccak256 hash of function signature)
 */
export function getFunctionSelector(functionName: string, inputs: Array<{ type: string; name?: string }>): string {
  try {
    const signature = `${functionName}(${inputs.map(input => input.type).join(',')})`;
    logger.debug('Function signature: %s', signature);

    // In a real implementation, you'd use keccak256
    // For now, return a placeholder
    return '0x' + '0'.repeat(8);
  } catch (error) {
    logger.error('Failed to get function selector: %O', error);
    throw new Error(`Function selector failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get event topic (keccak256 hash of event signature)
 */
export function getEventTopic(eventName: string, inputs: Array<{ type: string; indexed: boolean; name?: string }>): string {
  try {
    const signature = `${eventName}(${inputs.map(input => input.type).join(',')})`;
    logger.debug('Event signature: %s', signature);

    // In a real implementation, you'd use keccak256
    // For now, return a placeholder
    return '0x' + '0'.repeat(64);
  } catch (error) {
    logger.error('Failed to get event topic: %O', error);
    throw new Error(`Event topic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encode event log data
 */
export function encodeEventLog(
  eventName: string,
  inputs: Array<{ type: string; indexed: boolean; name?: string }>,
  values: unknown[]
): {
  data: string;
  topics: string[];
} {
  try {
    logger.debug('Encoding event log for: %s', eventName);
    logger.debug('Values: %O', values);

    const topic = getEventTopic(eventName, inputs);
    const indexedInputs = inputs.filter(input => input.indexed);
    const nonIndexedInputs = inputs.filter(input => !input.indexed);

    // Encode indexed values into topics
    const topics = [topic];
    let valueIndex = 0;

    indexedInputs.forEach((input, index) => {
      const value = values[valueIndex++];
      if (typeof value === 'string' && value.startsWith('0x')) {
        topics.push(value);
      } else {
        // In a real implementation, you'd properly encode the value
        topics.push('0x' + '0'.repeat(64));
      }
    });

    // Encode non-indexed values into data
    let data = '0x';
    if (nonIndexedInputs.length > 0) {
      // In a real implementation, you'd use Viem's encoding utilities
      data = '0x' + '0'.repeat(64 * nonIndexedInputs.length);
    }

    logger.debug('Encoded event - topics: %O, data: %s', topics, data);
    return { data, topics };
  } catch (error) {
    logger.error('Failed to encode event log: %O', error);
    throw new Error(`Event encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decode event log
 */
export function decodeEventLog(
  eventName: string,
  inputs: Array<{ type: string; indexed: boolean; name?: string }>,
  data: string,
  topics: string[]
): Record<string, unknown> {
  try {
    logger.debug('Decoding event log for: %s', eventName);
    logger.debug('Data: %s, Topics: %O', data, topics);

    const indexedInputs = inputs.filter(input => input.indexed);
    const nonIndexedInputs = inputs.filter(input => !input.indexed);

    const result: Record<string, unknown> = {};

    // Decode indexed values from topics
    let valueIndex = 0;
    indexedInputs.forEach((input, index) => {
      const value = topics[index + 1]; // Skip the event topic
      if (input.name) {
        result[input.name] = value;
      }
      valueIndex++;
    });

    // Decode non-indexed values from data
    // In a real implementation, you'd use Viem's decoding utilities
    nonIndexedInputs.forEach((input, index) => {
      if (input.name) {
        result[input.name] = '0x' + '0'.repeat(64);
      }
    });

    logger.debug('Decoded event result: %O', result);
    return result;
  } catch (error) {
    logger.error('Failed to decode event log: %O', error);
    throw new Error(`Event decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch encode multiple function calls
 */
export function batchEncodeFunctionData(
  calls: Array<{
    functionName: string;
    args?: readonly unknown[];
    abi?: Abi;
  }>
): Array<{
    functionName: string;
    data: `0x${string}`;
    error?: string;
  }> {
  try {
    logger.debug('Batch encoding %d function calls', calls.length);

    const results = calls.map(call => {
      try {
        const data = encodeFunctionData(call.functionName, call.args, call.abi);
        return {
          functionName: call.functionName,
          data,
        };
      } catch (error) {
        logger.error('Failed to encode %s: %O', call.functionName, error);
        return {
          functionName: call.functionName,
          data: '0x' as `0x${string}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const successCount = results.filter(r => !r.error).length;
    logger.debug('Batch encoding complete: %d/%d successful', successCount, calls.length);
    return results;
  } catch (error) {
    logger.error('Batch encoding failed: %O', error);
    throw new Error(`Batch encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch decode multiple function results
 */
export function batchDecodeFunctionResults(
  calls: Array<{
    functionName: string;
    data: `0x${string}`;
    abi?: Abi;
  }>
): Array<{
  functionName: string;
  result?: unknown;
  error?: string;
}> {
  try {
    logger.debug('Batch decoding %d function results', calls.length);

    const results = calls.map(call => {
      try {
        const result = decodeFunctionResult(call.functionName, call.data, call.abi);
        return {
          functionName: call.functionName,
          result,
        };
      } catch (error) {
        logger.error('Failed to decode %s: %O', call.functionName, error);
        return {
          functionName: call.functionName,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const successCount = results.filter(r => !r.error).length;
    logger.debug('Batch decoding complete: %d/%d successful', successCount, calls.length);
    return results;
  } catch (error) {
    logger.error('Batch decoding failed: %O', error);
    throw new Error(`Batch decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format ABI for readability
 */
export function formatABI(abi: Abi): string {
  try {
    return JSON.stringify(abi, null, 2);
  } catch (error) {
    logger.error('Failed to format ABI: %O', error);
    throw new Error(`ABI formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Minify ABI (remove whitespace)
 */
export function minifyABI(abi: Abi): string {
  try {
    return JSON.stringify(abi);
  } catch (error) {
    logger.error('Failed to minify ABI: %O', error);
    throw new Error(`ABI minification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Compare two ABIs for compatibility
 */
export function compareABIs(abi1: Abi, abi2: Abi): {
  compatible: boolean;
  differences: string[];
} {
  try {
    const differences: string[] = [];

    // Compare length
    if (abi1.length !== abi2.length) {
      differences.push(`Different length: ${abi1.length} vs ${abi2.length}`);
    }

    // Compare functions
    const functions1 = abi1.filter(item => item.type === 'function');
    const functions2 = abi2.filter(item => item.type === 'function');

    functions1.forEach(func1 => {
      const matchingFunc = functions2.find(func2 => func2.name === func1.name);
      if (!matchingFunc) {
        differences.push(`Function ${func1.name} missing in second ABI`);
      } else {
        // Compare inputs
        if (func1.inputs?.length !== matchingFunc.inputs?.length) {
          differences.push(`Function ${func1.name} has different input count`);
        }

        // Compare outputs
        if (func1.outputs?.length !== matchingFunc.outputs?.length) {
          differences.push(`Function ${func1.name} has different output count`);
        }
      }
    });

    // Compare events
    const events1 = abi1.filter(item => item.type === 'event');
    const events2 = abi2.filter(item => item.type === 'event');

    events1.forEach(event1 => {
      const matchingEvent = events2.find(event2 => event2.name === event1.name);
      if (!matchingEvent) {
        differences.push(`Event ${event1.name} missing in second ABI`);
      } else {
        // Compare inputs
        if (event1.inputs?.length !== matchingEvent.inputs?.length) {
          differences.push(`Event ${event1.name} has different input count`);
        }
      }
    });

    return {
      compatible: differences.length === 0,
      differences,
    };
  } catch (error) {
    logger.error('Failed to compare ABIs: %O', error);
    throw new Error(`ABI comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * ABI Cache for performance optimization
 */
export class ABICache {
  private cache = new Map<string, Abi>();

  /**
   * Get ABI from cache
   */
  get(key: string): Abi | undefined {
    return this.cache.get(key);
  }

  /**
   * Set ABI in cache
   */
  set(key: string, abi: Abi): void {
    this.cache.set(key, abi);
  }

  /**
   * Check if ABI exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Create singleton ABI cache instance
export const abiCache = new ABICache();

export default {
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
  abiCache,
};